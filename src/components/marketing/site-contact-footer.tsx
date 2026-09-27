import { BrandLogoLink } from "@/components/brand/brand-logo-link";
import {
  HubContactIcons,
  hubSocialIcon,
} from "@/components/support/hub-contact-icons";
import type { HubContactPublic } from "@/data/hub-contact-settings";
import { loadHubContactSettings } from "@/data/hub-contact-settings";
import {
  googleMapsSearchUrl,
  hubContactHasPublicDetails,
} from "@/lib/hub-contact-display";
import { BRAND_NAME } from "@/lib/brand";

function SiteContactFooterView({ hubContact }: { hubContact: HubContactPublic }) {
  const year = new Date().getFullYear();
  const socials = hubContact.socialLinks.filter((link) => link.label !== "WhatsApp");
  const whatsapp = hubContact.socialLinks.find((link) => link.label === "WhatsApp");
  const hasContactBlock = Boolean(
    hubContact.businessAddress ||
      hubContact.supportEmail ||
      hubContact.supportPhone ||
      whatsapp ||
      hubContact.businessHours,
  );
  const showDetails = hubContactHasPublicDetails(hubContact);

  return (
    <footer className="mt-auto border-t border-border/80 bg-card/50">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-12">
          <div className="space-y-3">
            <BrandLogoLink />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {BRAND_NAME} consolidates your US store orders and ships them in a
              barrel, bin, or seasonal suitcase special to your delivery address.
            </p>
          </div>

          {showDetails && hasContactBlock ? (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Contact
              </h2>
              <ul className="space-y-2.5 text-sm text-foreground">
              {hubContact.businessAddress ? (
                <li>
                  <a
                    href={googleMapsSearchUrl(hubContact.businessAddress)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-2.5 hover:text-primary"
                  >
                    <HubContactIcons.MapPin
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="whitespace-pre-line leading-relaxed">
                      {hubContact.businessAddress}
                    </span>
                  </a>
                </li>
              ) : null}
              {hubContact.supportEmail ? (
                <li>
                  <a
                    href={`mailto:${hubContact.supportEmail}`}
                    className="inline-flex items-center gap-2.5 hover:text-primary"
                  >
                    <HubContactIcons.Mail
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {hubContact.supportEmail}
                  </a>
                </li>
              ) : null}
              {hubContact.supportPhone ? (
                <li>
                  <a
                    href={`tel:${hubContact.supportPhone.replace(/\s/g, "")}`}
                    className="inline-flex items-center gap-2.5 hover:text-primary"
                  >
                    <HubContactIcons.Phone
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    {hubContact.supportPhone}
                  </a>
                </li>
              ) : null}
              {whatsapp ? (
                <li>
                  <a
                    href={whatsapp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 hover:text-primary"
                  >
                    <span className="text-muted-foreground">
                      {hubSocialIcon("WhatsApp")}
                    </span>
                    WhatsApp {hubContact.whatsappNumber}
                  </a>
                </li>
              ) : null}
              {hubContact.businessHours ? (
                <li className="inline-flex items-start gap-2.5 text-muted-foreground">
                  <HubContactIcons.Clock
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <span>{hubContact.businessHours}</span>
                </li>
              ) : null}
            </ul>
            </div>
          ) : null}

          {socials.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Connect
              </h2>
              <ul className="flex flex-wrap gap-2">
                {socials.map((link) => (
                  <li key={`${link.label}-${link.url}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      title={link.label}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      {hubSocialIcon(link.label)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <p className="mt-10 border-t border-border/70 pt-4 text-xs tracking-wide text-muted-foreground">
          © {year} {BRAND_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/** Shopper footer with published hub contact details (empty fields omitted). */
export async function SiteContactFooter() {
  const hubContact = await loadHubContactSettings();
  return <SiteContactFooterView hubContact={hubContact} />;
}
