import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notFound } from "next/navigation";

import { UserSupportTicketPanel } from "@/components/support/user-support-ticket-panel";
import {
  getMerchandiseReconciliationAwaitingDecisionByTicket,
  getMerchandiseReconciliationAwaitingDecisionForUser,
} from "@/data/order-item-merchandise-reconciliations";
import {
  loadUserSupportTicketDetail,
  markUserSupportTicketRead,
} from "@/data/support-tickets";
import { getClerkSessionGate } from "@/lib/clerk-session";
import {
  messageBodyHasMerchandisePriceDecision,
  ticketHasUnansweredMerchandisePriceDecisionPrompt,
} from "@/lib/merchandise-reconciliation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function DashboardSupportTicketPage({ params }: PageProps) {
  const gate = await getClerkSessionGate();
  if (!gate.ok) notFound();

  const { ticketId } = await params;
  const ticket = await loadUserSupportTicketDetail({
    clerkUserId: gate.userId,
    ticketId,
  });
  if (!ticket) notFound();

  await markUserSupportTicketRead({
    clerkUserId: gate.userId,
    ticketId,
  });
  after(() => {
    revalidatePath("/dashboard", "layout");
  });

  const awaiting =
    (await getMerchandiseReconciliationAwaitingDecisionByTicket({
      supportTicketId: ticketId,
      clerkUserId: gate.userId,
    })) ??
    (await getMerchandiseReconciliationAwaitingDecisionForUser(gate.userId));

  const hasUnansweredPrompt = ticketHasUnansweredMerchandisePriceDecisionPrompt(
    ticket.messages,
  );
  const anyCustomerDecision = ticket.messages.some(
    (m) =>
      !m.isFromStaff && messageBodyHasMerchandisePriceDecision(m.body),
  );
  const showMerchandisePriceDecision =
    ticket.status !== "closed" &&
    ticket.status !== "resolved" &&
    (hasUnansweredPrompt || (Boolean(awaiting) && !anyCustomerDecision));

  return (
    <UserSupportTicketPanel
      ticket={ticket}
      showMerchandisePriceDecision={showMerchandisePriceDecision}
    />
  );
}
