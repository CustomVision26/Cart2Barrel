import { escapeHtml } from "@/lib/email/escape-html";
import {
  formatInvoiceDate,
  formatInvoiceDateTime,
  formatInvoiceMoney,
} from "@/lib/invoice/payment-invoice-format";
import type { PaymentInvoiceDocument } from "@/lib/invoice/payment-invoice-types";

function renderAddressBlock(lines: string[], email?: string | null): string {
  const body = lines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join("");
  const emailLine =
    email?.trim() ?
      `<div><a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></div>`
    : "";
  return `${body}${emailLine}`;
}

function renderLineRows(invoice: PaymentInvoiceDocument): string {
  return invoice.lines
    .map((line) => {
      const detail =
        line.detail?.trim() ?
          `<div class="line-detail">${escapeHtml(line.detail.trim())}</div>`
        : "";
      return `<tr>
        <td class="desc">
          <div class="line-title">${escapeHtml(line.description)}</div>
          ${detail}
        </td>
        <td class="num">${line.quantity}</td>
        <td class="num">${escapeHtml(formatInvoiceMoney(line.unitPriceCents))}</td>
        <td class="num">${escapeHtml(formatInvoiceMoney(line.amountCents))}</td>
      </tr>`;
    })
    .join("");
}

function renderPaymentRows(invoice: PaymentInvoiceDocument): string {
  return invoice.payments
    .map(
      (payment) => `<tr>
        <td>${escapeHtml(payment.methodLabel)}</td>
        <td>${escapeHtml(formatInvoiceDate(payment.paidAt))}</td>
        <td class="num amount-paid">${escapeHtml(formatInvoiceMoney(payment.amountCents))}</td>
        <td class="receipt-number">${escapeHtml(payment.receiptNumber)}</td>
      </tr>`,
    )
    .join("");
}

export function renderPaymentInvoiceHtml(invoice: PaymentInvoiceDocument): string {
  const companyContact = [
    invoice.company.phone?.trim() ? escapeHtml(invoice.company.phone.trim()) : null,
    invoice.company.email?.trim()
      ? `<a href="mailto:${escapeHtml(invoice.company.email.trim())}">${escapeHtml(invoice.company.email.trim())}</a>`
      : null,
  ]
    .filter(Boolean)
    .join("<br/>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt ${escapeHtml(invoice.receiptNumber)}</title>
  <style>
    :root {
      color-scheme: light;
      --text: #111111;
      --muted: #6b7280;
      --border: #111111;
      --line: #e5e7eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px 24px;
      background: #ffffff;
      color: var(--text);
      font: 14px/1.5 "Poppins", ui-sans-serif, system-ui, sans-serif;
    }
    .page {
      max-width: 760px;
      margin: 0 auto;
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .company-name {
      text-align: right;
      color: var(--muted);
      font-size: 13px;
    }
    .meta {
      display: grid;
      gap: 4px;
      margin-bottom: 28px;
      font-size: 13px;
    }
    .meta strong { font-weight: 600; }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 28px;
    }
    .block-title {
      font-weight: 700;
      margin-bottom: 8px;
    }
    .paid-summary {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 28px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      text-align: left;
      font-weight: 600;
      padding: 0 0 10px;
      border-bottom: 2px solid var(--border);
    }
    thead th.num, tbody td.num, tfoot td.num { text-align: right; }
    tbody td {
      vertical-align: top;
      padding: 14px 0;
      border-bottom: 1px solid var(--line);
    }
    .line-title { font-weight: 500; }
    .line-detail { color: var(--muted); font-size: 12px; margin-top: 4px; }
    .totals {
      width: 280px;
      margin-left: auto;
      margin-top: 8px;
    }
    .totals td {
      padding: 6px 0;
      border: 0;
    }
    .totals .label { text-align: right; padding-right: 16px; color: var(--muted); }
    .totals .value { text-align: right; font-weight: 600; }
    .totals .grand .value { font-size: 15px; }
    .section-title {
      margin: 36px 0 12px;
      font-size: 22px;
      font-weight: 700;
    }
    .payment-history-table {
      table-layout: fixed;
      width: 100%;
    }
    .payment-history-table th,
    .payment-history-table td {
      padding-right: 16px;
      overflow-wrap: anywhere;
    }
    .payment-history-table th:last-child,
    .payment-history-table td:last-child {
      padding-right: 0;
    }
    .payment-history-table .receipt-number {
      font-family: ui-monospace, monospace;
      font-size: 12px;
      word-break: break-all;
    }
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 12px;
      text-align: right;
    }
    a { color: #2563eb; text-decoration: none; }
    @media print {
      body { padding: 0; }
      .page { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="top">
      <h1>Receipt</h1>
      <div class="company-name">${escapeHtml(invoice.company.name)}</div>
    </div>

    <div class="meta">
      <div><strong>Invoice number</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
      <div><strong>Receipt number</strong> ${escapeHtml(invoice.receiptNumber)}</div>
      <div><strong>Date paid</strong> ${escapeHtml(formatInvoiceDate(invoice.datePaid))}</div>
      <div><strong>Order ID</strong> ${escapeHtml(invoice.orderId)}</div>
    </div>

    <div class="columns">
      <div>
        <div class="block-title">${escapeHtml(invoice.company.name)}</div>
        ${renderAddressBlock(invoice.company.addressLines)}
        ${companyContact ? `<div style="margin-top:8px">${companyContact}</div>` : ""}
      </div>
      <div>
        <div class="block-title">Bill to</div>
        ${renderAddressBlock(invoice.billTo.addressLines, invoice.billTo.email)}
      </div>
    </div>

    <p class="paid-summary">${escapeHtml(formatInvoiceMoney(invoice.amountPaidCents))} paid on ${escapeHtml(formatInvoiceDate(invoice.datePaid))}</p>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Unit price</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${renderLineRows(invoice)}
      </tbody>
    </table>

    <table class="totals">
      <tbody>
        <tr>
          <td class="label">Subtotal</td>
          <td class="value">${escapeHtml(formatInvoiceMoney(invoice.subtotalCents))}</td>
        </tr>
        <tr class="grand">
          <td class="label">Total</td>
          <td class="value">${escapeHtml(formatInvoiceMoney(invoice.totalCents))}</td>
        </tr>
        <tr class="grand">
          <td class="label">Amount paid</td>
          <td class="value">${escapeHtml(formatInvoiceMoney(invoice.amountPaidCents))}</td>
        </tr>
      </tbody>
    </table>

    <h2 class="section-title">Payment history</h2>
    <table class="payment-history-table">
      <colgroup>
        <col style="width: 26%" />
        <col style="width: 22%" />
        <col style="width: 18%" />
        <col style="width: 34%" />
      </colgroup>
      <thead>
        <tr>
          <th>Payment method</th>
          <th>Date</th>
          <th class="num">Amount paid</th>
          <th>Receipt number</th>
        </tr>
      </thead>
      <tbody>
        ${renderPaymentRows(invoice)}
      </tbody>
    </table>

    <div class="footer">
      Generated ${escapeHtml(formatInvoiceDateTime(new Date().toISOString()))} · Page 1 of 1
    </div>
  </div>
</body>
</html>`;
}
