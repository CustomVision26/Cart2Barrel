import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Placeholder while Clerk sign-in / sign-up mounts (client-only). */
export function ClerkAuthFormSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[420px] space-y-4 rounded-xl bg-card p-6 shadow-xl ring-1 ring-border/60"
      aria-busy="true"
      aria-label="Loading sign-in form"
    >
      <Bar className="h-7 w-48" />
      <Bar className="h-4 w-full max-w-[280px]" />
      <Bar className="h-10 w-full" />
      <Bar className="h-px w-full" />
      <Bar className="h-10 w-full" />
      <Bar className="h-10 w-full" />
      <Bar className="h-10 w-full" />
    </div>
  );
}
