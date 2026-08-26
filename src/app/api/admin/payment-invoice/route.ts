import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getPaidOrderInvoiceForAdmin } from "@/data/customer-payment-invoice";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { renderPaymentInvoiceHtml } from "@/lib/invoice/render-payment-invoice-html";
import { renderPaymentInvoicePdf } from "@/lib/invoice/render-payment-invoice-pdf";

export const runtime = "nodejs";

function parseFormat(value: string | null): "html" | "pdf" {
  return value === "html" ? "html" : "pdf";
}

function parseDisposition(value: string | null): "inline" | "attachment" {
  return value === "attachment" ? "attachment" : "inline";
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user || !isClerkAdmin(user)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const orderId = url.searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId." }, { status: 400 });
  }

  const format = parseFormat(url.searchParams.get("format"));
  const disposition = parseDisposition(url.searchParams.get("disposition"));

  const result = await getPaidOrderInvoiceForAdmin(orderId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  const { invoice } = result;
  const filename = `receipt-${invoice.receiptNumber.replace(/[^\w.-]+/g, "-")}.pdf`;

  if (format === "html") {
    const html = renderPaymentInvoiceHtml(invoice);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  }

  let pdf: Buffer;
  try {
    pdf = await renderPaymentInvoicePdf(invoice);
  } catch (error) {
    console.error("[Cart2Barrel] admin payment-invoice PDF render failed:", error);
    return NextResponse.json(
      { error: "Could not generate PDF receipt. Try View order receipt instead." },
      { status: 500 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
