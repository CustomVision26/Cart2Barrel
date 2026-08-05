"use server";

import { revalidatePath } from "next/cache";

import {
  getMerchandiseReconciliationAwaitingDecisionByTicket,
  linkOpenMerchandiseReconciliationsToSupportTicket,
} from "@/data/order-item-merchandise-reconciliations";
import {
  appendSupportTicketMessage,
  loadUserSupportTicketDetail,
} from "@/data/support-tickets";
import {
  formatMerchandisePriceDecisionThreadMessage,
  messageBodyHasMerchandisePriceDecision,
  ticketHasUnansweredMerchandisePriceDecisionPrompt,
  type MerchandisePriceDecision,
} from "@/lib/merchandise-reconciliation";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { normalizeSupportTicketImageUrls } from "@/lib/support-ticket-images";
import { recordMerchandisePriceDecisionSchema } from "@/lib/validations/merchandise-reconciliation";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";

export type MerchandisePriceDecisionActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function recordMerchandisePriceDecisionAction(
  raw: unknown,
): Promise<MerchandisePriceDecisionActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: "Sign in required." };
  }

  const parsed = recordMerchandisePriceDecisionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid decision.",
    };
  }

  const ticket = await loadUserSupportTicketDetail({
    clerkUserId: gate.userId,
    ticketId: parsed.data.ticketId,
  });
  if (!ticket) {
    return { ok: false, message: "Conversation not found." };
  }
  if (ticket.status === "closed" || ticket.status === "resolved") {
    return { ok: false, message: "This conversation is closed." };
  }

  const hasUnansweredPrompt = ticketHasUnansweredMerchandisePriceDecisionPrompt(
    ticket.messages,
  );
  const anyCustomerDecision = ticket.messages.some(
    (m) =>
      !m.isFromStaff && messageBodyHasMerchandisePriceDecision(m.body),
  );

  const reconciliation =
    await getMerchandiseReconciliationAwaitingDecisionByTicket({
      supportTicketId: parsed.data.ticketId,
      clerkUserId: gate.userId,
    });
  // Do not fall back to any other open recon for this user — that would mix
  // batch and standalone product dialogues.
  const canDecide =
    hasUnansweredPrompt ||
    (Boolean(reconciliation) && !anyCustomerDecision);
  if (!canDecide) {
    return {
      ok: false,
      message:
        anyCustomerDecision ?
          "Your decision is already recorded in this conversation."
        : "No open purchase-price decision is waiting on this conversation.",
    };
  }

  const decision = parsed.data.decision as MerchandisePriceDecision;
  const note = parsed.data.note?.trim() ?? "";
  const imageUrls = normalizeSupportTicketImageUrls(parsed.data.imageUrls);
  const decisionBlock = formatMerchandisePriceDecisionThreadMessage(decision);
  const body =
    note.length > 0 ? `${decisionBlock}\n\nCustomer note:\n${note}` : decisionBlock;

  try {
    await appendSupportTicketMessage({
      ticketId: parsed.data.ticketId,
      senderClerkUserId: gate.userId,
      isFromStaff: false,
      body,
      imageUrls,
      nextStatus: "awaiting_staff",
    });
    // Keep admin Order-products dialogue pointed at the thread with this decision.
    await linkOpenMerchandiseReconciliationsToSupportTicket({
      clerkUserId: gate.userId,
      supportTicketId: parsed.data.ticketId,
    });
    revalidatePath(DASHBOARD_SUPPORT_ROUTES.inbox);
    revalidatePath(DASHBOARD_SUPPORT_ROUTES.history);
    revalidatePath(DASHBOARD_SUPPORT_ROUTES.ticket(parsed.data.ticketId));
    revalidatePath("/admin/support");
    revalidatePath("/admin/orders");
    return {
      ok: true,
      message:
        decision === "topup" ?
          "Recorded: pay the difference (top-up)."
        : "Recorded: cancel for a refund.",
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Could not record your decision.",
    };
  }
}
