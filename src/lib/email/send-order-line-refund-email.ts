import { formatUsd } from "@/lib/admin-markup";
import { escapeHtml } from "@/lib/email/escape-html";

export type OrderLineRefundPayload = {
  origin: string;
  customerEmail: string;
  customerName: string | null;
  orderId: string;
  productName: string | null;
  refundCents: number;
  stripeRefundId: string;
};

export async function sendOrderLineRefundEmail(
  payload: OrderLineRefundPayload
): Promise<{ ok: boolean; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Resend is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).",
    };
  }

  const label = payload.productName?.trim() || "Your item";
  const html = `
    <p>Hi${payload.customerName?.trim() ? ` ${escapeHtml(payload.customerName.trim())}` : ""},</p>
    <p>We issued a <strong>${escapeHtml(formatUsd(payload.refundCents))}</strong> refund to your original payment method for <strong>${escapeHtml(label)}</strong>.</p>
    <p><strong>Order:</strong> ${escapeHtml(payload.orderId)}<br/>
    <strong>Refund reference:</strong> ${escapeHtml(payload.stripeRefundId)}</p>
    <p>Bank processing times vary; the credit usually appears within several business days.</p>
    <p><a href="${escapeHtml(`${payload.origin}/dashboard/orders`)}">View your orders</a></p>
  `.trim();

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: [payload.customerEmail],
      subject: `[Cart2Barrel] Refund processed — ${label.replace(/\s+/g, " ").trim().slice(0, 80)}`,
      html,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
