import "server-only";

import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";

import { formatUsd } from "@/lib/admin-markup";
import {
  barrelContentsTotalCents,
  barrelContentUnitPriceCents,
  type BarrelContentItem,
  type BarrelContentsRecord,
} from "@/lib/barrel-contents";

const THUMB_SIZE = 36;
const IMAGE_FETCH_MS = 4000;

async function fetchProductImageBuffer(
  url: string | null,
): Promise<Buffer | null> {
  const href = url?.trim();
  if (!href || !/^https?:\/\//i.test(href)) return null;
  try {
    const response = await fetch(href, {
      signal: AbortSignal.timeout(IMAGE_FETCH_MS),
      headers: { Accept: "image/jpeg,image/png,image/webp,image/*" },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("svg") || contentType.includes("gif")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > 2_000_000) return null;
    return bytes;
  } catch {
    return null;
  }
}

function renderTableHeader(doc: PDFKit.PDFDocument, y: number, widths: number[]): number {
  const labels = ["Product", "Size", "Color", "Units/pack", "Qty", "Amount"];
  const startX = doc.page.margins.left;
  let x = startX;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111");
  for (const [index, label] of labels.entries()) {
    doc.text(label, x, y, {
      width: widths[index],
      align: index >= 3 ? "right" : "left",
    });
    x += widths[index]!;
  }
  const lineY = y + 14;
  doc
    .moveTo(startX, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .lineWidth(1)
    .strokeColor("#111111")
    .stroke();
  return lineY + 8;
}

export async function renderBarrelContentsPdf(
  record: BarrelContentsRecord,
): Promise<Buffer> {
  const images = await Promise.all(
    record.items.map((item) => fetchProductImageBuffer(item.productImageUrl)),
  );
  const totalCents = barrelContentsTotalCents(record.items);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const generated = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111").text("Container contents");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#6b7280")
      .text("Amani Cart2Barrel", { align: "left" });
    doc.moveDown(0.6);
    doc.fillColor("#111111").fontSize(11).font("Helvetica-Bold").text(record.containerName);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#4b5563")
      .text(`${record.containerAlias} · ${record.slotLabel}`);
    doc.text(`Generated ${generated}`);
    doc.text(`${record.items.length} product${record.items.length === 1 ? "" : "s"}`);
    doc.fillColor("#111111").moveDown(0.8);

    const widths = [
      pageWidth * 0.34,
      pageWidth * 0.14,
      pageWidth * 0.14,
      pageWidth * 0.12,
      pageWidth * 0.1,
      pageWidth * 0.16,
    ];
    let tableY = renderTableHeader(doc, doc.y, widths);
    const bottomLimit = doc.page.height - 72;

    const drawItem = (item: BarrelContentItem, image: Buffer | null) => {
      const rowHeight = image ? THUMB_SIZE + 10 : 28;
      if (tableY + rowHeight > bottomLimit) {
        doc.addPage();
        tableY = renderTableHeader(doc, doc.page.margins.top, widths);
      }

      const startX = doc.page.margins.left;
      let textX = startX;
      let nameWidth = widths[0]!;
      if (image) {
        try {
          doc.image(image, startX, tableY, {
            fit: [THUMB_SIZE, THUMB_SIZE],
            align: "center",
            valign: "center",
          });
        } catch {
          image = null;
        }
      }
      if (image) {
        textX = startX + THUMB_SIZE + 8;
        nameWidth = widths[0]! - THUMB_SIZE - 8;
      }

      doc.font("Helvetica").fontSize(9).fillColor("#111111");
      doc.text(item.productName, textX, tableY, { width: nameWidth });
      const unitCents = barrelContentUnitPriceCents(item);
      if (unitCents != null) {
        doc
          .fontSize(8)
          .fillColor("#6b7280")
          .text(`${formatUsd(unitCents)} each`, textX, doc.y, { width: nameWidth });
        doc.fillColor("#111111").fontSize(9);
      }

      const nameBottom = doc.y;
      const colSize = startX + widths[0]!;
      const colColor = colSize + widths[1]!;
      const colUnits = colColor + widths[2]!;
      const colQty = colUnits + widths[3]!;
      const colAmount = colQty + widths[4]!;
      doc.text(item.productSize || "—", colSize, tableY, {
        width: widths[1],
      });
      doc.text(item.productColor || "—", colColor, tableY, {
        width: widths[2],
      });
      doc.text(String(item.unitsPerPack), colUnits, tableY, {
        width: widths[3],
        align: "right",
      });
      doc.text(String(item.quantity), colQty, tableY, {
        width: widths[4],
        align: "right",
      });
      doc.text(formatUsd(item.linePriceCents), colAmount, tableY, {
        width: widths[5],
        align: "right",
      });

      const imageBottom = image ? tableY + THUMB_SIZE : tableY;
      tableY = Math.max(nameBottom, imageBottom) + 10;
      doc
        .moveTo(startX, tableY - 6)
        .lineTo(doc.page.width - doc.page.margins.right, tableY - 6)
        .lineWidth(0.4)
        .strokeColor("#e5e7eb")
        .stroke();
    };

    for (const [index, item] of record.items.entries()) {
      drawItem(item, images[index] ?? null);
    }

    if (tableY > bottomLimit - 24) {
      doc.addPage();
      tableY = doc.page.margins.top;
    }
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
    doc.text("Total merchandise", doc.page.margins.left, tableY + 8, {
      width: pageWidth - 120,
    });
    doc.text(formatUsd(totalCents), doc.page.margins.left, tableY + 8, {
      width: pageWidth,
      align: "right",
    });

    doc.end();
  });
}
