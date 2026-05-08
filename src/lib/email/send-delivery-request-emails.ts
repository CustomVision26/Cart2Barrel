import { escapeHtml } from "@/lib/email/escape-html";

export type DeliveryEmailPayload = {
  origin: string;
  orderItemId: string;
  orderId: string;
  productName: string | null;
  productUrl: string;
  quantity: number;
  lineTotalLabel: string;
  customerClerkUserId: string;
  customerEmail: string | null;
  customerFullName: string | null;
  adminClerkUserId: string;
  adminEmail: string | null;
  adminDisplayName: string | null;
};

export function parseOpsDestinationEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export type DeliveryEmailSendResult = {
  notifiedOpsAt: string | null;
  notifiedCustomerAt: string | null;
  notifyErrors: string | null;
};

/**
 * Sends ops + optional customer notifications via Resend.
 * Missing configuration yields errors only (no throw); callers persist the row anyway.
 */
export async function sendDeliveryRequestEmails(
  payload: DeliveryEmailPayload
): Promise<DeliveryEmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const opsDestinations = parseOpsDestinationEmails(process.env.DELIVERY_OPS_EMAIL);
  const notifyCustomer = process.env.DELIVERY_NOTIFY_CUSTOMER !== "false";

  const errs: string[] = [];
  if (!apiKey) errs.push("RESEND_API_KEY is not set.");
  if (!from) errs.push("RESEND_FROM_EMAIL is not set.");
  if (opsDestinations.length === 0) errs.push("DELIVERY_OPS_EMAIL is not set.");

  if (!apiKey || !from || opsDestinations.length === 0) {
    return {
      notifiedOpsAt: null,
      notifiedCustomerAt: null,
      notifyErrors: errs.join(" "),
    };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const stamp = () => new Date().toISOString();
  let notifiedOpsAt: string | null = null;
  let notifiedCustomerAt: string | null = null;

  const productLabel =
    payload.productName?.trim() || "Ordered product";
  const adminLine =
    payload.adminDisplayName?.trim() ||
    payload.adminEmail?.trim() ||
    payload.adminClerkUserId;
  const customerLine =
    payload.customerFullName?.trim() ||
    payload.customerEmail?.trim() ||
    payload.customerClerkUserId;

  const opsHtml = `
    <p>An admin requested <strong>delivery coordination</strong> for a paid order line.</p>
    <ul>
      <li><strong>Product:</strong> ${escapeHtml(productLabel)}</li>
      <li><strong>Product URL:</strong> <a href="${escapeHtml(payload.productUrl)}">${escapeHtml(payload.productUrl)}</a></li>
      <li><strong>Quantity:</strong> ${payload.quantity}</li>
      <li><strong>Line total:</strong> ${escapeHtml(payload.lineTotalLabel)}</li>
      <li><strong>Order ID:</strong> ${escapeHtml(payload.orderId)}</li>
      <li><strong>Order item ID:</strong> ${escapeHtml(payload.orderItemId)}</li>
      <li><strong>Customer:</strong> ${escapeHtml(customerLine)} (${escapeHtml(payload.customerClerkUserId)})</li>
      <li><strong>Customer email (profile):</strong> ${escapeHtml(payload.customerEmail ?? "—")}</li>
      <li><strong>Requested by:</strong> ${escapeHtml(adminLine)} (${escapeHtml(payload.adminClerkUserId)})</li>
      <li><strong>Admin email:</strong> ${escapeHtml(payload.adminEmail ?? "—")}</li>
    </ul>
    <p><a href="${escapeHtml(`${payload.origin}/admin/orders`)}">Open admin orders</a></p>
  `.trim();

  const opsSubject = `[Cart2Barrel] Delivery requested — ${productLabel}`;

  try {
    const { error } = await resend.emails.send({
      from,
      to: opsDestinations,
      replyTo: payload.adminEmail ?? undefined,
      subject: opsSubject,
      html: opsHtml,
    });
    if (error) {
      errs.push(`Ops email failed: ${error.message}`);
    } else {
      notifiedOpsAt = stamp();
    }
  } catch (e) {
    errs.push(
      `Ops email failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  const shopperEmail = payload.customerEmail?.trim();
  if (notifyCustomer && shopperEmail) {
    const shortHtml = `
      <p>Hi${payload.customerFullName?.trim() ? ` ${escapeHtml(payload.customerFullName.trim())}` : ""},</p>
      <p>We&apos;re arranging logistics for your purchase: <strong>${escapeHtml(productLabel)}</strong>.</p>
      <p>You&apos;ll receive updates as your shipment moves through our warehouse.</p>
      <p><a href="${escapeHtml(`${payload.origin}/dashboard/orders`)}">View your orders</a></p>
    `.trim();
    try {
      const { error } = await resend.emails.send({
        from,
        to: [shopperEmail],
        replyTo: payload.adminEmail ?? undefined,
        subject: `[Cart2Barrel] We are processing delivery — ${productLabel}`,
        html: shortHtml,
      });
      if (error) {
        errs.push(`Customer email failed: ${error.message}`);
      } else {
        notifiedCustomerAt = stamp();
      }
    } catch (e) {
      errs.push(
        `Customer email failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return {
    notifiedOpsAt,
    notifiedCustomerAt,
    notifyErrors: errs.length > 0 ? errs.join(" | ") : null,
  };
}
