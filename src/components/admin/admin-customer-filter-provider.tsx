"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

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

function hrefWithOptionalFilter(
  targetPath: string,
  extraParams?: Record<string, string>,
  clerkUserId?: string,
): string {
  const hashIdx = targetPath.indexOf("#");
  const base = hashIdx >= 0 ? targetPath.slice(0, hashIdx) : targetPath;
  const hash = hashIdx >= 0 ? targetPath.slice(hashIdx) : "";
  const qIdx = base.indexOf("?");
  const pathOnly = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const params = new URLSearchParams(qIdx >= 0 ? base.slice(qIdx + 1) : "");
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  return withAdminCustomerFilter(
    `${pathOnly}${qs ? `?${qs}` : ""}${hash}`,
    clerkUserId,
  );
}

/**
 * Page-level client components are SSR'd as part of the page payload, not
 * nested inside the layout provider. A throw there aborts the Suspense
 * boundary and Next switches the page to client rendering.
 */
const MISSING_FILTER_CONTEXT: AdminCustomerFilterContextValue = {
  clerkUserId: undefined,
  selectedUser: undefined,
  setCustomer: () => {},
  hrefWithFilter: (targetPath, extraParams) =>
    hrefWithOptionalFilter(targetPath, extraParams),
};

export function AdminCustomerFilterProvider({
  users,
  children,
}: {
  users: AdminProfilePickerRow[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [clerkUserId, setClerkUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const read = () => {
      const raw =
        new URLSearchParams(window.location.search)
          .get(ADMIN_CUSTOMER_FILTER_PARAM)
          ?.trim() || undefined;
      setClerkUserId((prev) => (prev === raw ? prev : raw));
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const selectedUser = useMemo(
    () => users.find((u) => u.clerkUserId === clerkUserId),
    [users, clerkUserId],
  );

  const setCustomer = useCallback(
    (nextId: string | null) => {
      const next = nextId?.trim() || undefined;
      setClerkUserId((prev) => (prev === next ? prev : next));
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (next) {
        url.searchParams.set(ADMIN_CUSTOMER_FILTER_PARAM, next);
      } else {
        url.searchParams.delete(ADMIN_CUSTOMER_FILTER_PARAM);
      }
      url.searchParams.delete("page");
      const qs = url.searchParams.toString();
      router.push(`${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`);
    },
    [router],
  );

  const hrefWithFilter = useCallback(
    (targetPath: string, extraParams?: Record<string, string>) =>
      hrefWithOptionalFilter(targetPath, extraParams, clerkUserId),
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
  return useContext(AdminCustomerFilterContext) ?? MISSING_FILTER_CONTEXT;
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
