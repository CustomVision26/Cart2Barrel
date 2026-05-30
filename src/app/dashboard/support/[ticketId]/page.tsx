import { notFound } from "next/navigation";

import { UserSupportTicketPanel } from "@/components/support/user-support-ticket-panel";
import { loadUserSupportTicketDetail } from "@/data/support-tickets";
import { getClerkSessionGate } from "@/lib/clerk-session";

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

  return <UserSupportTicketPanel ticket={ticket} />;
}
