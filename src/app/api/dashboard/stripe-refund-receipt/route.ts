import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getStripeRefundReceiptUrlForCustomer } from "@/data/stripe-refund-receipt-for-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const stripeRefundId = new URL(request.url).searchParams.get("stripeRefundId")?.trim();
  if (!stripeRefundId) {
    return NextResponse.json({ error: "Missing stripeRefundId." }, { status: 400 });
  }

  const result = await getStripeRefundReceiptUrlForCustomer({
    clerkUserId: userId,
    stripeRefundId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.redirect(result.receiptUrl);
}
