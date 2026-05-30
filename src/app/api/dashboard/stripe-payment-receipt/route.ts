import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStripePaymentReceiptUrlForCustomer } from "@/data/stripe-payment-receipt-for-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId." }, { status: 400 });
  }

  const result = await getStripePaymentReceiptUrlForCustomer({
    clerkUserId: userId,
    orderId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.redirect(result.receiptUrl);
}
