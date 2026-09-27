import { ContactUsDialog } from "@/components/support/contact-us-dialog";
import { buttonVariants } from "@/components/ui/button";
import { loadHubContactSettings } from "@/data/hub-contact-settings";
import { cn } from "@/lib/utils";

const marketingContactTriggerClass = cn(
  buttonVariants({ variant: "ghost", size: "lg" }),
);

/** Public header Contact us — hub details for guests; tickets when signed in. */
export async function MarketingContactUs({ signedIn }: { signedIn: boolean }) {
  const hubContact = await loadHubContactSettings();
  return (
    <ContactUsDialog
      hubContact={hubContact}
      allowTicketSubmit={signedIn}
      triggerClassName={marketingContactTriggerClass}
    />
  );
}
