import { gte, inArray, sql } from "drizzle-orm";

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

export async function listSerpApiUsageByUser(): Promise<SerpApiUserUsageRow[]> {
  const db = getDb();
  const hourIso = iso(startOfUtcHour());
  const monthIso = iso(startOfUtcMonth());

  const monthRows = await db
    .select({
      clerkUserId: serpApiSearchEvents.clerkUserId,
      searches: sql<number>`count(*)::int`,
    })
    .from(serpApiSearchEvents)
    .where(gte(serpApiSearchEvents.createdAt, monthIso))
    .groupBy(serpApiSearchEvents.clerkUserId);

  const hourRows = await db
    .select({
      clerkUserId: serpApiSearchEvents.clerkUserId,
      searches: sql<number>`count(*)::int`,
    })
    .from(serpApiSearchEvents)
    .where(gte(serpApiSearchEvents.createdAt, hourIso))
    .groupBy(serpApiSearchEvents.clerkUserId);

  const hourMap = new Map(
    hourRows.map((r) => [r.clerkUserId ?? "", r.searches] as const),
  );
  const monthMap = new Map(
    monthRows.map((r) => [r.clerkUserId ?? "", r.searches] as const),
  );

  const keys = new Set([...monthMap.keys(), ...hourMap.keys()]);
  const ids = [...keys].filter((id) => id.length > 0);

  const profileRows =
    ids.length > 0
      ? await db
          .select({
            clerkUserId: profiles.clerkUserId,
            fullName: profiles.fullName,
            email: profiles.email,
          })
          .from(profiles)
          .where(inArray(profiles.clerkUserId, ids))
      : [];
  const profileById = new Map(profileRows.map((p) => [p.clerkUserId, p]));

  const out: SerpApiUserUsageRow[] = [...keys].map((key) => {
    const id = key.length > 0 ? key : null;
    if (!id) {
      return {
        clerkUserId: null,
        displayName: "Scheduled / unattributed",
        email: null,
        searchesThisHour: hourMap.get("") ?? 0,
        searchesThisMonth: monthMap.get("") ?? 0,
      };
    }
    const profile = profileById.get(id);
    return {
      clerkUserId: id,
      displayName: profileDisplayName({
        clerkUserId: id,
        fullName: profile?.fullName,
        email: profile?.email,
      }),
      email: profile?.email?.trim() || null,
      searchesThisHour: hourMap.get(id) ?? 0,
      searchesThisMonth: monthMap.get(id) ?? 0,
    };
  });

  out.sort((a, b) => b.searchesThisMonth - a.searchesThisMonth);
  return out;
}

export type { SerpApiSearchEvent };
