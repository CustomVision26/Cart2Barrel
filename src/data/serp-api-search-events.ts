import { gte, sql } from "drizzle-orm";

import { filterProfilesToActiveClerkUsers } from "@/data/filter-profiles-to-active-clerk-users";
import { getDb } from "@/db";
import {
  profiles,
  serpApiSearchEvents,
  type SerpApiSearchEvent,
} from "@/db/schema";
import type { SerpApiSearchSource } from "@/lib/serpapi/usage-context";
import { profileDisplayName } from "@/lib/profile-display-name";

export type SerpApiUsageBucket = {
  label: string;
  iso: string;
  searches: number;
};

export type SerpApiUserUsageRow = {
  clerkUserId: string | null;
  displayName: string;
  email: string | null;
  searchesThisHour: number;
  searchesThisMonth: number;
};

function iso(d: Date): string {
  return d.toISOString();
}

export async function recordSerpApiSearchEvent(input: {
  clerkUserId: string | null;
  source: SerpApiSearchSource;
  engine: string | null;
}): Promise<void> {
  try {
    const db = getDb();
    await db.insert(serpApiSearchEvents).values({
      clerkUserId: input.clerkUserId,
      source: input.source,
      engine: input.engine,
    });
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] SerpApi usage log failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function countSerpApiSearchesSince(sinceIso: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(serpApiSearchEvents)
    .where(gte(serpApiSearchEvents.createdAt, sinceIso));
  return Number(row?.n ?? 0);
}

function startOfUtcHour(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

function startOfUtcMonth(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function hourKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}`;
}

function fillHourlyBuckets(
  rows: Array<{ bucket: string; searches: number }>,
  hours: number,
): SerpApiUsageBucket[] {
  const byHour = new Map(
    rows.map((r) => [hourKey(new Date(r.bucket)), Number(r.searches) || 0]),
  );
  const out: SerpApiUsageBucket[] = [];
  const start = startOfUtcHour();
  start.setUTCHours(start.getUTCHours() - (hours - 1));
  for (let i = 0; i < hours; i++) {
    const t = new Date(start);
    t.setUTCHours(start.getUTCHours() + i);
    t.setUTCMinutes(0, 0, 0);
    const key = hourKey(t);
    out.push({
      iso: t.toISOString(),
      label: t.toLocaleString(undefined, { hour: "numeric" }),
      searches: byHour.get(key) ?? 0,
    });
  }
  return out;
}

function fillDailyBuckets(
  rows: Array<{ bucket: string; searches: number }>,
  days: number,
): SerpApiUsageBucket[] {
  const byDay = new Map(
    rows.map((r) => {
      const d = new Date(r.bucket);
      const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      return [key, Number(r.searches) || 0] as const;
    }),
  );
  const out: SerpApiUsageBucket[] = [];
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const t = new Date(start);
    t.setUTCDate(start.getUTCDate() + i);
    const key = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    out.push({
      iso: t.toISOString(),
      label: t.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      searches: byDay.get(key) ?? 0,
    });
  }
  return out;
}

export async function listSerpApiHourlyBuckets(
  hours = 24,
): Promise<SerpApiUsageBucket[]> {
  const db = getDb();
  const since = new Date();
  since.setUTCHours(since.getUTCHours() - hours);
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc('hour', ${serpApiSearchEvents.createdAt})`,
      searches: sql<number>`count(*)::int`,
    })
    .from(serpApiSearchEvents)
    .where(gte(serpApiSearchEvents.createdAt, iso(since)))
    .groupBy(sql`date_trunc('hour', ${serpApiSearchEvents.createdAt})`)
    .orderBy(sql`date_trunc('hour', ${serpApiSearchEvents.createdAt})`);
  return fillHourlyBuckets(rows, hours);
}

export async function listSerpApiDailyBuckets(
  days = 30,
): Promise<SerpApiUsageBucket[]> {
  const db = getDb();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const rows = await db
    .select({
      bucket: sql<string>`date_trunc('day', ${serpApiSearchEvents.createdAt})`,
      searches: sql<number>`count(*)::int`,
    })
    .from(serpApiSearchEvents)
    .where(gte(serpApiSearchEvents.createdAt, iso(since)))
    .groupBy(sql`date_trunc('day', ${serpApiSearchEvents.createdAt})`)
    .orderBy(sql`date_trunc('day', ${serpApiSearchEvents.createdAt})`);
  return fillDailyBuckets(rows, days);
}

function usageRowFromProfile(
  profile: {
    clerkUserId: string;
    fullName: string | null;
    email: string | null;
  },
  hourMap: Map<string, number>,
  monthMap: Map<string, number>,
): SerpApiUserUsageRow {
  const id = profile.clerkUserId;
  const email = profile.email?.trim() || null;
  return {
    clerkUserId: id,
    displayName: profileDisplayName({
      clerkUserId: id,
      fullName: profile.fullName,
      email,
    }),
    email,
    searchesThisHour: hourMap.get(id) ?? 0,
    searchesThisMonth: monthMap.get(id) ?? 0,
  };
}

export async function listSerpApiUsageByUser(): Promise<SerpApiUserUsageRow[]> {
  const db = getDb();
  const hourIso = iso(startOfUtcHour());
  const monthIso = iso(startOfUtcMonth());

  let hourMap = new Map<string, number>();
  let monthMap = new Map<string, number>();

  try {
    const [monthRows, hourRows] = await Promise.all([
      db
        .select({
          clerkUserId: serpApiSearchEvents.clerkUserId,
          searches: sql<number>`count(*)::int`,
        })
        .from(serpApiSearchEvents)
        .where(gte(serpApiSearchEvents.createdAt, monthIso))
        .groupBy(serpApiSearchEvents.clerkUserId),
      db
        .select({
          clerkUserId: serpApiSearchEvents.clerkUserId,
          searches: sql<number>`count(*)::int`,
        })
        .from(serpApiSearchEvents)
        .where(gte(serpApiSearchEvents.createdAt, hourIso))
        .groupBy(serpApiSearchEvents.clerkUserId),
    ]);
    hourMap = new Map(
      hourRows.map((r) => [r.clerkUserId ?? "", Number(r.searches) || 0] as const),
    );
    monthMap = new Map(
      monthRows.map((r) => [r.clerkUserId ?? "", Number(r.searches) || 0] as const),
    );
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] SerpApi usage by user failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  let activeProfiles: Array<{
    clerkUserId: string;
    fullName: string | null;
    email: string | null;
  }> = [];
  try {
    const profileRows = await db
      .select({
        clerkUserId: profiles.clerkUserId,
        fullName: profiles.fullName,
        email: profiles.email,
      })
      .from(profiles);
    activeProfiles = await filterProfilesToActiveClerkUsers(profileRows);
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] SerpApi usage profile list failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const listedIds = new Set(activeProfiles.map((p) => p.clerkUserId));

  const out: SerpApiUserUsageRow[] = activeProfiles.map((profile) =>
    usageRowFromProfile(profile, hourMap, monthMap),
  );

  for (const key of new Set([...monthMap.keys(), ...hourMap.keys()])) {
    if (!key || listedIds.has(key)) continue;
    out.push({
      clerkUserId: key,
      displayName: profileDisplayName({ clerkUserId: key }),
      email: null,
      searchesThisHour: hourMap.get(key) ?? 0,
      searchesThisMonth: monthMap.get(key) ?? 0,
    });
  }

  const unattrHour = hourMap.get("") ?? 0;
  const unattrMonth = monthMap.get("") ?? 0;
  if (unattrHour > 0 || unattrMonth > 0) {
    out.push({
      clerkUserId: null,
      displayName: "Scheduled / unattributed",
      email: null,
      searchesThisHour: unattrHour,
      searchesThisMonth: unattrMonth,
    });
  }

  out.sort((a, b) => {
    if (b.searchesThisMonth !== a.searchesThisMonth) {
      return b.searchesThisMonth - a.searchesThisMonth;
    }
    if (b.searchesThisHour !== a.searchesThisHour) {
      return b.searchesThisHour - a.searchesThisHour;
    }
    return a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    });
  });
  return out;
}

export type { SerpApiSearchEvent };
