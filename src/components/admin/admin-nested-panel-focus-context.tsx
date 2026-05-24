"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import { adminParentControlsDisabledClass } from "@/lib/admin-parent-controls-disabled";
import { cn } from "@/lib/utils";

type AdminNestedPanelFocusContextValue = {
  nestedPanelActive: boolean;
  setNestedPanelActive: (active: boolean) => void;
};

const AdminNestedPanelFocusContext =
  createContext<AdminNestedPanelFocusContextValue | null>(null);

export function AdminNestedPanelFocusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [nestedPanelActive, setNestedPanelActive] = useState(false);

  return (
    <AdminNestedPanelFocusContext.Provider
      value={{ nestedPanelActive, setNestedPanelActive }}
    >
      {children}
    </AdminNestedPanelFocusContext.Provider>
  );
}

/** No-op when used outside a provider (safe for tables that manage focus locally). */
export function useAdminNestedPanelFocus(): AdminNestedPanelFocusContextValue {
  const ctx = useContext(AdminNestedPanelFocusContext);
  return (
    ctx ?? {
      nestedPanelActive: false,
      setNestedPanelActive: () => {},
    }
  );
}

export function AdminParentControlsShell({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  /** When omitted, reads nestedPanelActive from context. */
  disabled?: boolean;
}) {
  const { nestedPanelActive } = useAdminNestedPanelFocus();
  const isDisabled = disabled ?? nestedPanelActive;

  return (
    <div
      className={cn(adminParentControlsDisabledClass(isDisabled), className)}
      aria-hidden={isDisabled || undefined}
    >
      {children}
    </div>
  );
}
