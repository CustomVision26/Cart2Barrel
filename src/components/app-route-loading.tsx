import { Cart2BarrelLoadingScreen } from "@/components/brand/cart2barrel-loading-screen";
import { cn } from "@/lib/utils";

export function AppRouteLoading({ className }: { className?: string }) {
  return (
    <Cart2BarrelLoadingScreen
      layout="centered"
      className={cn("min-h-[20rem]", className)}
    />
  );
}
