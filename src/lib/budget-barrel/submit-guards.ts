export type BudgetBarrelDraftLock = {
  clerkUserId: string;
  status: "open" | "submitting" | "submitted" | string;
  idempotencyKey: string | null;
  batchQuoteSessionId: string | null;
};

export type SubmitLockDecision =
  | { action: "proceed" }
  | { action: "replay"; batchSessionId: string }
  | { action: "in_progress" }
  | { action: "not_found" }
  | { action: "forbidden" };

export function decideSubmitLock(input: {
  draft: BudgetBarrelDraftLock | null;
  actorUserId: string;
  idempotencyKey: string;
}): SubmitLockDecision {
  const draft = input.draft;
  if (!draft) return { action: "not_found" };
  if (draft.clerkUserId !== input.actorUserId) return { action: "forbidden" };
  if (draft.status === "submitted" && draft.batchQuoteSessionId) {
    return { action: "replay", batchSessionId: draft.batchQuoteSessionId };
  }
  if (draft.status === "submitting") return { action: "in_progress" };
  if (draft.status === "open") return { action: "proceed" };
  return { action: "not_found" };
}

export function isOfferStale(retrievedAt: string, now = Date.now(), staleMs = 15 * 60 * 1000): boolean {
  const parsed = Date.parse(retrievedAt);
  if (!Number.isFinite(parsed)) return true;
  return now - parsed > staleMs;
}

export function canReadBudgetDraft(ownerUserId: string, actorUserId: string): boolean {
  return ownerUserId.length > 0 && ownerUserId === actorUserId;
}
