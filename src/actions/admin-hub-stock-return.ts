"use server";

import {
  generateHubStockUsReturnLabel,
  markHubStockUsReturnReceived,
  type GenerateHubStockUsReturnLabelResult,
} from "@/data/hub-stock-us-return";
import { getClerkSessionGate } from "@/lib/clerk-session";
import {
  generateHubStockUsReturnLabelSchema,
  markHubStockUsReturnReceivedSchema,
  type GenerateHubStockUsReturnLabelInput,
  type MarkHubStockUsReturnReceivedInput,
} from "@/lib/validations/product-return-request";

export type GenerateHubStockUsReturnLabelState = GenerateHubStockUsReturnLabelResult;

export async function generateHubStockUsReturnLabelAction(
  raw: GenerateHubStockUsReturnLabelInput,
): Promise<GenerateHubStockUsReturnLabelState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "You do not have admin access." };
  }
  const parsed = generateHubStockUsReturnLabelSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const first =
      flat.customerNotes?.[0] ??
      flat.orderItemId?.[0] ??
      flat.carrier?.[0] ??
      flat.service?.[0];
    return { ok: false, message: first ?? "Invalid return label request." };
  }
  return generateHubStockUsReturnLabel({
    orderItemId: parsed.data.orderItemId,
    staffClerkUserId: gate.userId,
    customerNotes: parsed.data.customerNotes,
    carrier: parsed.data.carrier,
    service: parsed.data.service,
    cents: parsed.data.cents,
  });
}

export async function markHubStockUsReturnReceivedAction(
  raw: MarkHubStockUsReturnReceivedInput,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "You do not have admin access." };
  }
  const parsed = markHubStockUsReturnReceivedSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.flatten().fieldErrors.orderItemId?.[0] ?? "Invalid order line.",
    };
  }
  return markHubStockUsReturnReceived(parsed.data.orderItemId);
}
