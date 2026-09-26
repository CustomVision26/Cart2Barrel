import "server-only";

import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";

import { formatUsd } from "@/lib/admin-markup";
import { BRAND_NAME } from "@/lib/brand";
import type { OutboundOffPlatformReceiptPdfPayload } from "@/lib/invoice/outbound-payment-receipt-pdf-types";

const IMAGE_FETCH_MS = 5000;

function writeLine(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  doc.font("Helvetica").fontSize(9).fillColor("#6b7280").text(label);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text(value);
  doc.moveDown(0.45);
}

async function fetchReceiptImage(url: string | null): Promise<Buffer | null> {
  const href = url?.trim();
  if (!href || !/^https?:\/\//i.test(href)) return null;
  if (/\.pdf(?:$|\?)/i.test(href)) return null;
  try {
    const response = await fetch(href, {
      signal: AbortSignal.timeout(IMAGE_FETCH_MS),
      headers: { Accept: "image/jpeg,image/png,image/webp,image/*" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("svg") || contentType.includes("gif")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 4_000_000) return null;
    return bytes;
  } catch {
    return null;
  }
}

export async function renderOutboundPaymentReceiptPdf(
  payload: OutboundOffPlatformReceiptPdfPayload,
): Promise<Buffer> {
  const receiptImage = await fetchReceiptImage(payload.receiptUrl);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.font("Helvetica-Bold").fontSize(22).fillColor("#111111").text("Payment receipt");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text(BRAND_NAME);
    doc.moveDown(0.8);
    doc.fillColor("#111111");

    doc.font("Helvetica-Bold").fontSize(14).text(payload.headline);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4b5563")
      .text(payload.statusLabel);
    if (payload.submittedAtLabel) {
      doc.text(`Submitted ${payload.submittedAtLabel}`);
    }
    doc.fillColor("#111111").moveDown(0.8);

    const colWidth = (pageWidth - 24) / 2;
    const leftX = doc.page.margins.left;
    const rightX = leftX + colWidth + 24;
    const startY = doc.y;

    doc.x = leftX;
    doc.y = startY;
    writeLine(doc, "Vendor", payload.vendorName);
    if (payload.vendorPhone) {
      writeLine(doc, "Telephone", payload.vendorPhone);
    }
    if (payload.payIdLabel && payload.payId) {
      writeLine(doc, payload.payIdLabel, payload.payId);
    }
    if (payload.payAccount) {
      writeLine(doc, "Company account name", payload.payAccount);
    }
    const leftBottom = doc.y;

    doc.x = rightX;
    doc.y = startY;
    writeLine(doc, "Amount", formatUsd(payload.totalCents));
    if (payload.payerName) {
      writeLine(doc, "Account name", payload.payerName);
    }
    if (payload.paymentReference) {
      writeLine(doc, "Payment reference", payload.paymentReference);
    }
    const rightBottom = doc.y;

    doc.x = leftX;
    doc.y = Math.max(leftBottom, rightBottom) + 8;

    if (payload.lines.length > 1) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text("Charges");
      doc.moveDown(0.3);
      for (const line of payload.lines) {
        const y = doc.y;
        doc.font("Helvetica").fontSize(10).fillColor("#111111");
        doc.text(line.label, leftX, y, { width: pageWidth - 90 });
        doc.text(formatUsd(line.amountCents), leftX, y, {
          width: pageWidth,
          align: "right",
        });
        doc.y = y + 16;
      }
      doc.moveDown(0.4);
    }

    if (receiptImage) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text("Payment receipt");
      doc.moveDown(0.3);
      const maxHeight = 320;
      const imageY = doc.y;
      try {
        doc.image(receiptImage, leftX, imageY, {
          fit: [pageWidth, maxHeight],
          align: "center",
        });
      } catch {
        doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(
          "The submitted receipt image could not be included in this PDF.",
        );
      }
    } else if (payload.receiptUrl && /\.pdf(?:$|\?)/i.test(payload.receiptUrl)) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#4b5563")
        .text("A PDF transfer receipt was uploaded with this payment.");
    } else if (payload.methodKey === "local_office") {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#4b5563")
        .text("These charges were selected to be paid at the local office.");
    }

    doc.end();
  });
}
