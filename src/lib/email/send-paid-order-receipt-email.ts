import { formatUsd } from "@/lib/admin-markup";
import { escapeHtml } from "@/lib/email/escape-html";

export type PaidOrderReceiptLine = {
  productName: string | null;
  quantity: number;
  lineTotalCents: number;
};

export type PaidOrderReceiptPayload = {
  origin: string;
  orderId: string;
  orderCreatedAt: string;
  orderTotalCents: number;
  lines: PaidOrderReceiptLine[];
  customerEmail: string;
  customerName: string | null;
};

export type PaidOrderReceiptSendResult = {
  sentAt: string | null;
  error: string | null;
};

export async function sendPaidOrderReceiptEmail(
  payload: PaidOrderReceiptPayload
): Promise<PaidOrderReceiptSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return {
      sentAt: null,
      error: !apiKey
        ? "RESEND_API_KEY is not set."
        : "RESEND_FROM_EMAIL is not set.",
    };
  }

  const linesRows = payload.lines
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.productName?.trim() || "Item")}</td><td style="text-align:right">${line.quantity}</td><td style="text-align:right">${escapeHtml(formatUsd(line.lineTotalCents))}</td></tr>`
    )
    .join("");

  const html = `
    <p>Hi${payload.customerName?.trim() ? ` ${escapeHtml(payload.customerName.trim())}` : ""},</p>
    <p>Thank you — we received your payment for the following order.</p>
    <p><strong>Order ID:</strong> ${escapeHtml(payload.orderId)}<br/>
    <strong>Date:</strong> ${escapeHtml(new Date(payload.orderCreatedAt).toLocaleString())}</p>
    <table style="border-collapse:collapse;width:100%;max-width:32rem" cellpadding="8" cellspacing="0" border="1">
      <thead><tr><th align="left">Product</th><th align="right">Qty</th><th align="right">Line total</th></tr></thead>
      <tbody>${linesRows}</tbody>
      <tfoot><tr><th align="left" colspan="2">Total paid</th><th align="right">${escapeHtml(formatUsd(payload.orderTotalCents))}</th></tr></tfoot>
    </table>
    <p>This message is your payment confirmation. Retain it for your records.</p>
    <p><a href="${escapeHtml(`${payload.origin}/dashboard/orders`)}">View orders in your account</a></p>
  `.trim();

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from,
      to: [payload.customerEmail],
      subject: `[Cart2Barrel] Payment received — order ${payload.orderId.slice(0, 8)}…`,
      html,
    });
    if (error) {
      return { sentAt: null, error: error.message };
    }
    return { sentAt: new Date().toISOString(), error: null };
  } catch (e) {
    return {
      sentAt: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
