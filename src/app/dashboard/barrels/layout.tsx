import { DashboardBarrelsTabNav } from "@/components/dashboard/dashboard-barrels-tab-nav";

export default function DashboardBarrelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <DashboardBarrelsTabNav />
      {children}
    </div>
  );
}
