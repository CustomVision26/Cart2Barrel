import { cn } from "@/lib/utils";

export function AppRouteLoading({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 animate-pulse", className)}>
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-full max-w-xl rounded-md bg-muted" />
      <div className="h-64 rounded-lg border border-border bg-muted" />
    </div>
  );
}
