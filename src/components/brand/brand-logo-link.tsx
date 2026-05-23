import Link from "next/link";

import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoLinkProps = {
  /** Top-bar logo always links home unless overridden. */
  href?: string;
  className?: string;
  /** Show the Cart2Barrel wordmark beside the logo on sm+ viewports. */
  showWordmark?: boolean;
  priority?: boolean;
};

export function BrandLogoLink({
  href = "/",
  className,
  showWordmark = true,
  priority = false,
}: BrandLogoLinkProps) {
  return (
    <Link
      href={href}
      aria-label={`${BRAND_NAME} home`}
      className={cn(
        "group flex shrink-0 items-center gap-2.5 rounded-md outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      <BrandLogoImage variant="header" priority={priority} />
      {showWordmark ?
        <span className="hidden text-base font-semibold tracking-tight text-foreground sm:inline">
          {BRAND_NAME}
        </span>
      : null}
    </Link>
  );
}
