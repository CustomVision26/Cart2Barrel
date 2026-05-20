import { AdminBarrelsLayoutShell } from "@/components/admin/admin-barrels-layout-shell";

export default function AdminBarrelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminBarrelsLayoutShell>{children}</AdminBarrelsLayoutShell>;
}
