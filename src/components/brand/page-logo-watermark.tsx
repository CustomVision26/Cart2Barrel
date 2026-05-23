import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import { cn } from "@/lib/utils";

type PageLogoWatermarkProps = {
  className?: string;
};

/** Centered, greyed brand mark behind page content (non-interactive). */
export function PageLogoWatermark({ className }: PageLogoWatermarkProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 z-[2] flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <BrandLogoImage variant="watermark" />
    </div>
  );
}
