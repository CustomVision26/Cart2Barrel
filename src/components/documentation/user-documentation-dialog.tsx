"use client";

import { BookOpen, CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DOCUMENTATION_CATEGORIES,
  USER_DOCUMENTATION_SECTIONS,
  type DocumentationSection,
} from "@/lib/user-documentation";

function PolicyList({
  items,
  icon: Icon,
  iconClass,
}: {
  items: string[];
  icon: typeof CheckCircle2;
  iconClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DocumentationSectionPanel({ section }: { section: DocumentationSection }) {
  return (
    <article className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary/80">
          {section.category}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          {section.title}
        </h2>
      </div>

      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Info className="size-4 text-sky-400" aria-hidden />
          Purpose
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{section.purpose}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">How it works</h3>
        <PolicyList items={section.howItWorks} icon={Info} iconClass="text-sky-400/90" />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Requirements</h3>
        <PolicyList
          items={section.requirements}
          icon={CircleAlert}
          iconClass="text-amber-400"
        />
      </section>

      <section className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-emerald-200">Do</h3>
        <PolicyList items={section.dos} icon={CheckCircle2} iconClass="text-emerald-400" />
      </section>

      <section className="rounded-lg border border-red-500/25 bg-red-500/5 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-red-200">Do not</h3>
        <PolicyList items={section.donts} icon={XCircle} iconClass="text-red-400" />
      </section>
    </article>
  );
}

export function UserDocumentationDialog() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(USER_DOCUMENTATION_SECTIONS[0]?.id ?? "");

  const activeSection = useMemo(
    () =>
      USER_DOCUMENTATION_SECTIONS.find((section) => section.id === activeId) ??
      USER_DOCUMENTATION_SECTIONS[0],
    [activeId],
  );

  const sectionsByCategory = useMemo(() => {
    const map = new Map<string, DocumentationSection[]>();
    for (const category of DOCUMENTATION_CATEGORIES) {
      map.set(
        category,
        USER_DOCUMENTATION_SECTIONS.filter((section) => section.category === category),
      );
    }
    return map;
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        type="button"
        className="text-sm font-medium text-foreground hover:text-primary"
      >
        Documentation
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border/80 px-4 py-4 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5 text-primary" aria-hidden />
            User guide &amp; policies
          </DialogTitle>
          <DialogDescription>
            Formal reference for every customer page, header control, and account feature.
            Read the purpose, requirements, and do&apos;s and don&apos;ts before using each
            area.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <nav
            className="max-h-[28vh] shrink-0 overflow-y-auto border-b border-border/80 bg-muted/40 sm:max-h-none sm:w-56 sm:border-b-0 sm:border-r"
            aria-label="Documentation topics"
          >
            <div className="space-y-4 p-3">
              {DOCUMENTATION_CATEGORIES.map((category) => {
                const sections = sectionsByCategory.get(category) ?? [];
                if (sections.length === 0) return null;
                return (
                  <div key={category} className="space-y-1">
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {category}
                    </p>
                    <ul className="space-y-0.5">
                      {sections.map((section) => {
                        const selected = section.id === activeId;
                        return (
                          <li key={section.id}>
                            <button
                              type="button"
                              onClick={() => setActiveId(section.id)}
                              className={cn(
                                "w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                                selected
                                  ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border/60"
                                  : "text-muted-foreground hover:bg-card hover:text-foreground",
                              )}
                            >
                              {section.title}
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

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {activeSection ? <DocumentationSectionPanel section={activeSection} /> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
