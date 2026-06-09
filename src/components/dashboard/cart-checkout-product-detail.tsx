import { cn } from "@/lib/utils";

export function CartCheckoutProductDetail({
  detail,
  className,
}: {
  detail: string | null | undefined;
  className?: string;
}) {
  if (!detail?.trim()) return null;
  return (
    <p
      className={cn(
        "font-mono text-[11px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {detail.trim()}
    </p>
  );
}
