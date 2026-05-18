"use client";

import { XIcon } from "lucide-react";

import { UserAccountKindBadge } from "@/components/admin/user-account-kind-badge";
import { Button } from "@/components/ui/button";
import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";

export function AdminCustomerFilterBanner() {
  const { selectedUser, setCustomer } = useAdminCustomerFilter();

  if (!selectedUser) {
    return null;
  }

  return (
    <div className="border-b border-primary/30 bg-primary/10 px-4 py-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-foreground">
          Showing records for{" "}
          <span className="inline-flex items-center gap-2 font-semibold">
            {selectedUser.displayName}
            <UserAccountKindBadge kind={selectedUser.accountKind} />
          </span>
          {selectedUser.email ?
            <span className="text-muted-foreground"> · {selectedUser.email}</span>
          : null}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={() => setCustomer(null)}
        >
          <XIcon className="size-3.5" aria-hidden />
          Show all customers
        </Button>
      </div>
    </div>
  );
}
