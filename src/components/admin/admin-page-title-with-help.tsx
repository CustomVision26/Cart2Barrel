"use client";

import type { ReactNode } from "react";

import { HelpBalloon } from "@/components/ui/help-balloon";

export function AdminPageTitleWithHelp({
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
    <div className="flex flex-wrap items-center gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <HelpBalloon
        label={helpLabel ?? `About ${title}`}
        tooltipClassName={tooltipClassName}
      >
        {help}
      </HelpBalloon>
    </div>
  );
}
