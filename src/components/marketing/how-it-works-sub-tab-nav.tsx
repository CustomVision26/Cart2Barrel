"use client";

import Link from "next/link";

import { HOW_IT_WORKS_ROUTES, type HowItWorksTab } from "@/lib/how-it-works-routes";
import { cn } from "@/lib/utils";

type HowItWorksSubTabNavProps = {
  activeTab: HowItWorksTab;
};

export function HowItWorksSubTabNav({ activeTab }: HowItWorksSubTabNavProps) {
  return (
    <div
      role="tablist"
      aria-label="How it works sections"
      className="hiw-tabs"
    >
      <Link
        href={HOW_IT_WORKS_ROUTES.overview}
        role="tab"
        aria-selected={activeTab === "overview"}
        className={cn("hiw-tab", activeTab === "overview" && "pointer-events-none")}
      >
        Overview
      </Link>
      <Link
        href={HOW_IT_WORKS_ROUTES.userGuide}
        role="tab"
        aria-selected={activeTab === "user-guide"}
        className={cn("hiw-tab", activeTab === "user-guide" && "pointer-events-none")}
      >
        User guide
      </Link>
    </div>
  );
}
