import { Suspense } from "react";

import {
  DashboardHeader,
  DashboardHeaderFallback,
  DashboardNavFallback,
  DashboardNavWithBadges,
} from "@/app/dashboard/_components/dashboard-layout-chrome";
import { SpecialFeaturePromoBanner } from "@/components/marketing/special-feature-promo-banner";
import { SiteContactFooter } from "@/components/marketing/site-contact-footer";
import { getClerkSessionGate } from "@/lib/clerk-session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getClerkSessionGate();
  const showAdminEntry = gate.ok && gate.isAdmin;
  const userId = gate.ok ? gate.userId : null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {userId ?
        <Suspense
          fallback={<DashboardHeaderFallback showAdminEntry={showAdminEntry} />}
        >
          <DashboardHeader
            userId={userId}
            showAdminEntry={showAdminEntry}
          />
        </Suspense>
      : <DashboardHeaderFallback showAdminEntry={false} />}

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 lg:gap-8 lg:py-8">
        {userId ?
          <Suspense fallback={<DashboardNavFallback variant="desktop" />}>
            <DashboardNavWithBadges userId={userId} variant="desktop" />
          </Suspense>
        : <DashboardNavFallback variant="desktop" />}

        <div className="min-w-0 flex-1">
          {userId ?
            <Suspense fallback={<DashboardNavFallback variant="mobile" />}>
              <DashboardNavWithBadges userId={userId} variant="mobile" />
            </Suspense>
          : <DashboardNavFallback variant="mobile" />}

          <Suspense fallback={<div className="mb-6 h-0" />}>
            <SpecialFeaturePromoBanner className="mb-6" />
          </Suspense>

          {children}
        </div>
      </div>
      <Suspense fallback={<div className="h-0" />}>
        <SiteContactFooter />
      </Suspense>
    </div>
  );
}
