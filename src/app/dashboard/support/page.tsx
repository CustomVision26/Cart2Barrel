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

export default async function DashboardSupportPage({ searchParams }: PageProps) {
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
    mode: "inbox",
    query,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Messages
        </h1>
        <p className="text-sm text-muted-foreground">
          Your support conversations with the hub team.
        </p>
      </div>
      <UserSupportInboxTabNav activeTab="inbox" />
      <UserSupportInboxControls mode="inbox" query={query} />
      <UserSupportInbox
        tickets={page.tickets}
        mode="inbox"
        query={query}
        total={page.total}
      />
      <p className="text-xs text-muted-foreground">
        New issue? Use <span className="font-medium text-foreground">Contact us</span>{" "}
        in the top bar to start a conversation. Remove moves a thread to History.
      </p>
    </div>
  );
}
