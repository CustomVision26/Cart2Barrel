import { DashboardOrdersView } from "@/components/dashboard/dashboard-orders-view";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function DashboardOrdersHistoryPage({
  searchParams,
}: PageProps) {
  return <DashboardOrdersView mode="history" searchParams={searchParams} />;
}
