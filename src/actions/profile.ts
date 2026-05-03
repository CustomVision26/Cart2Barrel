"use server";

import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { profileFormSchema } from "@/lib/validations/profile";

export type SaveProfileState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function saveDeliveryProfileAction(
  _prev: SaveProfileState,
  formData: FormData
): Promise<SaveProfileState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to save your profile." };
  }

  const raw = {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    addressLine1: formData.get("addressLine1"),
    addressLine2: formData.get("addressLine2") || undefined,
    cityOrTown: formData.get("cityOrTown"),
    parish: formData.get("parish"),
  };

  const parsed = profileFormSchema.safeParse({
    fullName: typeof raw.fullName === "string" ? raw.fullName : "",
    phone: typeof raw.phone === "string" ? raw.phone : "",
    addressLine1: typeof raw.addressLine1 === "string" ? raw.addressLine1 : "",
    addressLine2:
      typeof raw.addressLine2 === "string" && raw.addressLine2.trim()
        ? raw.addressLine2
        : undefined,
    cityOrTown: typeof raw.cityOrTown === "string" ? raw.cityOrTown : "",
    parish: typeof raw.parish === "string" ? raw.parish : "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (typeof path === "string") {
        if (!fieldErrors[path]) fieldErrors[path] = [];
        fieldErrors[path].push(issue.message);
      }
    }
    return { ok: false, fieldErrors };
  }

  const now = new Date().toISOString();
  const db = getDb();

  await db
    .update(profiles)
    .set({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      addressLine1: parsed.data.addressLine1,
      addressLine2: parsed.data.addressLine2 ?? null,
      cityOrTown: parsed.data.cityOrTown,
      parish: parsed.data.parish,
      country: "Jamaica",
      profileCompletedAt: now,
      updatedAt: now,
    })
    .where(eq(profiles.clerkUserId, userId));

  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect("/");
}
