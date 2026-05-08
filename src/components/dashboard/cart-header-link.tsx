import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { auth } from "@clerk/nextjs/server";

import { countApprovedCartItemsForUser } from "@/data/cart";

export async function CartHeaderLink() {
  const { userId } = await auth();
  const count = userId ? await countApprovedCartItemsForUser(userId) : 0;

  return (
    <Link
      href="/dashboard/cart"
      className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
    >
      <ShoppingCart className="size-5" aria-hidden />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
