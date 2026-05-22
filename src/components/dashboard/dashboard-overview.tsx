import { currentUser } from "@clerk/nextjs/server";
import {
  ArrowRight,
  Box,
  ClipboardList,
  Package,
  PlusCircle,
  ShoppingCart,
  Sparkles,
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
import { getProfileByClerkId } from "@/data/profiles";
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

function displayName(
  firstName: string | null | undefined,
  fullName: string | null | undefined,
): string {
  if (firstName?.trim()) return firstName.trim();
  const fromProfile = fullName?.trim();
  if (fromProfile) return fromProfile.split(/\s+/)[0] ?? fromProfile;
  return "there";
}

function StatCard({
  label,
  value,
  hint,
  href,
  highlight,
}: {
  label: string;
  value: number | string;
  hint: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card/80 p-4 shadow-sm ring-1 transition-all hover:-translate-y-0.5 hover:shadow-md",
        highlight
          ? "border-amber-500/40 ring-amber-500/25 hover:border-amber-500/55"
          : "border-border/80 ring-foreground/5 hover:border-primary/35 hover:ring-primary/15",
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
  const [stats, profile, user] = await Promise.all([
    getDashboardOverviewStats(clerkUserId),
    getProfileByClerkId(clerkUserId),
    currentUser(),
  ]);

  const name = displayName(user?.firstName, profile?.fullName ?? null);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/30 p-6 shadow-sm ring-1 ring-foreground/5 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 size-44 rounded-full bg-violet-500/10 blur-2xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              Your shopping hub
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Welcome back, {name}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Request US products, checkout when quotes are ready, and track everything
                from purchase through barrel shipping to Jamaica.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button nativeButton={false} render={<Link href={DASHBOARD_ADD_ITEM_ROUTES.productsActive} />}>
                <PlusCircle className="size-4" aria-hidden />
                Add a product
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/dashboard/cart" />}
              >
                <ShoppingCart className="size-4" aria-hidden />
                View cart
                {stats.cartItemCount > 0 ?
                  <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {stats.cartItemCount}
                  </span>
                : null}
              </Button>
            </div>
          </div>
          <div className="hidden rounded-xl border border-border/60 bg-background/50 p-4 backdrop-blur-sm lg:block lg:min-w-[14rem]">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Storefront tip
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              Batch two or more items from the same retailer to unlock bundled checkout
              estimates.
            </p>
            <Link
              href={DASHBOARD_ADD_ITEM_ROUTES.batchQuotesActive}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open batch quotes
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <DashboardRefundAwaitingBanner clerkUserId={clerkUserId} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                      "inline-flex size-10 items-center justify-center rounded-lg border border-border/60 bg-background/80",
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
                className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/35 hover:bg-muted/35"
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
