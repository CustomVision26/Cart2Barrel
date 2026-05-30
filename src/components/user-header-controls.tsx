"use client";

import dynamic from "next/dynamic";

import { ClerkUserButton } from "@/components/clerk-user-button";

const UserSettingsDialog = dynamic(
  () =>
    import("@/components/theme/user-settings-dialog").then(
      (mod) => mod.UserSettingsDialog,
    ),
  { ssr: false },
);

/** Settings control and Clerk avatar grouped for header toolbars. */
export function UserHeaderControls() {
  return (
    <div className="flex items-center gap-1">
      <UserSettingsDialog />
      <ClerkUserButton />
    </div>
  );
}
