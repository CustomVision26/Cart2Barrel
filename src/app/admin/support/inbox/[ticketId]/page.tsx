import { notFound } from "next/navigation";

import { AdminSupportTicketThread } from "@/components/admin/admin-support-ticket-thread";
import { getSupportTicketWithMessagesForAdmin } from "@/data/support-tickets";

export default async function AdminSupportTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const thread = await getSupportTicketWithMessagesForAdmin(ticketId);

  if (!thread) {
    notFound();
  }

  return <AdminSupportTicketThread thread={thread} />;
}
