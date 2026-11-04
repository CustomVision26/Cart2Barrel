"use client";

import { useAdminCustomerFilter } from "@/components/admin/admin-customer-filter-provider";
import { buttonVariants } from "@/components/ui/button";
import { adminListQuotesHref } from "@/lib/shopping-list-quote";
import { cn } from "@/lib/utils";

export function AdminShoppingListPriceLink({
  batchSessionId,
  label = "Price list",
}: {
  batchSessionId: string;
  label?: string;
}) {
  const { hrefWithFilter } = useAdminCustomerFilter();
  const href = hrefWithFilter(adminListQuotesHref({ batchSessionId }));

  return (
    <a
      href={href}
      className={cn(buttonVariants({ size: "sm" }))}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
}
