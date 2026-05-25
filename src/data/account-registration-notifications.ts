import "server-only";

import {
  recordUserRegisteredActivity,
} from "@/data/admin-user-activity-events";
import { recordAccountWelcomeActivity } from "@/data/user-status-update-events";

export async function notifyOnNewUserRegistration(params: {
  clerkUserId: string;
  displayName: string | null;
  email: string | null;
}): Promise<void> {
  await Promise.all([
    recordUserRegisteredActivity({
      customerClerkUserId: params.clerkUserId,
      displayName: params.displayName,
      email: params.email,
    }),
    recordAccountWelcomeActivity({
      clerkUserId: params.clerkUserId,
      displayName: params.displayName,
    }),
  ]);
}
