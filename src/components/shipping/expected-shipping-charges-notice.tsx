"use client";

import Link from "next/link";

import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import {
  customsClearancePolicyLabel,
  customsClearancePolicyUrl,
  EXPECTED_OUTBOUND_SHIPPING_CHARGE_ITEMS,
} from "@/lib/outbound-shipping-expected-charges";

type ExpectedShippingChargesNoticeProps = {
  destinationCountry?: string | null;
  className?: string;
  /** When false, the section starts collapsed. */
  defaultOpen?: boolean;
};

export function ExpectedShippingChargesNotice({
  destinationCountry,
  className,
  defaultOpen = false,
}: ExpectedShippingChargesNoticeProps) {
  const customsUrl = customsClearancePolicyUrl(destinationCountry);

  return (
    <CollapsibleFieldSection
      title="Charges before you receive your container"
      description="Freight, customs clearance, and related fees due before courier release"
      defaultOpen={defaultOpen}
      className={
        className ??
        "border-amber-500/25 bg-amber-500/10 shadow-none hover:bg-amber-500/15"
      }
    >
      <p className="text-sm text-muted-foreground">
        Your barrel or bin is full. Before we release it to the courier, you will
        need to pay shipping-related fees. Typical charges include:
      </p>
      <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {EXPECTED_OUTBOUND_SHIPPING_CHARGE_ITEMS.map((item) => (
          <li key={item.id}>
            <span className="font-medium text-foreground">{item.label}</span>
            {" — "}
            {item.description}
            {item.id === "customs" && customsUrl ?
              <>
                {" "}
                <Link
                  href={customsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {customsClearancePolicyLabel(destinationCountry)}
                </Link>
              </>
            : item.id === "customs" ?
              <span className="text-muted-foreground">
                {" "}
                (customs policy link will be provided for your destination country)
              </span>
            : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Continue to the <span className="font-medium text-foreground">Pricing</span>{" "}
        tab for itemized amounts and add them to your cart when staff publish your
        quote.
      </p>
    </CollapsibleFieldSection>
  );
}
