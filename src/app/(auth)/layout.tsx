import { AuthModalShell } from "@/components/auth/auth-modal-shell";
import { HomePageContent } from "@/components/marketing/home-page-content";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="fixed inset-0 z-0 overflow-y-auto">
        <div className="pointer-events-none min-h-full" aria-hidden inert>
          <HomePageContent userId={null} />
        </div>
      </div>
      <AuthModalShell>{children}</AuthModalShell>
    </div>
  );
}
