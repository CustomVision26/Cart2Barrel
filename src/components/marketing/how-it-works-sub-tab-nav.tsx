"use client";

import Link from "next/link";

import { HOW_IT_WORKS_ROUTES, type HowItWorksTab } from "@/lib/how-it-works-routes";
import { cn } from "@/lib/utils";

const tabLinkClass = (selected: boolean) =>
  cn(
    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );

type HowItWorksSubTabNavProps = {
  activeTab: HowItWorksTab;
};

export function HowItWorksSubTabNav({ activeTab }: HowItWorksSubTabNavProps) {
  return (
    <div
      role="tablist"
      aria-label="How it works sections"
      className="flex flex-wrap gap-1 border-b border-border/80"
    >
      <Link
        href={HOW_IT_WORKS_ROUTES.overview}
        role="tab"
        aria-selected={activeTab === "overview"}
        className={tabLinkClass(activeTab === "overview")}
      >
        Overview
      </Link>
      <Link
        href={HOW_IT_WORKS_ROUTES.userGuide}
        role="tab"
        aria-selected={activeTab === "user-guide"}
        className={tabLinkClass(activeTab === "user-guide")}
      >
        User guide
      </Link>
    </div>
  );
}
