"use client";

import dynamic from "next/dynamic";

import type { HubContactPublic } from "@/data/hub-contact-settings";

const ContactUsDialog = dynamic(
  () =>
    import("@/components/support/contact-us-dialog").then(
      (mod) => mod.ContactUsDialog,
    ),
);

export function ContactUsDialogLazy({
  hubContact,
  allowTicketSubmit = true,
  triggerClassName,
}: {
  hubContact: HubContactPublic;
  allowTicketSubmit?: boolean;
  triggerClassName?: string;
}) {
  return (
    <ContactUsDialog
      hubContact={hubContact}
      allowTicketSubmit={allowTicketSubmit}
      triggerClassName={triggerClassName}
    />
  );
}
