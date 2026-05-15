import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { DashboardRefundAwaitingBanner } from "@/components/dashboard/dashboard-refund-awaiting-banner";

export default async function DashboardHomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Overview shortcuts and notices for your shipments and refunds.
        </p>
      </div>
      <DashboardRefundAwaitingBanner clerkUserId={userId} />
    </div>
  );
}
