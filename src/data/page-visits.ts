import "server-only";

import { and, desc, gte, inArray, sql } from "drizzle-orm";

import { ensurePageVisitsSchema } from "@/data/ensure-page-visits-schema";
import { getDb } from "@/db";
import { pageVisits, profiles } from "@/db/schema";
import { isMissingPageVisitsTableError } from "@/lib/db-column-missing";
import { profileDisplayName } from "@/lib/profile-display-name";

const LOOKBACK_DAYS = 30;
const VISITOR_LIMIT = 400;
const PAGE_LIMIT = 200;
const RECENT_LIMIT = 250;

export type SiteTrafficVisitorKind = "registered" | "unregistered";

export type SiteTrafficVisitorPage = {
  path: string;
  visitCount: number;
  lastVisitedAt: string;
};

export type SiteTrafficVisitorRow = {
  visitorId: string;
  clerkUserId: string | null;
  displayName: string;
  email: string | null;
  kind: SiteTrafficVisitorKind;
  visitCount: number;
  pageCount: number;
  lastPath: string;
  lastSeenAt: string;
  firstSeenAt: string;
  pages: SiteTrafficVisitorPage[];
};

export type SiteTrafficPageRow = {
  path: string;
  visitCount: number;
  uniqueVisitorCount: number;
  registeredVisitCount: number;
  unregisteredVisitCount: number;
  lastVisitedAt: string;
};

export type SiteTrafficRecentVisitRow = {
  id: string;
  visitorId: string;
  clerkUserId: string | null;
  displayName: string;
  email: string | null;
  kind: SiteTrafficVisitorKind;
  path: string;
  createdAt: string;
};

export type SiteTrafficSummary = {
  visits24h: number;
  visits30d: number;
  uniqueVisitors30d: number;
  registeredVisitors30d: number;
  unregisteredVisitors30d: number;
};

export type SiteTrafficSnapshot = {
  summary: SiteTrafficSummary;
  visitors: SiteTrafficVisitorRow[];
  pages: SiteTrafficPageRow[];
  recentVisits: SiteTrafficRecentVisitRow[];
};

function iso(d: Date): string {
  return d.toISOString();
}

function emptySnapshot(): SiteTrafficSnapshot {
  return {
    summary: {
      visits24h: 0,
      visits30d: 0,
      uniqueVisitors30d: 0,
      registeredVisitors30d: 0,
      unregisteredVisitors30d: 0,
    },
    visitors: [],
    pages: [],
    recentVisits: [],
  };
}

function guestLabel(visitorId: string): string {
  return `Guest · ${visitorId.slice(0, 8)}`;
}

export async function recordPageVisit(input: {
  visitorId: string;
  clerkUserId: string | null;
  path: string;
  referrer: string | null;
}): Promise<void> {
  const ready = await ensurePageVisitsSchema();
  if (!ready) return;

  try {
    const db = getDb();
    await db.insert(pageVisits).values({
      visitorId: input.visitorId,
      clerkUserId: input.clerkUserId,
      path: input.path,
      referrer: input.referrer,
    });
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] page visit log failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function listSiteTrafficSnapshot(): Promise<SiteTrafficSnapshot> {
  const ready = await ensurePageVisitsSchema();
  if (!ready) return emptySnapshot();

  const now = new Date();
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - LOOKBACK_DAYS);
  const since24 = new Date(now);
  since24.setUTCHours(since24.getUTCHours() - 24);
  const since30Iso = iso(since30);
  const since24Iso = iso(since24);

  try {
    const db = getDb();

    const [summaryRow] = await db
      .select({
        visits24h: sql<number>`count(*) FILTER (WHERE ${pageVisits.createdAt} >= ${since24Iso})::int`,
        visits30d: sql<number>`count(*)::int`,
        uniqueVisitors30d: sql<number>`count(distinct ${pageVisits.visitorId})::int`,
        registeredVisitors30d: sql<number>`count(distinct ${pageVisits.visitorId}) FILTER (WHERE ${pageVisits.clerkUserId} IS NOT NULL)::int`,
      })
      .from(pageVisits)
      .where(gte(pageVisits.createdAt, since30Iso));

    const visitorAgg = await db
      .select({
        visitorId: pageVisits.visitorId,
        visitCount: sql<number>`count(*)::int`,
        pageCount: sql<number>`count(distinct ${pageVisits.path})::int`,
        lastSeenAt: sql<string>`max(${pageVisits.createdAt})`,
        firstSeenAt: sql<string>`min(${pageVisits.createdAt})`,
        lastPath: sql<string>`(array_agg(${pageVisits.path} ORDER BY ${pageVisits.createdAt} DESC))[1]`,
        lastClerkUserId: sql<string | null>`(array_agg(${pageVisits.clerkUserId} ORDER BY ${pageVisits.createdAt} DESC) FILTER (WHERE ${pageVisits.clerkUserId} IS NOT NULL))[1]`,
      })
      .from(pageVisits)
      .where(gte(pageVisits.createdAt, since30Iso))
      .groupBy(pageVisits.visitorId)
      .orderBy(sql`max(${pageVisits.createdAt}) DESC`)
      .limit(VISITOR_LIMIT);

    const pageAgg = await db
      .select({
        path: pageVisits.path,
        visitCount: sql<number>`count(*)::int`,
        uniqueVisitorCount: sql<number>`count(distinct ${pageVisits.visitorId})::int`,
        registeredVisitCount: sql<number>`count(*) FILTER (WHERE ${pageVisits.clerkUserId} IS NOT NULL)::int`,
        unregisteredVisitCount: sql<number>`count(*) FILTER (WHERE ${pageVisits.clerkUserId} IS NULL)::int`,
        lastVisitedAt: sql<string>`max(${pageVisits.createdAt})`,
      })
      .from(pageVisits)
      .where(gte(pageVisits.createdAt, since30Iso))
      .groupBy(pageVisits.path)
      .orderBy(sql`count(*) DESC`)
      .limit(PAGE_LIMIT);

    const visitorIds = visitorAgg.map((row) => row.visitorId);
    const visitorPages =
      visitorIds.length === 0
        ? []
        : await db
            .select({
              visitorId: pageVisits.visitorId,
              path: pageVisits.path,
              visitCount: sql<number>`count(*)::int`,
              lastVisitedAt: sql<string>`max(${pageVisits.createdAt})`,
            })
            .from(pageVisits)
            .where(
              and(
                inArray(pageVisits.visitorId, visitorIds),
                gte(pageVisits.createdAt, since30Iso),
              ),
            )
            .groupBy(pageVisits.visitorId, pageVisits.path);

    const recent = await db
      .select({
        id: pageVisits.id,
        visitorId: pageVisits.visitorId,
        clerkUserId: pageVisits.clerkUserId,
        path: pageVisits.path,
        createdAt: pageVisits.createdAt,
      })
      .from(pageVisits)
      .where(gte(pageVisits.createdAt, since30Iso))
      .orderBy(desc(pageVisits.createdAt))
      .limit(RECENT_LIMIT);

    const clerkIds = [
      ...new Set(
        [
          ...visitorAgg.map((row) => row.lastClerkUserId),
          ...recent.map((row) => row.clerkUserId),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];

    const profileByClerkId = new Map<
      string,
      { fullName: string | null; email: string | null }
    >();
    if (clerkIds.length > 0) {
      const profileRows = await db
        .select({
          clerkUserId: profiles.clerkUserId,
          fullName: profiles.fullName,
          email: profiles.email,
        })
        .from(profiles)
        .where(inArray(profiles.clerkUserId, clerkIds));
      for (const row of profileRows) {
        profileByClerkId.set(row.clerkUserId, {
          fullName: row.fullName,
          email: row.email,
        });
      }
    }

    const pagesByVisitor = new Map<string, SiteTrafficVisitorPage[]>();
    for (const row of visitorPages) {
      const list = pagesByVisitor.get(row.visitorId) ?? [];
      list.push({
        path: row.path,
        visitCount: Number(row.visitCount) || 0,
        lastVisitedAt: row.lastVisitedAt,
      });
      pagesByVisitor.set(row.visitorId, list);
    }
    for (const list of pagesByVisitor.values()) {
      list.sort((a, b) => {
        if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
        return b.lastVisitedAt.localeCompare(a.lastVisitedAt);
      });
    }

    function identityFor(
      visitorId: string,
      clerkUserId: string | null,
    ): {
      displayName: string;
      email: string | null;
      kind: SiteTrafficVisitorKind;
    } {
      if (!clerkUserId) {
        return {
          displayName: guestLabel(visitorId),
          email: null,
          kind: "unregistered",
        };
      }
      const profile = profileByClerkId.get(clerkUserId);
      return {
        displayName: profileDisplayName({
          clerkUserId,
          fullName: profile?.fullName,
          email: profile?.email,
        }),
        email: profile?.email?.trim() || null,
        kind: "registered",
      };
    }

    const visitors: SiteTrafficVisitorRow[] = visitorAgg.map((row) => {
      const clerkUserId = row.lastClerkUserId ?? null;
      const identity = identityFor(row.visitorId, clerkUserId);
      return {
        visitorId: row.visitorId,
        clerkUserId,
        displayName: identity.displayName,
        email: identity.email,
        kind: identity.kind,
        visitCount: Number(row.visitCount) || 0,
        pageCount: Number(row.pageCount) || 0,
        lastPath: row.lastPath,
        lastSeenAt: row.lastSeenAt,
        firstSeenAt: row.firstSeenAt,
        pages: pagesByVisitor.get(row.visitorId) ?? [],
      };
    });

    const uniqueVisitors30d = Number(summaryRow?.uniqueVisitors30d ?? 0);
    const registeredVisitors30d = Number(
      summaryRow?.registeredVisitors30d ?? 0,
    );
    const summary: SiteTrafficSummary = {
      visits24h: Number(summaryRow?.visits24h ?? 0),
      visits30d: Number(summaryRow?.visits30d ?? 0),
      uniqueVisitors30d,
      registeredVisitors30d,
      unregisteredVisitors30d: Math.max(
        0,
        uniqueVisitors30d - registeredVisitors30d,
      ),
    };

    const pages: SiteTrafficPageRow[] = pageAgg.map((row) => ({
      path: row.path,
      visitCount: Number(row.visitCount) || 0,
      uniqueVisitorCount: Number(row.uniqueVisitorCount) || 0,
      registeredVisitCount: Number(row.registeredVisitCount) || 0,
      unregisteredVisitCount: Number(row.unregisteredVisitCount) || 0,
      lastVisitedAt: row.lastVisitedAt,
    }));

    const recentVisits: SiteTrafficRecentVisitRow[] = recent.map((row) => {
      const identity = identityFor(row.visitorId, row.clerkUserId);
      return {
        id: row.id,
        visitorId: row.visitorId,
        clerkUserId: row.clerkUserId,
        displayName: identity.displayName,
        email: identity.email,
        kind: identity.kind,
        path: row.path,
        createdAt: row.createdAt,
      };
    });

    return { summary, visitors, pages, recentVisits };
  } catch (error) {
    if (!isMissingPageVisitsTableError(error)) {
      console.warn(
        "[Amani Cart2Barrel] site traffic list failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
    return emptySnapshot();
  }
}
