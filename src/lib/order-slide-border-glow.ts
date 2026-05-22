import type { OrdersSlideLane } from "@/lib/admin-orders-slide-filters";

/** Rotating conic-gradient class for order carousel slide cards (admin + dashboard). */
export function orderSlideBorderGlowClass(lane: OrdersSlideLane): string {
  switch (lane) {
    case "awaiting_purchase":
      return "order-slide-border-glow--awaiting-purchase";
    case "need_corrections":
      return "order-slide-border-glow--need-corrections";
    case "funded":
      return "order-slide-border-glow--funded";
    default: {
      const _exhaustive: never = lane;
      return _exhaustive;
    }
  }
}

/** Inner card inset — visible animated border width. */
export const ORDER_SLIDE_BORDER_INSET = "m-2.5";
