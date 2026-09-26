import { ExternalLink } from "lucide-react";

import {
  customsClearancePolicyLabel,
  customsClearancePolicyUrl,
} from "@/lib/outbound-shipping-expected-charges";
import { cn } from "@/lib/utils";

export function CustomsClearancePolicyLink({
  country,
  className,
}: {
  country?: string | null;
  className?: string;
}) {
  const url = customsClearancePolicyUrl(country);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4 hover:text-primary/90",
        className,
      )}
    >
      {customsClearancePolicyLabel(country)}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
    </a>
  );
}
