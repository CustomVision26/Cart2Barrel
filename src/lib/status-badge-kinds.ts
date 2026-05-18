/**
 * Semantic colors for status / type badges (dashboard + admin).
 * Labels are chosen per surface in item-request-status-label, order-fulfillment-labels, etc.
 */
export type StatusBadgeKind =
  | "refundPendingApproval"
  | "awaitingPurchase"
  | "companyPurchasePendingDelivery"
  | "inCart"
  | "partialReceived"
  | "fullyReceived"
  | "missingItem"
  | "refunded"
  | "newRequest"
  | "deletedFromCart"
  | "quoted"
  | "customerResend"
  | "outOfStock"
  | "draft"
  | "neutral"
  | "outsidePurchaseProblemReceipt";

const CLASSES: Record<StatusBadgeKind, string> = {
  refundPendingApproval:
    "border-amber-500/50 bg-amber-500/[0.14] text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100",
  awaitingPurchase:
    "border-orange-500/45 bg-orange-500/[0.12] text-orange-950 dark:border-orange-500/50 dark:bg-orange-500/15 dark:text-orange-100",
  companyPurchasePendingDelivery:
    "border-sky-500/45 bg-sky-500/[0.12] text-sky-950 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-100",
  inCart:
    "border-indigo-500/45 bg-indigo-500/[0.12] text-indigo-950 dark:border-indigo-500/50 dark:bg-indigo-500/15 dark:text-indigo-100",
  partialReceived:
    "border-yellow-500/50 bg-yellow-500/[0.14] text-yellow-950 dark:border-yellow-500/50 dark:bg-yellow-500/15 dark:text-yellow-100",
  fullyReceived:
    "border-emerald-500/45 bg-emerald-500/[0.12] text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100",
  missingItem:
    "border-red-500/45 bg-red-500/[0.12] text-red-950 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-100",
  refunded:
    "border-violet-500/45 bg-violet-500/[0.12] text-violet-950 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-100",
  newRequest:
    "border-emerald-900/50 bg-emerald-950/[0.35] text-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-100",
  deletedFromCart:
    "border-muted-foreground/35 bg-muted/70 text-muted-foreground",
  quoted:
    "border-cyan-500/40 bg-cyan-500/[0.11] text-cyan-950 dark:border-cyan-500/45 dark:bg-cyan-500/12 dark:text-cyan-100",
  customerResend:
    "border-amber-500/45 bg-amber-500/[0.12] text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100",
  outOfStock:
    "border-rose-500/45 bg-rose-500/[0.12] text-rose-950 dark:border-rose-500/50 dark:bg-rose-500/15 dark:text-rose-100",
  draft:
    "border-border bg-muted/50 text-muted-foreground",
  neutral: "border-border bg-muted/40 text-muted-foreground",
  outsidePurchaseProblemReceipt:
    "border-amber-600/55 bg-amber-500/20 text-amber-950 dark:border-amber-500/55 dark:bg-amber-500/20 dark:text-amber-50",
};

const BASE =
  "inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-snug tracking-tight";

export function statusBadgeClassName(kind: StatusBadgeKind): string {
  return `${BASE} ${CLASSES[kind]}`;
}
