"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import { UserAccountKindBadge } from "@/components/admin/user-account-kind-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { useAdminCustomerFilter } from "./admin-customer-filter-provider";

type AdminCustomerFilterProps = {
  users: AdminProfilePickerRow[];
};

export function AdminCustomerFilter({ users }: AdminCustomerFilterProps) {
  const { clerkUserId, selectedUser, setCustomer } = useAdminCustomerFilter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return users.slice(0, 50);
    }
    return users
      .filter(
        (u) =>
          u.displayName.toLowerCase().includes(q) ||
          (u.email?.toLowerCase().includes(q) ?? false) ||
          u.clerkUserId.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [users, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative min-w-0 max-w-md flex-1" ref={rootRef}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
        <label htmlFor={`${listId}-search`} className="sr-only">
          Search customer by name or email
        </label>
        <div className="relative flex min-w-0 flex-1 items-center">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 size-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={`${listId}-search`}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={
              selectedUser ?
                `${selectedUser.displayName}${selectedUser.email ? ` · ${selectedUser.email}` : ""}`
              : "Filter by name or email…"
            }
            className="h-9 pl-8 pr-8"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${listId}-listbox`}
            aria-autocomplete="list"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 size-8 shrink-0"
            aria-label={clerkUserId ? "Clear customer filter" : "Open customer list"}
            onClick={() => {
              if (clerkUserId) {
                setCustomer(null);
                setQuery("");
              } else {
                setOpen((v) => !v);
              }
            }}
          >
            {clerkUserId ?
              <XIcon className="size-4" />
            : <ChevronDownIcon className="size-4" />}
          </Button>
        </div>
      </div>

      {open ?
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!clerkUserId}
              className={cn(
                "w-full px-3 py-2 text-left text-sm hover:bg-accent",
                !clerkUserId && "bg-muted font-medium",
              )}
              onClick={() => {
                setCustomer(null);
                setQuery("");
                setOpen(false);
              }}
            >
              All customers
            </button>
          </li>
          {filteredUsers.length === 0 ?
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No customers match your search.
            </li>
          : filteredUsers.map((u) => (
              <li key={u.clerkUserId} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={u.clerkUserId === clerkUserId}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-accent",
                    u.clerkUserId === clerkUserId && "bg-muted font-medium",
                  )}
                  onClick={() => {
                    setCustomer(u.clerkUserId);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {u.displayName}
                    </span>
                    <UserAccountKindBadge kind={u.accountKind} />
                  </span>
                  {u.email ?
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {u.email}
                    </span>
                  : null}
                </button>
              </li>
            ))
          }
        </ul>
      : null}
    </div>
  );
}
