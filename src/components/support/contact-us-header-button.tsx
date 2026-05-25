"use client";

import { Suspense } from "react";

import { ContactUsDialog } from "@/components/support/contact-us-dialog";

function ContactUsDialogFallback() {
  return (
    <span className="inline-flex h-9 items-center px-3 text-sm text-muted-foreground">
      Contact us
    </span>
  );
}

/** Header “Contact us” entry — requires Suspense for `useSearchParams`. */
export function ContactUsHeaderButton({
  className,
}: {
  className?: string;
}) {
  return (
    <Suspense fallback={<ContactUsDialogFallback />}>
      <ContactUsDialog triggerClassName={className} />
    </Suspense>
  );
}
