import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Legacy alias — redirects to the Cart2Barrel payment invoice PDF. */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId." }, { status: 400 });
  }

  const target = new URL("/api/dashboard/payment-invoice", request.url);
  target.searchParams.set("orderId", orderId);
  target.searchParams.set("format", "pdf");
  target.searchParams.set("disposition", "inline");
  return NextResponse.redirect(target);
}
