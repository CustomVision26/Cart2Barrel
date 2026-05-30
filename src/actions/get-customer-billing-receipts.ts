"use server";

import { auth } from "@clerk/nextjs/server";

import {
  listCustomerBillingReceipts,
  type CustomerBillingReceiptRecord,
} from "@/data/customer-billing-receipts";

export type GetCustomerBillingReceiptsState =
  | { ok: true; records: CustomerBillingReceiptRecord[] }
  | { ok: false; message: string };

export async function getCustomerBillingReceiptsAction(): Promise<GetCustomerBillingReceiptsState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in to view billing receipts." };
  }

  const records = await listCustomerBillingReceipts(userId);
  return { ok: true, records };
}
