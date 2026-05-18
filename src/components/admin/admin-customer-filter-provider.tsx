"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import {
  ADMIN_CUSTOMER_FILTER_PARAM,
  withAdminCustomerFilter,
} from "@/lib/admin-customer-filter";

type AdminCustomerFilterContextValue = {
  clerkUserId?: string;
  selectedUser?: AdminProfilePickerRow;
  setCustomer: (clerkUserId: string | null) => void;
  hrefWithFilter: (pathname: string, extraParams?: Record<string, string>) => string;
};

const AdminCustomerFilterContext =
  createContext<AdminCustomerFilterContextValue | null>(null);

export function AdminCustomerFilterProvider({
  users,
  children,
}: {
  users: AdminProfilePickerRow[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const searchParams = useSearchParams();

  const clerkUserId = useMemo(() => {
    const raw = searchParams?.get(ADMIN_CUSTOMER_FILTER_PARAM)?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  }, [searchParams]);

  const selectedUser = useMemo(
    () => users.find((u) => u.clerkUserId === clerkUserId),
    [users, clerkUserId],
  );

  const setCustomer = useCallback(
    (nextId: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (nextId) {
        params.set(ADMIN_CUSTOMER_FILTER_PARAM, nextId);
      } else {
        params.delete(ADMIN_CUSTOMER_FILTER_PARAM);
      }
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const hrefWithFilter = useCallback(
    (targetPath: string, extraParams?: Record<string, string>) => {
      const hashIdx = targetPath.indexOf("#");
      const base = hashIdx >= 0 ? targetPath.slice(0, hashIdx) : targetPath;
      const qIdx = base.indexOf("?");
      const pathOnly = qIdx >= 0 ? base.slice(0, qIdx) : base;
      const params = new URLSearchParams(
        qIdx >= 0 ? base.slice(qIdx + 1) : "",
      );
      if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
          if (value) {
            params.set(key, value);
          }
        }
      }
      if (clerkUserId) {
        params.set(ADMIN_CUSTOMER_FILTER_PARAM, clerkUserId);
      }
      const qs = params.toString();
      return qs ? `${pathOnly}?${qs}` : pathOnly;
    },
    [clerkUserId],
  );

  const value = useMemo(
    () => ({
      clerkUserId,
      selectedUser,
      setCustomer,
      hrefWithFilter,
    }),
    [clerkUserId, selectedUser, setCustomer, hrefWithFilter],
  );

  return (
    <AdminCustomerFilterContext.Provider value={value}>
      {children}
    </AdminCustomerFilterContext.Provider>
  );
}

export function useAdminCustomerFilter(): AdminCustomerFilterContextValue {
  const ctx = useContext(AdminCustomerFilterContext);
  if (!ctx) {
    throw new Error(
      "useAdminCustomerFilter must be used within AdminCustomerFilterProvider",
    );
  }
  return ctx;
}

/** Safe variant for components that may render outside the provider. */
export function useAdminCustomerFilterOptional():
  | AdminCustomerFilterContextValue
  | null {
  return useContext(AdminCustomerFilterContext);
}

export function useAdminNavHref(pathname: string): string {
  const optional = useAdminCustomerFilterOptional();
  if (!optional) {
    return pathname;
  }
  return optional.hrefWithFilter(pathname);
}

/** Preserves filter when linking from server components via client wrapper. */
export function preserveAdminCustomerFilterHref(
  href: string,
  clerkUserId?: string,
): string {
  return withAdminCustomerFilter(href, clerkUserId);
}
