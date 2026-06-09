import { createRequire } from "node:module";
import path from "node:path";

import type PDFKit from "pdfkit";

/** Resolve pdfkit from project node_modules (Turbopack breaks bundled AFM font paths). */
const loadPdfKit = createRequire(path.join(process.cwd(), "package.json"));
const PDFDocument = loadPdfKit("pdfkit") as typeof import("pdfkit");

import {
  formatInvoiceDate,
  formatInvoiceMoney,
} from "@/lib/invoice/payment-invoice-format";
import type { PaymentInvoiceDocument } from "@/lib/invoice/payment-invoice-types";

function writeAddressBlock(
  doc: PDFKit.PDFDocument,
  lines: string[],
  email?: string | null,
): void {
  for (const line of lines) {
    doc.text(line, { continued: false });
  }
  if (email?.trim()) {
    doc.fillColor("#2563eb").text(email.trim(), { link: `mailto:${email.trim()}` });
    doc.fillColor("#111111");
  }
}

function renderTableHeader(
  doc: PDFKit.PDFDocument,
  columns: Array<{ label: string; width: number; align?: "left" | "right" }>,
  y: number,
  columnGap = 0,
): number {
  const startX = doc.page.margins.left;
  let x = startX;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111");
  for (const [index, column] of columns.entries()) {
    doc.text(column.label, x, y, {
      width: column.width,
      align: column.align ?? "left",
    });
    x += column.width + (index < columns.length - 1 ? columnGap : 0);
  }
  const lineY = y + 16;
  doc
    .moveTo(startX, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .lineWidth(1.5)
    .strokeColor("#111111")
    .stroke();
  return lineY + 10;
}

export async function renderPaymentInvoicePdf(
  invoice: PaymentInvoiceDocument,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rightX = doc.page.margins.left + pageWidth;

    doc.font("Helvetica-Bold").fontSize(24).text("Receipt", doc.page.margins.left, doc.y, {
      continued: false,
    });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text(invoice.company.name, doc.page.margins.left, doc.page.margins.top, {
        width: pageWidth,
        align: "right",
      });
    doc.fillColor("#111111").moveDown(1.2);

    doc.font("Helvetica").fontSize(10);
    doc.text(`Invoice number  ${invoice.invoiceNumber}`);
    doc.text(`Receipt number  ${invoice.receiptNumber}`);
    doc.text(`Date paid  ${formatInvoiceDate(invoice.datePaid)}`);
    doc.text(`Order ID  ${invoice.orderId}`);
    doc.moveDown(1.2);

    const columnTop = doc.y;
    const columnWidth = pageWidth / 2 - 12;

    doc.font("Helvetica-Bold").text(invoice.company.name, doc.page.margins.left, columnTop, {
      width: columnWidth,
    });
    doc.font("Helvetica");
    writeAddressBlock(doc, invoice.company.addressLines);
    if (invoice.company.phone?.trim()) doc.text(invoice.company.phone.trim());
    if (invoice.company.email?.trim()) {
      doc.fillColor("#2563eb").text(invoice.company.email.trim());
      doc.fillColor("#111111");
    }

    const billToX = doc.page.margins.left + columnWidth + 24;
    doc.font("Helvetica-Bold").text("Bill to", billToX, columnTop, { width: columnWidth });
    doc.font("Helvetica");
    const savedY = doc.y;
    doc.y = columnTop + 14;
    doc.x = billToX;
    writeAddressBlock(doc, invoice.billTo.addressLines, invoice.billTo.email);
    doc.x = doc.page.margins.left;
    doc.y = Math.max(savedY, doc.y) + 20;

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(
        `${formatInvoiceMoney(invoice.amountPaidCents)} paid on ${formatInvoiceDate(invoice.datePaid)}`,
      );
    doc.moveDown(1);

    const descWidth = pageWidth * 0.46;
    const qtyWidth = pageWidth * 0.12;
    const unitWidth = pageWidth * 0.2;
    const amountWidth = pageWidth * 0.22;
    const columns = [
      { label: "Description", width: descWidth },
      { label: "Qty", width: qtyWidth, align: "right" as const },
      { label: "Unit price", width: unitWidth, align: "right" as const },
      { label: "Amount", width: amountWidth, align: "right" as const },
    ];

    let tableY = renderTableHeader(doc, columns, doc.y);
    doc.font("Helvetica").fontSize(10);

    for (const line of invoice.lines) {
      if (tableY > doc.page.height - 120) {
        doc.addPage();
        tableY = renderTableHeader(doc, columns, doc.page.margins.top);
      }

      const rowStartY = tableY;
      let x = doc.page.margins.left;
      doc.text(line.description, x, rowStartY, { width: descWidth });
      const descBottom = doc.y;
      if (line.detail?.trim()) {
        doc
          .fillColor("#6b7280")
          .fontSize(9)
          .text(line.detail.trim(), x, descBottom + 2, { width: descWidth });
        doc.fillColor("#111111").fontSize(10);
      }
      const rowBottom = Math.max(descBottom, doc.y);

      doc.text(String(line.quantity), x + descWidth, rowStartY, {
        width: qtyWidth,
        align: "right",
      });
      doc.text(formatInvoiceMoney(line.unitPriceCents), x + descWidth + qtyWidth, rowStartY, {
        width: unitWidth,
        align: "right",
      });
      doc.text(
        formatInvoiceMoney(line.amountCents),
        x + descWidth + qtyWidth + unitWidth,
        rowStartY,
        { width: amountWidth, align: "right" },
      );

      tableY = rowBottom + 14;
      doc.y = tableY;
      doc
        .moveTo(doc.page.margins.left, tableY - 4)
        .lineTo(rightX, tableY - 4)
        .lineWidth(0.5)
        .strokeColor("#e5e7eb")
        .stroke();
    }

    const totalsX = rightX - 220;
    let totalsY = tableY + 8;
    doc.font("Helvetica").fontSize(10);
    const totalRows = [
      ["Subtotal", formatInvoiceMoney(invoice.subtotalCents)],
      ["Total", formatInvoiceMoney(invoice.totalCents)],
      ["Amount paid", formatInvoiceMoney(invoice.amountPaidCents)],
    ];
    for (const [label, value] of totalRows) {
      doc.text(label, totalsX, totalsY, { width: 100, align: "right" });
      doc.font("Helvetica-Bold").text(value, totalsX + 108, totalsY, {
        width: 112,
        align: "right",
      });
      doc.font("Helvetica");
      totalsY += 18;
    }

    doc.font("Helvetica-Bold").fontSize(18).text("Payment history", doc.page.margins.left, totalsY + 18);
    const paymentHeaderY = doc.y + 8;
    const payColumnGap = 12;
    const payUsableWidth = pageWidth - payColumnGap * 3;
    const payColumns = [
      { label: "Payment method", width: payUsableWidth * 0.26 },
      { label: "Date", width: payUsableWidth * 0.22 },
      { label: "Amount paid", width: payUsableWidth * 0.16, align: "right" as const },
      { label: "Receipt number", width: payUsableWidth * 0.36 },
    ];
    let paymentY = renderTableHeader(doc, payColumns, paymentHeaderY, payColumnGap);
    doc.font("Helvetica").fontSize(10);
    for (const payment of invoice.payments) {
      let x = doc.page.margins.left;
      doc.text(payment.methodLabel, x, paymentY, { width: payColumns[0]!.width });
      x += payColumns[0]!.width + payColumnGap;
      doc.text(formatInvoiceDate(payment.paidAt), x, paymentY, { width: payColumns[1]!.width });
      x += payColumns[1]!.width + payColumnGap;
      doc.text(formatInvoiceMoney(payment.amountCents), x, paymentY, {
        width: payColumns[2]!.width,
        align: "right",
      });
      x += payColumns[2]!.width + payColumnGap;
      doc
        .font("Courier")
        .fontSize(9)
        .text(payment.receiptNumber, x, paymentY, {
          width: payColumns[3]!.width,
          lineBreak: true,
        });
      doc.font("Helvetica").fontSize(10);
      paymentY += 24;
    }

    doc
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Page 1 of 1", doc.page.margins.left, doc.page.height - 40, {
        width: pageWidth,
        align: "right",
      });

    doc.end();
  });
}
