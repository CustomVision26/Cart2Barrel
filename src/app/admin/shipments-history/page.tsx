import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";
import { AdminShipmentsTabNav } from "@/components/admin/admin-shipments-tab-nav";
import { ShippingHistoryControls } from "@/components/shipping/shipping-history-controls";
import { ShippingHistoryList } from "@/components/shipping/shipping-history-list";
import { listAdminShippingHistory } from "@/data/shipping-history";
import { parseAdminCustomerFilter } from "@/lib/admin-customer-filter";
import { ADMIN_SHIPMENTS_ROUTES } from "@/lib/admin-shipments-routes";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { parseShippingHistoryQuery } from "@/lib/shipping-history-params";
import { safeCurrentUser } from "@/lib/safe-current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminShipmentsHistoryPage({
  searchParams,
}: PageProps) {
  const cu = await safeCurrentUser();
  const admin = cu.ok && cu.user ? isClerkAdmin(cu.user) : false;
  const rawSp = (await searchParams) ?? {};
  const { clerkUserId: filterClerkUserId } = parseAdminCustomerFilter(rawSp);
  const query = parseShippingHistoryQuery(rawSp);

  const { rows, total } =
    admin ?
      await listAdminShippingHistory(filterClerkUserId, query)
    : { rows: [], total: 0 };
  const totalPages = Math.max(1, Math.ceil(total / query.ps));
  const page = Math.min(query.page, totalPages);

  return (
    <div className="space-y-8">
      <AdminPageTitleWithHelp
        title="Shipping history"
        tooltipClassName="w-80"
        help={
          <>
            Containers already shipped through Amani Cart2Barrel, across customers.
            History is a table — double-click a row or Open to see freight, broker,
            courier, receipts, and customs documents. Newest first; search, sort, and
            paginate. The header customer filter scopes the list to one shopper.
          </>
        }
      />

      <AdminShipmentsTabNav activeTab="history" />

      {!admin ?
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          You do not have admin access.
        </p>
      : (
        <>
          <ShippingHistoryControls
            query={query}
            total={total}
            page={page}
            totalPages={totalPages}
            pageSize={query.ps}
            audience="admin"
            basePath={ADMIN_SHIPMENTS_ROUTES.history}
            userId={filterClerkUserId}
          />
          <ShippingHistoryList
            rows={rows}
            audience="admin"
            emptyMessage={
              filterClerkUserId
                ? "No shipped containers for this customer yet."
                : "Containers shipped through Amani Cart2Barrel appear here with freight, broker, courier, and customs documents."
            }
          />
        </>
      )}
    </div>
  );
}
