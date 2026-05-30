import {
  ArrowRight,
  Box,
  ClipboardList,
  Package,
  PlusCircle,
  ShoppingCart,
  Truck,
} from "lucide-react";
import Link from "next/link";

import { DashboardRefundAwaitingBanner } from "@/components/dashboard/dashboard-refund-awaiting-banner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDashboardOverviewStats } from "@/data/dashboard-overview";
import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    href: DASHBOARD_ADD_ITEM_ROUTES.productsActive,
    label: "Add product",
    description: "Paste a retailer URL and request a quote",
    icon: PlusCircle,
    accent: "from-sky-500/20 via-sky-500/5 to-transparent",
    iconClass: "text-sky-400",
  },
  {
    href: "/dashboard/cart",
    label: "Cart & checkout",
    description: "Review estimates and pay when ready",
    icon: ShoppingCart,
    accent: "from-amber-500/20 via-amber-500/5 to-transparent",
    iconClass: "text-amber-400",
  },
  {
    href: "/dashboard/orders",
    label: "Active orders",
    description: "Purchase, delivery, and refund status",
    icon: Package,
    accent: "from-violet-500/20 via-violet-500/5 to-transparent",
    iconClass: "text-violet-400",
  },
  {
    href: "/dashboard/barrels",
    label: "Barrels",
    description: "Pack items and prepare shipments",
    icon: Box,
    accent: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    iconClass: "text-emerald-400",
  },
] as const;

const FLOW_STEPS = [
  {
    step: "1",
    title: "Request quotes",
    detail: "Add US retailer links or browse requested items.",
    href: DASHBOARD_REQUESTED_ITEMS_ROUTE,
  },
  {
    step: "2",
    title: "Checkout",
    detail: "Approve lines in your cart and pay securely.",
    href: "/dashboard/cart",
  },
  {
    step: "3",
    title: "Track orders",
    detail: "Follow purchase, delivery, and warehouse receipt.",
    href: "/dashboard/orders",
  },
  {
    step: "4",
    title: "Ship home",
    detail: "Assign to barrels and schedule Jamaica delivery.",
    href: "/dashboard/shipping",
  },
] as const;

function StatCard({
  label,
  value,
  hint,
  href,
  highlight,
  highlightTone = "amber",
}: {
  label: string;
  value: number | string;
  hint: string;
  href: string;
  highlight?: boolean;
  highlightTone?: "amber" | "sky";
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card/80 p-4 shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md",
        !highlight &&
          "border-border/80 ring-foreground/5 hover:border-primary/35 hover:ring-primary/15",
        highlight &&
          highlightTone === "sky" &&
          "border-sky-500/40 ring-sky-500/25 hover:border-sky-500/55",
        highlight &&
          highlightTone === "amber" &&
          "border-amber-500/40 ring-amber-500/25 hover:border-amber-500/55",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-3xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground group-hover:text-foreground/80">
        {hint}
      </p>
    </Link>
  );
}

export async function DashboardOverview({ clerkUserId }: { clerkUserId: string }) {
  const stats = await getDashboardOverviewStats(clerkUserId);

  return (
    <div className="space-y-8">
      <DashboardRefundAwaitingBanner clerkUserId={clerkUserId} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Cart"
          value={stats.cartItemCount}
          hint={
            stats.cartItemCount === 1
              ? "Item ready for checkout"
              : "Items ready for checkout"
          }
          href="/dashboard/cart"
          highlight={stats.cartItemCount > 0}
        />
        <StatCard
          label="Quotes waiting"
          value={stats.quotedProductCount}
          hint="Approve estimates to add to cart"
          href={DASHBOARD_ADD_ITEM_ROUTES.productsActive}
          highlight={stats.quotedProductCount > 0}
        />
        <StatCard
          label="Awaiting inbound"
          value={stats.awaitingInboundProductCount}
          hint={
            stats.awaitingInboundProductCount === 1
              ? "Product en route to the warehouse"
              : "Products en route to the warehouse"
          }
          href="/dashboard/orders"
          highlight={stats.awaitingInboundProductCount > 0}
          highlightTone="sky"
        />
        <StatCard
          label="Need corrections"
          value={stats.needCorrectionsProductCount}
          hint="Refund, return, or receipt issues needing attention"
          href="/dashboard/orders"
          highlight={stats.needCorrectionsProductCount > 0}
        />
        <StatCard
          label="Paid orders"
          value={stats.paidOrderCount}
          hint="Purchase and fulfillment history"
          href="/dashboard/orders"
        />
        <StatCard
          label="Barrels"
          value={stats.barrelCount}
          hint="Consolidation containers on your account"
          href="/dashboard/barrels"
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Quick actions
            </h2>
            <p className="text-sm text-muted-foreground">
              Jump to the tools you use most while shopping.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                prefetch={false}
                className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm ring-1 ring-foreground/5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:ring-primary/15"
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                    action.accent,
                  )}
                />
                <div className="relative flex flex-col gap-3">
                  <span
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-lg border border-border/60 bg-card",
                      action.iconClass,
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{action.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 bg-card/90 shadow-sm ring-1 ring-foreground/5">
          <CardHeader className="border-b border-border/60">
            <CardTitle className="font-heading text-lg">How your order flows</CardTitle>
            <CardDescription>
              From product link to island delivery—each step has a home in your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
            {FLOW_STEPS.map((step) => (
              <Link
                key={step.step}
                href={step.href}
                prefetch={false}
                className="flex gap-3 rounded-lg border border-border/70 bg-muted p-3 transition-colors hover:border-primary/35 hover:bg-accent"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 font-heading text-sm font-semibold text-primary">
                  {step.step}
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex-1 border-border/80 bg-gradient-to-br from-muted/30 to-card shadow-sm ring-1 ring-foreground/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <ClipboardList className="size-5 text-primary" aria-hidden />
                Order history
              </CardTitle>
              <CardDescription>
                Full product-by-product audit trail after checkout.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                nativeButton={false}
                render={<Link href="/dashboard/orders-history" />}
              >
                Browse order history
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/90 shadow-sm ring-1 ring-foreground/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-heading text-lg">
                <Truck className="size-5 text-emerald-400" aria-hidden />
                Shipping
              </CardTitle>
              <CardDescription>
                Tracking, pricing, and your Jamaica delivery address.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                nativeButton={false}
                render={<Link href="/dashboard/shipping" />}
              >
                Open shipping center
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                nativeButton={false}
                render={<Link href="/dashboard/shipping/address" />}
              >
                Manage delivery address
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
