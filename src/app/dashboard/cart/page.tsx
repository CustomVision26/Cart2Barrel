import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CartCancelHandler } from "@/components/dashboard/cart-cancel-handler";
import { CartCheckoutButton } from "@/components/dashboard/cart-checkout-button";
import { CartRemoveButton } from "@/components/dashboard/cart-remove-button";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Separator } from "@/components/ui/separator";
import { listApprovedCartLinesForUser } from "@/data/cart";
import { formatUsd } from "@/lib/admin-markup";
import { isStripeCartCheckoutConfigured } from "@/lib/stripe-server";

type PageProps = {
  searchParams?: Promise<{
    canceled?: string;
    session_id?: string;
  }>;
};

export default async function DashboardCartPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const sp = (await searchParams) ?? {};
  const canceled = sp.canceled === "1";
  const cancelSessionId =
    typeof sp.session_id === "string" && sp.session_id.length > 0
      ? sp.session_id
      : null;

  const lines = await listApprovedCartLinesForUser(userId);
  const estimatedTotalCents = lines.reduce(
    (sum, line) => sum + line.quote.totalPrice,
    0
  );

  return (
    <div className="space-y-6">
      {canceled && cancelSessionId ? (
        <CartCancelHandler checkoutSessionId={cancelSessionId} />
      ) : null}
      {canceled ? (
        <p className="text-sm text-muted-foreground">
          Checkout was canceled. Your items are still saved here when you are
          ready.
        </p>
      ) : null}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Cart
        </h1>
        <p className="text-sm text-muted-foreground">
          Items you accepted after receiving a quote. Estimated totals use the
          latest quote per item (USD). Photos come from the saved product image on your
          request (including when staff runs AI estimate); we also fall back to the
          latest estimate snapshot if needed.
        </p>
      </div>

      {lines.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Your cart is empty</CardTitle>
            <CardDescription>
              When you receive a quote on a requested item, use{" "}
              <span className="font-medium text-foreground">
                Accept estimate
              </span>{" "}
              on your requests list to add it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/items/new"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Go to your requests
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {lines.map(({ request: r, quote: q, taxCents, displayProductImageUrl }) => (
              <li key={r.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <ProductRequestThumbnail
                    variant="cart"
                    imageUrl={displayProductImageUrl}
                    productLabel={r.productName}
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-foreground">
                          {r.productName?.trim() || "Unnamed product"}
                        </p>
                        <a
                          href={r.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {r.productUrl}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          Qty {r.quantity}
                          {r.productSize?.trim()
                            ? ` · Size ${r.productSize.trim()}`
                            : ""}
                          {r.productColor?.trim()
                            ? ` · Color ${r.productColor.trim()}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-1 sm:gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatUsd(q.totalPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Line estimate
                          </p>
                        </div>
                        <CartRemoveButton itemRequestId={r.id} />
                      </div>
                    </div>
                    <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="flex justify-between gap-4 sm:block">
                    <dt>Item cost</dt>
                    <dd className="text-foreground sm:text-right">
                      {formatUsd(q.itemCost)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt>Service &amp; handling</dt>
                    <dd className="text-foreground sm:text-right">
                      {formatUsd(q.serviceFee)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt>Est. shipping</dt>
                    <dd className="text-foreground sm:text-right">
                      {formatUsd(q.estimatedShipping)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 sm:block">
                    <dt>Tax</dt>
                    <dd className="text-foreground sm:text-right">
                      {formatUsd(taxCents)}
                    </dd>
                  </div>
                    </dl>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Separator />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Estimated total</CardTitle>
              <CardDescription>
                Sum of quoted line totals. Final charge may differ at checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatUsd(estimatedTotalCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {lines.length} {lines.length === 1 ? "item" : "items"}
              </p>
              <CartCheckoutButton
                checkoutEnabled={isStripeCartCheckoutConfigured()}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
