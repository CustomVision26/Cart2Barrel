import { ContactUsDialog } from "@/components/support/contact-us-dialog";
import { UserSupportInbox } from "@/components/support/user-support-inbox";
import { loadHubContactSettings } from "@/data/hub-contact-settings";
import { listUserSupportTickets } from "@/data/support-tickets";
import { getClerkSessionGate } from "@/lib/clerk-session";

export const dynamic = "force-dynamic";

export default async function DashboardSupportPage() {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return (
      <p className="text-sm text-muted-foreground">Sign in to view your messages.</p>
    );
  }

  const [tickets, hubContact] = await Promise.all([
    listUserSupportTickets(gate.userId),
    loadHubContactSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Your support conversations with the hub team.
          </p>
        </div>
        <ContactUsDialog hubContact={hubContact} />
      </div>
      <UserSupportInbox tickets={tickets} />
      <p className="text-xs text-muted-foreground">
        New issue? Use <span className="font-medium text-foreground">Contact us</span>{" "}
        in the top bar to start a conversation.
      </p>
    </div>
  );
}
