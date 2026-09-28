import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ShippingHistoryControls } from "@/components/shipping/shipping-history-controls";
import { ShippingHistoryList } from "@/components/shipping/shipping-history-list";
import { listUserShippingHistory } from "@/data/shipping-history";
import { parseShippingHistoryQuery } from "@/lib/shipping-history-params";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardShippingHistoryPage({
  searchParams,
}: PageProps) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const query = parseShippingHistoryQuery((await searchParams) ?? {});
  const { rows, total } = await listUserShippingHistory(userId, query);
  const totalPages = Math.max(1, Math.ceil(total / query.ps));
  const page = Math.min(query.page, totalPages);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Shipping history
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Containers you shipped through Amani Cart2Barrel, newest first. Double-click
          a row or Open to see freight, broker, and courier details plus customs
          documents issued for that container.
        </p>
      </header>

      <ShippingHistoryControls
        query={query}
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={query.ps}
      />

      <ShippingHistoryList rows={rows} />
    </div>
  );
}
