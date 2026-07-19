import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AdminLayoutFallback } from "@/app/admin/_components/admin-layout-fallback";
import { AdminLayoutWithData } from "@/app/admin/_components/admin-layout-with-data";
import { getClerkSessionGate } from "@/lib/clerk-session";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gate = await getClerkSessionGate();
  if (!gate.ok) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-6 text-center text-sm text-foreground">
          <p className="font-medium">Could not verify admin access</p>
          <p className="text-muted-foreground">{gate.message}</p>
        </div>
      </div>
    );
  }
  if (!gate.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <Suspense fallback={<AdminLayoutFallback>{children}</AdminLayoutFallback>}>
      <AdminLayoutWithData userId={gate.userId}>{children}</AdminLayoutWithData>
    </Suspense>
  );
}
