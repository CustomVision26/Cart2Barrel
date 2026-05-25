"use client";

import type { ElementType, ReactNode } from "react";

import { HelpBalloon } from "@/components/ui/help-balloon";
import { cn } from "@/lib/utils";

export function SectionTitleWithHelp({
  title,
  help,
  helpLabel,
  as: Component = "h2",
  className,
  titleClassName,
  tooltipClassName,
}: {
  title: ReactNode;
  help?: ReactNode;
  helpLabel?: string;
  as?: ElementType;
  className?: string;
  titleClassName?: string;
  tooltipClassName?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Component className={titleClassName}>{title}</Component>
      {help ?
        <HelpBalloon
          label={
            helpLabel ??
            `About ${typeof title === "string" ? title : "this section"}`
          }
          tooltipClassName={tooltipClassName}
        >
          {help}
        </HelpBalloon>
      : null}
    </div>
  );
}
