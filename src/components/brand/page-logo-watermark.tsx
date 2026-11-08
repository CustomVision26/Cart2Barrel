import { cn } from "@/lib/utils";

type PageLogoWatermarkProps = {
  className?: string;
};

/** Intentionally empty — customer screens use a clean ivory surface. */
export function PageLogoWatermark({ className }: PageLogoWatermarkProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none hidden", className)}
    />
  );
}
