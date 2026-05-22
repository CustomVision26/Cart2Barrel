import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

export default async function DashboardHomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  return <DashboardOverview clerkUserId={userId} />;
}
