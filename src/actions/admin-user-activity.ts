"use server";

import { auth } from "@clerk/nextjs/server";

import {
  markAdminActivityEventsRead,
  markAllAdminActivityEventsRead,
} from "@/data/admin-user-activity-events";
import { getClerkSessionGate } from "@/lib/clerk-session";
import { z } from "zod";

const markReadSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(200),
});

export type AdminActivityActionState = {
  ok: boolean;
  message?: string;
};

export async function markAdminActivityEventsReadAction(
  raw: unknown,
): Promise<AdminActivityActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = markReadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid notification selection." };
  }

  await markAdminActivityEventsRead({
    adminClerkUserId: userId,
    eventIds: parsed.data.eventIds,
  });

  return { ok: true };
}

export async function markAllAdminActivityEventsReadAction(): Promise<AdminActivityActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok || !gate.isAdmin) {
    return { ok: false, message: "Admin access required." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  await markAllAdminActivityEventsRead(userId);
  return { ok: true };
}
