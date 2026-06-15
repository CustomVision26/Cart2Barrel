"use client";

import dynamic from "next/dynamic";

const UserDocumentationDialog = dynamic(
  () =>
    import("@/components/documentation/user-documentation-dialog").then(
      (mod) => mod.UserDocumentationDialog,
    ),
  { ssr: false },
);

export function UserDocumentationDialogLazy() {
  return <UserDocumentationDialog />;
}
