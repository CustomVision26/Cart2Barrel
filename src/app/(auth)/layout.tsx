import { AuthMarketingBackdrop } from "@/components/auth/auth-marketing-backdrop";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <AuthMarketingBackdrop />
      </div>
      <div
        className="fixed inset-0 z-[1] bg-card backdrop-blur-sm"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-full flex-1 items-center justify-center p-4 sm:p-6">
        {children}
      </div>
    </div>
  );
}
