import { AdminSupportTabNav } from "@/components/admin/admin-support-tab-nav";

export default function AdminSupportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Support hub
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hub contact details for shoppers and an inbox for complaints and issues.
        </p>
      </div>
      <AdminSupportTabNav />
      {children}
    </div>
  );
}
