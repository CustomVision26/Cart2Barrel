import {
  UserSupportInboxControls,
  UserSupportInboxTabNav,
} from "@/components/support/user-support-inbox-controls";
import { UserSupportInbox } from "@/components/support/user-support-inbox";
import { listUserSupportTicketsPage } from "@/data/support-tickets";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { parseSupportInboxQuery } from "@/lib/support-inbox-params";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardSupportHistoryPage({
  searchParams,
}: PageProps) {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return (
      <p className="text-sm text-muted-foreground">Sign in to view your messages.</p>
    );
  }

  const rawSp = (await searchParams) ?? {};
  const query = parseSupportInboxQuery(rawSp);
  const page = await listUserSupportTicketsPage({
    clerkUserId: gate.userId,
    mode: "history",
    query,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="text-sm text-muted-foreground">
          Conversations you removed from the inbox. Restore anytime.
        </p>
      </div>
      <UserSupportInboxTabNav activeTab="history" />
      <UserSupportInboxControls mode="history" query={query} />
      <UserSupportInbox
        tickets={page.tickets}
        mode="history"
        query={query}
        total={page.total}
      />
    </div>
  );
}
