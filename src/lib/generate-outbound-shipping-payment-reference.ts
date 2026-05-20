import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { barrelOutboundShippingCharges } from "@/db/schema";

const REF_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REF_CHARS[bytes[i]! % REF_CHARS.length];
  }
  return out;
}

function datePart(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** Human-readable unique freight payment id, e.g. C2B-SHP-20260520-A3K9P2 */
export async function generateOutboundShippingPaymentReference(): Promise<string> {
  const db = getDb();
  const prefix = `C2B-SHP-${datePart()}-`;

  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = `${prefix}${randomSuffix(6)}`;
    const [existing] = await db
      .select({ id: barrelOutboundShippingCharges.id })
      .from(barrelOutboundShippingCharges)
      .where(eq(barrelOutboundShippingCharges.paymentReferenceNumber, candidate))
      .limit(1);
    if (!existing) {
      return candidate;
    }
  }

  return `${prefix}${randomSuffix(8)}`;
}
