import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";

import { formatUsd } from "@/lib/admin-markup";
import {
  isOutboundChargeKindAbsorbed,
  outboundChargeBundleHost,
  outboundChargeBundlePdfHeading,
} from "@/lib/barrel-outbound-shipping-charge";
import {
  barrelContentsTotalCents,
  barrelContentUnitPriceCents,
  type BarrelContentItem,
} from "@/lib/barrel-contents";
import { BRAND_LOGO_FILENAME, BRAND_NAME } from "@/lib/brand";
import { fetchPdfEmbedImage } from "@/lib/invoice/pdf-embed-image";
import type {
  CustomsClearancePackPartner,
  CustomsClearancePackPdfPayload,
} from "@/lib/invoice/customs-clearance-pack-types";

const INK = "#111827";
const MUTED = "#6b7280";
const RULE = "#111827";
const HAIR = "#d1d5db";
const LABEL = "#4b5563";
const LOGO_SIZE = 58;
const CONTAINER_PHOTO = 92;
const PRODUCT_THUMB = 44;

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function loadBrandLogo(): Buffer | null {
  const filePath = path.join(process.cwd(), "public", BRAND_LOGO_FILENAME);
  if (!existsSync(filePath)) return null;
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function rule(
  doc: PDFKit.PDFDocument,
  y: number,
  color = RULE,
  width = 1,
): void {
  const left = doc.page.margins.left;
  doc
    .moveTo(left, y)
    .lineTo(left + contentWidth(doc), y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - 64) {
    doc.addPage();
  }
}

function beginOwnPage(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  ensureSpace(doc, 36);
  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(text.toUpperCase(), {
    characterSpacing: 0.6,
  });
  rule(doc, doc.y + 3, RULE, 1.15);
  doc.moveDown(0.7);
}

function partyBlock(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  title: string,
  lines: string[],
): number {
  let cursor = y;
  if (title.trim()) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(title.toUpperCase(), x, y, {
      width,
      characterSpacing: 0.7,
    });
    cursor = y + 14;
  }
  doc.fillColor(INK);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (index === 0) {
      doc.font("Helvetica-Bold").fontSize(11).text(trimmed, x, cursor, { width });
    } else {
      doc.font("Helvetica").fontSize(9.5).text(trimmed, x, cursor, { width });
    }
    cursor = doc.y + 2;
  });
  return cursor;
}

function kvGrid(
  doc: PDFKit.PDFDocument,
  rows: Array<[string, string | null]>,
): void {
  const usable = rows.filter(([, value]) => Boolean(value?.trim()));
  if (usable.length === 0) return;
  const left = doc.page.margins.left;
  const labelWidth = 132;
  const valueWidth = contentWidth(doc) - labelWidth;
  for (const [label, value] of usable) {
    ensureSpace(doc, 18);
    const y = doc.y;
    doc.font("Helvetica").fontSize(9).fillColor(LABEL).text(label, left, y, {
      width: labelWidth - 8,
    });
    doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(value!.trim(), left + labelWidth, y, {
      width: valueWidth,
    });
    doc.y = Math.max(y + 14, doc.y) + 2;
  }
}

function chargesTable(
  doc: PDFKit.PDFDocument,
  partner: CustomsClearancePackPartner,
): void {
  if (partner.lines.length === 0) return;
  ensureSpace(doc, 40 + partner.lines.length * 18);
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const amountWidth = 90;
  const descWidth = width - amountWidth;
  let y = doc.y + 4;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
  doc.text("DESCRIPTION", left, y, { width: descWidth, characterSpacing: 0.5 });
  doc.text("AMOUNT", left, y, { width, align: "right", characterSpacing: 0.5 });
  y += 14;
  rule(doc, y, HAIR, 0.6);
  y += 8;
  doc.font("Helvetica").fontSize(10).fillColor(INK);
  for (const line of partner.lines) {
    doc.text(line.label, left, y, { width: descWidth - 8 });
    doc.text(formatUsd(line.amountCents), left, y, { width, align: "right" });
    y += 16;
  }
  rule(doc, y, RULE, 0.9);
  y += 8;
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Total", left, y, { width: descWidth - 8 });
  doc.text(formatUsd(partner.totalCents), left, y, { width, align: "right" });
  doc.y = y + 18;
}

async function drawReceipt(
  doc: PDFKit.PDFDocument,
  receiptUrl: string | null,
): Promise<void> {
  const image = await fetchPdfEmbedImage(receiptUrl, { maxEdge: 1400 });
  if (image) {
    ensureSpace(doc, 200);
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("PAYMENT RECEIPT", {
      characterSpacing: 0.5,
    });
    doc.moveDown(0.3);
    const width = contentWidth(doc);
    try {
      const imageY = doc.y;
      const leftX = doc.page.margins.left;
      doc.image(image, leftX, imageY, { fit: [width, 240] });
      doc.y = imageY + 248;
    } catch {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
        "Receipt image could not be embedded.",
      );
    }
    return;
  }
  if (receiptUrl && /\.pdf(?:$|\?)/i.test(receiptUrl)) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(MUTED)
      .text("A PDF transfer receipt is on file for this vendor.");
    doc.moveDown(0.3);
  }
}

function uniqueNotes(
  ...notes: Array<string | null | undefined>
): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of notes) {
    const trimmed = note?.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out.join("\n") : null;
}

function mergeAbsorbedPartnersIntoHost(
  host: CustomsClearancePackPartner,
  absorbed: CustomsClearancePackPartner[],
  heading: string,
): CustomsClearancePackPartner {
  if (absorbed.length === 0) return host;
  const extraLines = absorbed.flatMap((partner) => partner.lines);
  const extraTotal = absorbed.reduce(
    (sum, partner) => sum + partner.totalCents,
    0,
  );
  return {
    ...host,
    kindLabel: heading,
    lines: extraLines.length > 0 ? [...host.lines, ...extraLines] : host.lines,
    totalCents: host.totalCents + extraTotal,
    notes: uniqueNotes(host.notes, ...absorbed.map((partner) => partner.notes)),
  };
}

async function drawPartner(
  doc: PDFKit.PDFDocument,
  partner: CustomsClearancePackPartner,
  extraRows: Array<[string, string | null]> = [],
): Promise<void> {
  sectionHeading(doc, partner.kindLabel);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(partner.name);
  const locationLine = [partner.address, partner.location, partner.country]
    .map((value) => value?.trim())
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index);
  if (locationLine.length > 0) {
    doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(locationLine.join("  ·  "));
  }
  if (partner.notes?.trim()) {
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text(partner.notes.trim());
  }
  doc.moveDown(0.35);
  kvGrid(doc, [
    ["Telephone", partner.phone],
    ["Payment method", partner.paymentMethod],
    ["Paid on", formatDate(partner.paidAt)],
    ["Cash App ID", partner.cashappId],
    ["Cash App account", partner.cashappAccount],
    ["Zelle ID", partner.zelleId],
    ["Zelle account", partner.zelleAccount],
    ...extraRows,
  ]);
  chargesTable(doc, partner);
  await drawReceipt(doc, partner.receiptUrl);
}

function drawContentsTable(
  doc: PDFKit.PDFDocument,
  items: BarrelContentItem[],
  images: Array<Buffer | null>,
): void {
  sectionHeading(doc, "Container contents");
  if (items.length === 0) {
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(
      "No packed products are recorded for this container.",
    );
    return;
  }

  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const widths = [
    width * 0.36,
    width * 0.13,
    width * 0.13,
    width * 0.12,
    width * 0.1,
    width * 0.16,
  ];
  const labels = ["Product", "Size", "Color", "Units/pack", "Qty", "Amount"];
  const bottomLimit = doc.page.height - 72;

  const drawHeader = (y: number): number => {
    let x = left;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    for (const [index, label] of labels.entries()) {
      doc.text(label.toUpperCase(), x, y, {
        width: widths[index],
        align: index >= 3 ? "right" : "left",
        characterSpacing: 0.4,
      });
      x += widths[index]!;
    }
    const lineY = y + 13;
    rule(doc, lineY, RULE, 0.9);
    return lineY + 8;
  };

  let tableY = drawHeader(doc.y);
  for (const [index, item] of items.entries()) {
    const image = images[index] ?? null;
    const rowHeight = PRODUCT_THUMB + 12;
    if (tableY + rowHeight > bottomLimit) {
      doc.addPage();
      tableY = drawHeader(doc.page.margins.top);
    }

    let embedded = false;
    if (image) {
      try {
        doc.image(image, left, tableY, {
          fit: [PRODUCT_THUMB, PRODUCT_THUMB],
          align: "center",
          valign: "center",
        });
        embedded = true;
      } catch {
        embedded = false;
      }
    }
    if (!embedded) {
      doc
        .save()
        .lineWidth(0.4)
        .strokeColor(HAIR)
        .fillColor("#f3f4f6")
        .rect(left, tableY, PRODUCT_THUMB, PRODUCT_THUMB)
        .fillAndStroke()
        .restore();
    }

    const textX = left + PRODUCT_THUMB + 8;
    const nameWidth = widths[0]! - PRODUCT_THUMB - 8;

    doc.font("Helvetica").fontSize(9).fillColor(INK);
    doc.text(item.productName, textX, tableY, { width: nameWidth });
    const unitCents = barrelContentUnitPriceCents(item);
    if (unitCents != null) {
      doc
        .fontSize(8)
        .fillColor(MUTED)
        .text(`${formatUsd(unitCents)} each`, textX, doc.y, { width: nameWidth });
    }
    const nameBottom = doc.y;

    const col2 = left + widths[0]!;
    const colColor = col2 + widths[1]!;
    const colUnits = colColor + widths[2]!;
    const colQty = colUnits + widths[3]!;
    const colAmount = colQty + widths[4]!;
    doc.font("Helvetica").fontSize(9).fillColor(INK);
    doc.text(item.productSize || "—", col2, tableY, { width: widths[1] });
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

    tableY = Math.max(nameBottom, tableY + PRODUCT_THUMB) + 10;
    doc
      .moveTo(left, tableY - 6)
      .lineTo(left + width, tableY - 6)
      .lineWidth(0.4)
      .strokeColor(HAIR)
      .stroke();
  }

  if (tableY > bottomLimit - 28) {
    doc.addPage();
    tableY = doc.page.margins.top;
  }
  const totalCents = barrelContentsTotalCents(items);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(INK);
  doc.text("Total merchandise", left, tableY + 6, { width: width - 90 });
  doc.text(formatUsd(totalCents), left, tableY + 6, {
    width,
    align: "right",
  });
  doc.y = tableY + 28;
}

function drawLetterhead(
  doc: PDFKit.PDFDocument,
  payload: CustomsClearancePackPdfPayload,
  logo: Buffer | null,
  prepared: string,
): void {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const top = doc.page.margins.top;
  let logoDrawn = false;
  if (logo) {
    try {
      doc.image(logo, left, top, { fit: [LOGO_SIZE, LOGO_SIZE] });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }

  const senderX = logoDrawn ? left + LOGO_SIZE + 12 : left;
  const senderWidth = width * 0.55;
  const titleWidth = width * 0.38;
  const titleX = left + width - titleWidth;

  const senderLines = [
    payload.sender.name,
    ...payload.sender.addressLines,
    payload.sender.phone ? `Tel  ${payload.sender.phone}` : null,
    payload.sender.email ? `Email  ${payload.sender.email}` : null,
  ].filter((line): line is string => Boolean(line));

  let senderY = top;
  senderLines.forEach((line, index) => {
    if (index === 0) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(line, senderX, senderY, {
        width: senderWidth,
      });
    } else {
      doc.font("Helvetica").fontSize(9).fillColor(INK).text(line, senderX, senderY, {
        width: senderWidth,
      });
    }
    senderY = doc.y + 1;
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor(INK)
    .text("Customs Clearance Pack", titleX, top, {
      width: titleWidth,
      align: "right",
    });
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(MUTED)
    .text("Commercial shipment documentation", titleX, doc.y + 2, {
      width: titleWidth,
      align: "right",
    });
  doc.text(`Prepared ${prepared}`, titleX, doc.y + 2, {
    width: titleWidth,
    align: "right",
  });

  const headerBottom = Math.max(
    logoDrawn ? top + LOGO_SIZE : top,
    senderY,
    doc.y,
  );
  doc.y = headerBottom + 10;
  rule(doc, doc.y, RULE, 1.4);
  doc.moveDown(0.7);
}

function drawContainerIdentity(
  doc: PDFKit.PDFDocument,
  payload: CustomsClearancePackPdfPayload,
  containerImage: Buffer | null,
): void {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const startY = doc.y;
  let photoDrawn = false;
  if (containerImage) {
    try {
      doc.image(containerImage, left, startY, {
        fit: [CONTAINER_PHOTO, CONTAINER_PHOTO],
      });
      photoDrawn = true;
    } catch {
      photoDrawn = false;
    }
  }

  const textX = photoDrawn ? left + CONTAINER_PHOTO + 14 : left;
  const textWidth = photoDrawn ? width - CONTAINER_PHOTO - 14 : width;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("CONTAINER", textX, startY, {
    width: textWidth,
    characterSpacing: 0.6,
  });
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(INK)
    .text(payload.containerName, textX, doc.y + 4, { width: textWidth });
  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(INK)
    .text(payload.containerAlias, textX, doc.y + 3, { width: textWidth });
  if (payload.tracking.paymentReference?.trim()) {
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Payment ref.  ${payload.tracking.paymentReference.trim()}`, textX, doc.y + 2, {
        width: textWidth,
      });
  }
  const textBottom = doc.y;
  doc.y = Math.max(textBottom, photoDrawn ? startY + CONTAINER_PHOTO : textBottom) + 10;
}

function drawFooter(doc: PDFKit.PDFDocument, page: number): void {
  const savedX = doc.x;
  const savedY = doc.y;
  const savedBottom = doc.page.margins.bottom;
  // Footer sits in the bottom margin. Zero it so pdfkit does not add a page
  // (which would re-enter pageAdded → drawFooter and overflow the stack).
  doc.page.margins.bottom = 0;
  const y = doc.page.height - 36;
  const width = contentWidth(doc);
  try {
    rule(doc, y - 8, HAIR, 0.6);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        `${BRAND_NAME}  ·  Confidential shipment documentation`,
        doc.page.margins.left,
        y,
        { width: width - 80, lineBreak: false },
      );
    doc.text(`Page ${page}`, doc.page.margins.left, y, {
      width,
      align: "right",
      lineBreak: false,
    });
  } finally {
    doc.page.margins.bottom = savedBottom;
    doc.x = savedX;
    doc.y = savedY;
  }
}

export async function renderCustomsClearancePackPdf(
  payload: CustomsClearancePackPdfPayload,
): Promise<Buffer> {
  const customsForm = await fetchPdfEmbedImage(payload.tracking.customsFormUrl, {
    maxEdge: 1600,
  });
  const containerImage = await fetchPdfEmbedImage(payload.containerImageUrl, {
    maxEdge: 360,
    cover: true,
  });
  const productImages = await Promise.all(
    payload.contents.map((item) =>
      fetchPdfEmbedImage(item.productImageUrl, { maxEdge: 160, cover: true }),
    ),
  );
  const logo = loadBrandLogo();
  const prepared = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, left: 50, right: 50, bottom: 56 },
      info: {
        Title: "Customs Clearance Pack",
        Author: payload.sender.name,
        Subject: `${payload.containerAlias} · ${payload.containerName}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let page = 1;
    let drawingFooter = false;
    drawFooter(doc, page);
    doc.on("pageAdded", () => {
      if (drawingFooter) return;
      page += 1;
      drawingFooter = true;
      try {
        drawFooter(doc, page);
      } finally {
        drawingFooter = false;
      }
    });

    void (async () => {
      try {
        const left = doc.page.margins.left;
        const width = contentWidth(doc);

        drawLetterhead(doc, payload, logo, prepared);
        drawContainerIdentity(doc, payload, containerImage);

        const receiverLines = [
          payload.receiver.name,
          ...payload.receiver.addressLines,
          payload.receiver.phone ? `Tel  ${payload.receiver.phone}` : null,
          payload.receiver.email ? `Email  ${payload.receiver.email}` : null,
        ].filter((line): line is string => Boolean(line));
        sectionHeading(doc, "Consignee / Destination receiver");
        doc.y = partyBlock(doc, left, doc.y, width, "", receiverLines) + 4;
        doc.x = left;

        drawContentsTable(doc, payload.contents, productImages);

        if (payload.freight) {
          beginOwnPage(doc);
          const freightName = payload.tracking.freightCompanyName?.trim();
          const showFreightName =
            Boolean(freightName) &&
            freightName?.toLowerCase() !== payload.freight.name.trim().toLowerCase();
          const absorbedOnFreight: CustomsClearancePackPartner[] = [];
          if (
            payload.broker &&
            isOutboundChargeKindAbsorbed("broker", payload.chargeBundle)
          ) {
            absorbedOnFreight.push(payload.broker);
          }
          if (
            payload.courier &&
            isOutboundChargeKindAbsorbed("courier", payload.chargeBundle)
          ) {
            absorbedOnFreight.push(payload.courier);
          }
          const freightPartner =
            absorbedOnFreight.length > 0
              ? mergeAbsorbedPartnersIntoHost(
                  payload.freight,
                  absorbedOnFreight,
                  outboundChargeBundlePdfHeading(payload.chargeBundle),
                )
              : payload.freight;
          await drawPartner(doc, freightPartner, [
            ["Freight company", showFreightName ? (freightName ?? null) : null],
            ["Drop-off to freight", formatDate(payload.tracking.freightDropOffAt)],
            ["Estimated arrival", formatDate(payload.tracking.estimatedArrivalAt)],
            ["Payment reference", payload.tracking.paymentReference],
          ]);
        } else if (
          payload.tracking.freightCompanyName ||
          payload.tracking.freightDropOffAt ||
          payload.tracking.estimatedArrivalAt ||
          payload.tracking.paymentReference
        ) {
          beginOwnPage(doc);
          sectionHeading(doc, "Freight charge");
          kvGrid(doc, [
            ["Freight company", payload.tracking.freightCompanyName],
            ["Drop-off to freight", formatDate(payload.tracking.freightDropOffAt)],
            ["Estimated arrival", formatDate(payload.tracking.estimatedArrivalAt)],
            ["Payment reference", payload.tracking.paymentReference],
          ]);
        }

        if (
          payload.broker &&
          !isOutboundChargeKindAbsorbed("broker", payload.chargeBundle)
        ) {
          const brokerSharesHost =
            outboundChargeBundleHost(payload.chargeBundle) === "broker";
          if (!brokerSharesHost || !payload.freight) {
            beginOwnPage(doc);
          }
          const absorbedOnBroker: CustomsClearancePackPartner[] = [];
          if (
            payload.courier &&
            isOutboundChargeKindAbsorbed("courier", payload.chargeBundle) &&
            brokerSharesHost
          ) {
            absorbedOnBroker.push(payload.courier);
          }
          const brokerPartner =
            absorbedOnBroker.length > 0
              ? mergeAbsorbedPartnersIntoHost(
                  payload.broker,
                  absorbedOnBroker,
                  outboundChargeBundlePdfHeading(payload.chargeBundle),
                )
              : payload.broker;
          await drawPartner(doc, brokerPartner);
        }
        if (
          payload.courier &&
          !isOutboundChargeKindAbsorbed("courier", payload.chargeBundle)
        ) {
          beginOwnPage(doc);
          await drawPartner(doc, payload.courier);
        }

        if (customsForm) {
          const formHeadingHeight = 52;
          const formImageHeight = 340;
          ensureSpace(doc, formHeadingHeight + formImageHeight + 16);
          sectionHeading(doc, "Custom Clearance Form");
          try {
            const imageY = doc.y;
            doc.image(customsForm, left, imageY, { fit: [width, formImageHeight] });
            doc.y = imageY + formImageHeight + 8;
          } catch {
            doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
              "The clearance form image could not be embedded.",
            );
          }
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    })();
  });
}
