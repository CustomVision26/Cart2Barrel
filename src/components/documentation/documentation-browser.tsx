"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DocumentationSectionPanel } from "@/components/documentation/documentation-section-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocumentationSection, DocumentationView } from "@/lib/documentation-types";

const SPLIT_LAYOUT_QUERY = "(min-width: 1024px)";

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

function useSplitDocumentationLayout(): boolean {
  const [isSplitLayout, setIsSplitLayout] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(SPLIT_LAYOUT_QUERY);
    const sync = () => setIsSplitLayout(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isSplitLayout;
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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const isSplitLayout = useSplitDocumentationLayout();
  const contentRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

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

  const showTopicList = isSplitLayout || !mobileDetailOpen;
  const showTopicPreview = isSplitLayout || mobileDetailOpen;

  const scrollToPreview = useCallback(() => {
    requestAnimationFrame(() => {
      const target = previewRef.current ?? contentRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const selectTopic = useCallback(
    (id: string) => {
      setActiveId(id);
      if (!isSplitLayout) {
        setMobileDetailOpen(true);
        scrollToPreview();
      }
    },
    [isSplitLayout, scrollToPreview],
  );

  const handleViewChange = useCallback(
    (_mode: DocumentationView) => {
      if (!isSplitLayout) {
        scrollToPreview();
      }
    },
    [isSplitLayout, scrollToPreview],
  );

  useEffect(() => {
    if (isSplitLayout) {
      setMobileDetailOpen(false);
    }
  }, [isSplitLayout]);

  useEffect(() => {
    if (filteredSections.some((section) => section.id === activeId)) return;
    const nextId = filteredSections[0]?.id ?? sections[0]?.id ?? "";
    setActiveId(nextId);
    if (!isSplitLayout) {
      setMobileDetailOpen(false);
    }
  }, [activeId, filteredSections, isSplitLayout, sections]);

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
          !showTopicList && "lg:block",
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
            "shrink-0 overflow-y-auto border-b border-border/80 bg-muted/30 lg:w-64 lg:max-h-none lg:border-b-0 lg:border-r",
            isPage ? "max-h-none lg:max-h-none" : "max-h-none sm:w-60",
            !showTopicList && "hidden lg:block",
            showTopicList && !isSplitLayout && "min-h-[min(40vh,24rem)] flex-1 lg:min-h-0 lg:flex-none",
          )}
          aria-label="Documentation topics"
          aria-hidden={!showTopicList}
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
                            onClick={() => selectTopic(section.id)}
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

        <div
          ref={contentRef}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto bg-background/50 p-4 sm:p-6",
            !showTopicPreview && "hidden lg:block",
            showTopicPreview && !isSplitLayout && "flex-1",
          )}
          aria-hidden={!showTopicPreview}
        >
          {mobileDetailOpen && !isSplitLayout ? (
            <div className="mb-4 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setMobileDetailOpen(false)}
              >
                <ArrowLeft className="size-4" aria-hidden />
                All topics
              </Button>
            </div>
          ) : null}

          {activeSection ? (
            <div ref={previewRef}>
              <DocumentationSectionPanel
                key={activeSection.id}
                section={activeSection}
                onViewChange={handleViewChange}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
