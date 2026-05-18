"use client";

import { Suspense, type ReactNode } from "react";

import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";

import { AdminCustomerFilter } from "./admin-customer-filter";
import { AdminCustomerFilterBanner } from "./admin-customer-filter-banner";
import { AdminCustomerFilterProvider } from "./admin-customer-filter-provider";

export function AdminCustomerFilterShell({
  users,
  children,
}: {
  users: AdminProfilePickerRow[];
  children: ReactNode;
}) {
  return (
    <AdminCustomerFilterProvider users={users}>
      <Suspense fallback={null}>
        <AdminCustomerFilterBanner />
      </Suspense>
      {children}
    </AdminCustomerFilterProvider>
  );
}

export function AdminCustomerFilterBar({
  users,
}: {
  users: AdminProfilePickerRow[];
}) {
  return (
    <Suspense fallback={<div className="h-9 min-w-0 flex-1" />}>
      <AdminCustomerFilter users={users} />
    </Suspense>
  );
}
