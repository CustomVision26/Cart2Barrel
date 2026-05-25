import { headers } from "next/headers";
import { Webhook } from "svix";
import { z } from "zod";

import { notifyOnNewUserRegistration } from "@/data/account-registration-notifications";
import { getProfileByClerkId } from "@/data/profiles";
import { syncProfileFromClerkWebhookUser } from "@/data/sync-profile-from-clerk-webhook";
import {
  clerkWebhookSigningSecretNotConfiguredMessage,
  getClerkWebhookSigningSecret,
} from "@/lib/clerk-webhook-env";

export const runtime = "nodejs";

const clerkWebhookUserSchema = z.object({
  id: z.string().min(1),
  email_addresses: z
    .array(
      z.object({
        id: z.string(),
        email_address: z.string(),
      }),
    )
    .optional(),
  primary_email_address_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
});

const clerkWebhookEnvelopeSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});

export async function POST(req: Request) {
  const secret = getClerkWebhookSigningSecret();
  if (!secret) {
    return new Response(clerkWebhookSigningSecretNotConfiguredMessage(), {
      status: 500,
    });
  }

  const body = await req.text();
  const headerList = await headers();
  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix signature headers.", { status: 400 });
  }

  let payload: unknown;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  const envelope = clerkWebhookEnvelopeSchema.safeParse(payload);
  if (!envelope.success) {
    return new Response("Unsupported webhook payload.", { status: 400 });
  }

  switch (envelope.data.type) {
    case "user.created": {
      const userParsed = clerkWebhookUserSchema.safeParse(envelope.data.data);
      if (!userParsed.success) {
        return new Response("Invalid user payload.", { status: 400 });
      }
      const user = userParsed.data;
      const hadProfile = Boolean(await getProfileByClerkId(user.id));
      await syncProfileFromClerkWebhookUser(user);
      if (!hadProfile) {
        const displayName = [user.first_name, user.last_name]
          .map((s) => s?.trim())
          .filter((s): s is string => Boolean(s))
          .join(" ");
        const email =
          user.email_addresses?.find(
            (e) => e.id === user.primary_email_address_id,
          )?.email_address?.trim() ||
          user.email_addresses?.[0]?.email_address?.trim() ||
          null;
        await notifyOnNewUserRegistration({
          clerkUserId: user.id,
          displayName: displayName || null,
          email,
        });
      }
      break;
    }
    case "user.updated": {
      const userParsed = clerkWebhookUserSchema.safeParse(envelope.data.data);
      if (!userParsed.success) {
        return new Response("Invalid user payload.", { status: 400 });
      }
      await syncProfileFromClerkWebhookUser(userParsed.data);
      break;
    }
    case "user.deleted":
      // Keep local profile rows for order history (orders FK is restrict).
      break;
    default:
      break;
  }

  return new Response(null, { status: 200 });
}
