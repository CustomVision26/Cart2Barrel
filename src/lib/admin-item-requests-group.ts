import type {
  AdminItemRequestWithUserRow,
  AdminRequestQueueKind,
} from "@/data/admin-item-requests";

export type AdminItemRequestGroup = {
  clerkUserId: string;
  userFullName: string | null;
  userEmail: string | null;
  /** All requests for this account (any status). */
  requests: AdminItemRequestWithUserRow[];
  /** Pending + quoted items shown in the active ops queue. */
  activeQueueRequests: AdminItemRequestWithUserRow[];
  activeQueueCount: number;
  pendingCount: number;
  quotedCount: number;
  totalCount: number;
};

function submitterDisplayName(
  fullName: string | null,
  email: string | null
): string {
  const name = fullName?.trim();
  if (name) return name;
  const mail = email?.trim();
  if (mail) return mail;
  return "Unknown user";
}

function activeQueueSortKey(kind: AdminRequestQueueKind): number {
  if (kind === "resend") return 0;
  if (kind === "new") return 1;
  return 2;
}

/** Group item requests by Clerk account; safe to run on the server. */
export function buildAdminItemRequestGroups(
  rows: AdminItemRequestWithUserRow[]
): AdminItemRequestGroup[] {
  const map = new Map<
    string,
    {
      clerkUserId: string;
      userFullName: string | null;
      userEmail: string | null;
      requests: AdminItemRequestWithUserRow[];
    }
  >();

  for (const row of rows) {
    const id = row.request.clerkUserId;
    let bucket = map.get(id);
    if (!bucket) {
      bucket = {
        clerkUserId: id,
        userFullName: row.userFullName,
        userEmail: row.userEmail,
        requests: [],
      };
      map.set(id, bucket);
    }
    bucket.requests.push(row);
  }

  const groups: AdminItemRequestGroup[] = Array.from(map.values()).map((b) => {
    const pendingCount = b.requests.filter(
      (r) => r.request.status === "pending"
    ).length;
    const quotedCount = b.requests.filter(
      (r) => r.request.status === "quoted"
    ).length;
    const activeQueueRequests = b.requests
      .filter((r) => {
        const s = r.request.status;
        if (s !== "pending" && s !== "quoted") return false;
        // Quoted lines bundled into a customer batch are handled on Batch Items; hide here.
        if (s === "quoted" && r.request.batchQuoteSessionId != null) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const d = activeQueueSortKey(a.queueKind) - activeQueueSortKey(b.queueKind);
        if (d !== 0) return d;
        return (
          new Date(b.request.createdAt).getTime() -
          new Date(a.request.createdAt).getTime()
        );
      });
    return {
      clerkUserId: b.clerkUserId,
      userFullName: b.userFullName,
      userEmail: b.userEmail,
      requests: b.requests,
      activeQueueRequests,
      activeQueueCount: activeQueueRequests.length,
      pendingCount,
      quotedCount,
      totalCount: b.requests.length,
    };
  });

  groups.sort((a, b) =>
    submitterDisplayName(a.userFullName, a.userEmail).localeCompare(
      submitterDisplayName(b.userFullName, b.userEmail),
      undefined,
      { sensitivity: "base" }
    )
  );

  return groups;
}
