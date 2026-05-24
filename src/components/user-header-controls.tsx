"use client";

import { ClerkUserButton } from "@/components/clerk-user-button";
import { UserSettingsDialog } from "@/components/theme/user-settings-dialog";

/** Settings control and Clerk avatar grouped for header toolbars. */
export function UserHeaderControls() {
  return (
    <div className="flex items-center gap-1">
      <UserSettingsDialog />
      <ClerkUserButton />
    </div>
  );
}
