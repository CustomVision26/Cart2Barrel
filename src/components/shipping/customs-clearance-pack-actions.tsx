import { DownloadIcon, FileTextIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function customsClearancePackHref(
  barrelId: string,
  disposition: "inline" | "attachment" = "inline",
  audience: "customer" | "admin" = "customer",
): string {
  const params = new URLSearchParams({
    barrelId,
    disposition,
  });
  const base =
    audience === "admin"
      ? "/api/admin/customs-clearance-pack"
      : "/api/dashboard/customs-clearance-pack";
  return `${base}?${params.toString()}`;
}

export function CustomsClearancePackActions({
  barrelId,
  published,
  compact = false,
  audience = "customer",
}: {
  barrelId: string;
  published: boolean;
  compact?: boolean;
  audience?: "customer" | "admin";
}) {
  if (!published) {
    return (
      <p className="text-xs text-muted-foreground">
        {audience === "admin"
          ? "The customs clearance pack will appear here once it is published."
          : "Your customs clearance pack will appear here once our team publishes it."}
      </p>
    );
  }

  const size = compact ? "xs" : "sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <a
        href={customsClearancePackHref(barrelId, "inline", audience)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View customs clearance pack"
        className={cn(
          buttonVariants({ variant: "outline", size }),
          "inline-flex items-center gap-1.5",
        )}
      >
        {compact ? null : <FileTextIcon className="size-3.5" aria-hidden />}
        {compact ? "View" : "View clearance pack"}
      </a>
      <a
        href={customsClearancePackHref(barrelId, "attachment", audience)}
        aria-label="Download customs clearance pack"
        className={cn(
          buttonVariants({ variant: compact ? "outline" : "default", size }),
          "inline-flex items-center gap-1.5",
        )}
      >
        {compact ? null : <DownloadIcon className="size-3.5" aria-hidden />}
        {compact ? "Download" : "Download pack"}
      </a>
    </div>
  );
}
