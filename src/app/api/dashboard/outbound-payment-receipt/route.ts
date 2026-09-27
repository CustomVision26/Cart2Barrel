import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getOutboundOffPlatformReceiptPdfPayload } from "@/data/outbound-off-platform-receipt-pdf";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { renderOutboundPaymentReceiptPdf } from "@/lib/invoice/render-outbound-payment-receipt-pdf";

export const runtime = "nodejs";

const querySchema = z.object({
  chargeId: z.string().uuid(),
});

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const parsed = querySchema.safeParse({
    chargeId: new URL(request.url).searchParams.get("chargeId")?.trim(),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid receipt." }, { status: 400 });
  }

  const clerkUserId = user.id;
  const asAdmin = isClerkAdmin(user);
  const payload = await getOutboundOffPlatformReceiptPdfPayload({
    chargeId: parsed.data.chargeId,
    clerkUserId: asAdmin ? undefined : clerkUserId,
  });
  if (!payload) {
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  let pdf: Buffer;
  try {
    pdf = await renderOutboundPaymentReceiptPdf(payload);
  } catch (error) {
    console.error(
      "[Amani Cart2Barrel] outbound payment receipt PDF render failed:",
      error,
    );
    return NextResponse.json(
      { error: "Could not generate the PDF receipt." },
      { status: 500 },
    );
  }

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${payload.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
