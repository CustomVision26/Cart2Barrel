import Image from "next/image";

import { BRAND_LOGO_ALT, getBrandLogoSrc } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoImageProps = {
  variant: "header" | "watermark";
  priority?: boolean;
  className?: string;
};

export function BrandLogoImage({
  variant,
  priority = false,
  className,
}: BrandLogoImageProps) {
  const isHeader = variant === "header";

  return (
    <span
      className={cn(
        "brand-logo-scene inline-block",
        isHeader ? "brand-logo-scene--header" : "brand-logo-scene--watermark",
      )}
    >
      <Image
        src={getBrandLogoSrc()}
        alt={isHeader ? BRAND_LOGO_ALT : ""}
        width={isHeader ? 220 : 672}
        height={isHeader ? 64 : 672}
        priority={priority}
        unoptimized
        sizes={isHeader ? undefined : "(max-width: 768px) 92vw, 42rem"}
        className={cn(
          "object-contain",
          isHeader ?
            "brand-logo-3d--header h-12 w-auto sm:h-14"
          : "brand-logo-watermark brand-logo-3d--watermark h-[min(92vw,42rem)] w-[min(92vw,42rem)] select-none",
          className,
        )}
      />
    </span>
  );
}
