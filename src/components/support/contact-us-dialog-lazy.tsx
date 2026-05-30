"use client";

import dynamic from "next/dynamic";

import type { HubContactPublic } from "@/data/hub-contact-settings";

const ContactUsDialog = dynamic(
  () =>
    import("@/components/support/contact-us-dialog").then(
      (mod) => mod.ContactUsDialog,
    ),
  { ssr: false },
);

export function ContactUsDialogLazy({
  hubContact,
}: {
  hubContact: HubContactPublic;
}) {
  return <ContactUsDialog hubContact={hubContact} />;
}
