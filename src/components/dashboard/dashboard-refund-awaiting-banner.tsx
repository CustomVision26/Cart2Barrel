import Link from "next/link";

import { countPendingRefundRequestsForOwner } from "@/data/order-item-refund-requests";

export async function DashboardRefundAwaitingBanner({
  clerkUserId,
}: {
  clerkUserId: string;
}) {
  const n = await countPendingRefundRequestsForOwner(clerkUserId);
  if (n < 1) return null;

  return (
    <div className="rounded-lg border border-amber-500/35 bg-amber-500/[0.12] px-4 py-3 text-sm">
      <p className="font-medium text-amber-950 dark:text-amber-50">
        {n === 1
          ? "You have one refund request waiting for Cart2Barrel approval."
          : `You have ${n} refund requests waiting for Cart2Barrel approval.`}
      </p>
      <p className="mt-1 text-xs text-amber-900/85 dark:text-amber-100/90">
        Line items on your Orders tab show{" "}
        <span className="font-semibold text-foreground">Refund requested — awaiting approval</span>.
        Stripe can only credit your card after staff approves the request.
      </p>
      <Link
        href="/dashboard/orders"
        className="mt-3 inline-flex text-xs font-medium text-primary underline-offset-4 hover:underline"
        prefetch={false}
      >
        View orders →
      </Link>
    </div>
  );
}
