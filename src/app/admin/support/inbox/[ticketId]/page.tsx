import { notFound } from "next/navigation";

import { AdminSupportTicketPanel } from "@/components/admin/admin-support-ticket-panel";
import { loadAdminSupportTicketDetail } from "@/data/support-tickets";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function AdminSupportTicketPage({ params }: PageProps) {
  const { ticketId } = await params;
  const ticket = await loadAdminSupportTicketDetail(ticketId);
  if (!ticket) notFound();

  return <AdminSupportTicketPanel ticket={ticket} />;
}
