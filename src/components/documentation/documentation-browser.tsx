"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { DocumentationSectionPanel } from "@/components/documentation/documentation-section-panel";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocumentationSection } from "@/lib/documentation-types";

function matchesSearch(section: DocumentationSection, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    section.title,
    section.category,
    section.quickReference.summary,
    section.quickReference.location,
    ...section.quickReference.bullets,
    ...section.article.overview,
    ...section.article.walkthrough,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

type DocumentationBrowserProps = {
  sections: DocumentationSection[];
  categories: readonly string[];
  variant?: "page" | "dialog";
  className?: string;
  searchPlaceholder?: string;
};

export function DocumentationBrowser({
  sections,
  categories,
  variant = "page",
  className,
  searchPlaceholder = "Search topics, pages, or features…",
}: DocumentationBrowserProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(
    () => sections.filter((section) => matchesSearch(section, search)),
    [sections, search],
  );

  const activeSection = useMemo(() => {
    const fromFiltered = filteredSections.find((section) => section.id === activeId);
    if (fromFiltered) return fromFiltered;
    return filteredSections[0] ?? sections[0];
  }, [activeId, filteredSections, sections]);

  const sectionsByCategory = useMemo(() => {
    const map = new Map<string, DocumentationSection[]>();
    for (const category of categories) {
      map.set(
        category,
        filteredSections.filter((section) => section.category === category),
      );
    }
    return map;
  }, [categories, filteredSections]);

  const isPage = variant === "page";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        isPage &&
          "min-h-[min(72vh,52rem)] overflow-hidden rounded-xl border border-border/80 bg-card/40 shadow-sm ring-1 ring-border/50",
        className,
      )}
    >
      <div
        className={cn(
          "border-b border-border/80 bg-muted/20 px-4 py-3 sm:px-5",
          isPage && "sm:py-4",
        )}
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 bg-background pl-9"
            aria-label="Search documentation"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav
          className={cn(
            "shrink-0 overflow-y-auto border-b border-border/80 bg-muted/30 lg:w-64 lg:border-b-0 lg:border-r",
            isPage ? "max-h-[34vh] lg:max-h-none" : "max-h-[30vh] sm:max-h-none sm:w-60",
          )}
          aria-label="Documentation topics"
        >
          <div className="space-y-4 p-3">
            {filteredSections.length === 0 ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                No topics match your search.
              </p>
            ) : null}
            {categories.map((category) => {
              const categorySections = sectionsByCategory.get(category) ?? [];
              if (categorySections.length === 0) return null;
              return (
                <div key={category} className="space-y-1">
                  <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {category}
                  </p>
                  <ul className="space-y-0.5">
                    {categorySections.map((section) => {
                      const selected = section.id === activeSection?.id;
                      return (
                        <li key={section.id}>
                          <button
                            type="button"
                            onClick={() => setActiveId(section.id)}
                            className={cn(
                              "w-full rounded-lg px-2.5 py-2 text-left transition-colors",
                              selected
                                ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-primary/25"
                                : "text-muted-foreground hover:bg-card hover:text-foreground",
                            )}
                          >
                            <span className="block text-sm leading-snug">
                              {section.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/80">
                              {section.quickReference.summary}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto bg-background/50 p-4 sm:p-6">
          {activeSection ? (
            <DocumentationSectionPanel key={activeSection.id} section={activeSection} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
