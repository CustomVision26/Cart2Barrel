import { DashboardBarrelsLayoutShell } from "@/components/dashboard/dashboard-barrels-layout-shell";

export default function DashboardBarrelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardBarrelsLayoutShell>{children}</DashboardBarrelsLayoutShell>;
}
