import { auth } from "@clerk/nextjs/server";

import { RequestedItemsPageHeading } from "@/components/dashboard/requested-items-page-heading";
import { RequestedItemsSubmissionHub } from "@/components/dashboard/requested-items-submission-hub";

export default async function DashboardRequestedItemsHubPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  return (
    <div className="space-y-8">
      <RequestedItemsPageHeading />
      <RequestedItemsSubmissionHub />
    </div>
  );
}
