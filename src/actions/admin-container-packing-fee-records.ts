"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import {
  createContainerPackingFeeRecord,
  deleteContainerPackingFeeRecord,
  setContainerPackingFeePublished,
  updateContainerPackingFeeRecord,
} from "@/data/container-packing-fee-records";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import {
  adminCreateContainerPackingFeeRecordSchema,
  adminDeleteContainerPackingFeeRecordSchema,
  adminSetContainerPackingFeePublishedSchema,
  adminUpdateContainerPackingFeeRecordSchema,
} from "@/lib/validations/container-packing-fee-record";

export type AdminPackingFeeMutationState =
  | { ok: true; message: string }
  | { ok: false; message: string };

function revalidatePackingFeePaths() {
  revalidatePath("/admin/overview");
  revalidatePath("/how-it-works");
  revalidatePath("/dashboard/cart");
  revalidatePath("/dashboard/barrels");
}

export async function createContainerPackingFeeRecordAction(
  raw: unknown,
): Promise<AdminPackingFeeMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminCreateContainerPackingFeeRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid packing fee.",
    };
  }
  const result = await createContainerPackingFeeRecord(parsed.data);
  if (!result.ok) return result;
  revalidatePackingFeePaths();
  return { ok: true, message: "Packing fee added." };
}

export async function updateContainerPackingFeeRecordAction(
  raw: unknown,
): Promise<AdminPackingFeeMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminUpdateContainerPackingFeeRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid packing fee.",
    };
  }
  const result = await updateContainerPackingFeeRecord(parsed.data);
  if (!result.ok) return result;
  revalidatePackingFeePaths();
  return { ok: true, message: "Packing fee updated." };
}

export async function setContainerPackingFeePublishedAction(
  raw: unknown,
): Promise<AdminPackingFeeMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminSetContainerPackingFeePublishedSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid publish request.",
    };
  }
  const result = await setContainerPackingFeePublished(parsed.data);
  if (!result.ok) return result;
  revalidatePackingFeePaths();
  return {
    ok: true,
    message: parsed.data.published
      ? "Published on How it works and at checkout."
      : "Unpublished from How it works.",
  };
}

export async function deleteContainerPackingFeeRecordAction(
  raw: unknown,
): Promise<AdminPackingFeeMutationState> {
  const user = await currentUser();
  if (!isClerkAdmin(user)) {
    return { ok: false, message: "Admin access required." };
  }
  const parsed = adminDeleteContainerPackingFeeRecordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid packing fee." };
  }
  const result = await deleteContainerPackingFeeRecord(parsed.data.id);
  if (!result.ok) return result;
  revalidatePackingFeePaths();
  return { ok: true, message: "Packing fee deleted." };
}
