"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import {
  markAllUserStatusUpdateEventsRead,
  markUserStatusUpdateEventsRead,
} from "@/data/user-status-update-events";
import { getClerkSessionGate } from "@/lib/clerk-session";

const markReadSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(200),
});

export type UserStatusUpdateActionState = {
  ok: boolean;
  message?: string;
};

export async function markUserStatusUpdateEventsReadAction(
  raw: unknown,
): Promise<UserStatusUpdateActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: "You must be signed in." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = markReadSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Invalid notification selection." };
  }

  await markUserStatusUpdateEventsRead({
    clerkUserId: userId,
    eventIds: parsed.data.eventIds,
  });

  return { ok: true };
}

export async function markAllUserStatusUpdateEventsReadAction(): Promise<UserStatusUpdateActionState> {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return { ok: false, message: "You must be signed in." };
  }

  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in." };
  }

  await markAllUserStatusUpdateEventsRead(userId);
  return { ok: true };
}
