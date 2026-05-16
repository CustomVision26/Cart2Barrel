import { AdminBarrelsTabNav } from "@/components/admin/admin-barrels-tab-nav";

export default function AdminBarrelsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <AdminBarrelsTabNav />
      {children}
    </div>
  );
}
