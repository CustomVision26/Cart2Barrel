import {
  Cart2BarrelJourneyAnimation,
  type Cart2BarrelJourneyVariant,
} from "@/components/brand/cart2barrel-journey-animation";
import { cn } from "@/lib/utils";

type Cart2BarrelLoadingScreenProps = {
  variant?: Cart2BarrelJourneyVariant;
  layout?: "inline" | "centered" | "fullscreen";
  className?: string;
};

/** Branded loading shell for route segments and Suspense fallbacks. */
export function Cart2BarrelLoadingScreen({
  variant = "loading",
  layout = "centered",
  className,
}: Cart2BarrelLoadingScreenProps) {
  if (layout === "inline") {
    return (
      <div
        className={cn(
          "flex min-h-[14rem] items-center justify-center rounded-xl border border-border/70 bg-card/40 px-6 py-10",
          className,
        )}
      >
        <Cart2BarrelJourneyAnimation variant={variant} size="md" />
      </div>
    );
  }

  if (layout === "fullscreen") {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-background/92 backdrop-blur-md",
          className,
        )}
      >
        <Cart2BarrelJourneyAnimation variant={variant} size="lg" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-[18rem] flex-col items-center justify-center py-12",
        className,
      )}
    >
      <Cart2BarrelJourneyAnimation variant={variant} size="md" />
    </div>
  );
}
