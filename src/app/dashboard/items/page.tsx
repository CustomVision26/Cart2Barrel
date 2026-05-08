import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { ItemRequestWorkspace } from "@/components/dashboard/item-request-workspace";

export default async function DashboardItemsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Requested items
        </h1>
        <p className="text-sm text-muted-foreground">
          Submit a request manually or use AI-assisted fields to pull details from
          the product page—then staff reviews and quotes.{" "}
          <Link
            href="/dashboard/items/new"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            View your requests
          </Link>
        </p>
      </div>

      <ItemRequestWorkspace />
    </div>
  );
}
