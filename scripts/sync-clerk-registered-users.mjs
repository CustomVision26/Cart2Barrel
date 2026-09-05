/**
 * Sync Clerk users into `profiles` and grant superadmin to SUPERADMIN_EMAIL.
 *
 *   node scripts/sync-clerk-registered-users.mjs --production
 *
 * `--production` loads `.env.vercel.production` (override).
 * Env: DATABASE_URL, CLERK_SECRET_KEY
 * Optional: SUPERADMIN_EMAIL (default carttobarrel@yahoo.com)
 */
import { resolve } from "node:path";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const production = process.argv.includes("--production");
config({
  path: resolve(
    production ? ".env.vercel.production" : ".env",
  ),
  override: true,
});

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY?.trim();
const SUPERADMIN_EMAIL = (
  process.env.SUPERADMIN_EMAIL?.trim() || "carttobarrel@yahoo.com"
).toLowerCase();

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
if (!CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY is not set.");
  process.exit(1);
}

console.log(
  production
    ? "Using .env.vercel.production"
    : "Using .env",
);
console.log(
  `Clerk instance: ${CLERK_SECRET_KEY.startsWith("sk_live_") ? "live" : "test"}`,
);

const sql = neon(DATABASE_URL);
const CLERK_API = "https://api.clerk.com/v1";
const PAGE_SIZE = 100;

async function clerkFetch(path, init = {}) {
  const res = await fetch(`${CLERK_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body?.errors?.[0]?.message
        ? body.errors[0].message
        : `${res.status} ${res.statusText}`;
    throw new Error(`Clerk ${path}: ${message}`);
  }
  return body;
}

function primaryEmail(user) {
  const emails = user.email_addresses ?? [];
  const primary =
    emails.find((e) => e.id === user.primary_email_address_id) ?? emails[0];
  return primary?.email_address?.trim() || null;
}

function fullName(user) {
  const parts = [user.first_name, user.last_name]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

async function listAllClerkUsers() {
  const users = [];
  let offset = 0;
  for (;;) {
    const page = await clerkFetch(`/users?limit=${PAGE_SIZE}&offset=${offset}`);
    const data = Array.isArray(page) ? page : page?.data ?? [];
    users.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return users;
}

const clerkUsers = await listAllClerkUsers();
console.log(`Clerk users: ${clerkUsers.length}`);

let upserts = 0;
for (const user of clerkUsers) {
  const email = primaryEmail(user);
  const name = fullName(user);
  const createdAt =
    typeof user.created_at === "number"
      ? new Date(user.created_at).toISOString()
      : new Date().toISOString();
  await sql`
    INSERT INTO profiles (clerk_user_id, email, full_name, created_at, updated_at)
    VALUES (
      ${user.id},
      ${email},
      ${name},
      ${createdAt},
      now()
    )
    ON CONFLICT (clerk_user_id) DO UPDATE SET
      email = COALESCE(EXCLUDED.email, profiles.email),
      full_name = COALESCE(NULLIF(trim(profiles.full_name), ''), EXCLUDED.full_name),
      updated_at = now()
  `;
  upserts += 1;
}
console.log(`Profiles upserted: ${upserts}`);

const match = clerkUsers.find((user) => {
  const emails = (user.email_addresses ?? []).map((e) =>
    e.email_address?.trim().toLowerCase(),
  );
  return emails.includes(SUPERADMIN_EMAIL);
});

if (!match) {
  console.error(`No Clerk user found for ${SUPERADMIN_EMAIL}`);
  process.exit(1);
}

const existingRole =
  match.public_metadata && typeof match.public_metadata === "object"
    ? match.public_metadata.role
    : undefined;

await clerkFetch(`/users/${match.id}/metadata`, {
  method: "PATCH",
  body: JSON.stringify({
    public_metadata: {
      role: "superadmin",
    },
  }),
});

console.log(
  `Granted superadmin to ${SUPERADMIN_EMAIL} (${match.id}). Previous role: ${existingRole ?? "none"}`,
);
console.log("Sign out and sign back in if the admin session still uses the old role.");
