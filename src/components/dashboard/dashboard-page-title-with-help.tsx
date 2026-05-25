"use client";

import type { ReactNode } from "react";

import { AdminPageTitleWithHelp } from "@/components/admin/admin-page-title-with-help";

export function DashboardPageTitleWithHelp({
  title,
  help,
  helpLabel,
  tooltipClassName,
}: {
  title: string;
  help: ReactNode;
  helpLabel?: string;
  tooltipClassName?: string;
}) {
  return (
    <AdminPageTitleWithHelp
      title={title}
      help={help}
      helpLabel={helpLabel}
      tooltipClassName={tooltipClassName}
    />
  );
}
