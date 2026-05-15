import type { ReactNode } from "react";

import type { StatusBadgeKind } from "@/lib/status-badge-kinds";
import { statusBadgeClassName } from "@/lib/status-badge-kinds";
import { cn } from "@/lib/utils";

export function StatusBadge({
  kind,
  children,
  className,
  title,
}: {
  kind: StatusBadgeKind;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn(statusBadgeClassName(kind), className)} title={title}>
      {children}
    </span>
  );
}
