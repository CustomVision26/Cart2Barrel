"use client";

import {
  BookMarked,
  CheckCircle2,
  CircleAlert,
  ListChecks,
  MapPin,
  ScrollText,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { DocumentationSection, DocumentationView } from "@/lib/documentation-types";

type DocViewMode = DocumentationView;

function ViewToggle({
  mode,
  onChange,
}: {
  mode: DocViewMode;
  onChange: (mode: DocViewMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border/80 bg-muted/50 p-0.5"
      role="tablist"
      aria-label="Documentation view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "quick"}
        onClick={() => onChange("quick")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
          mode === "quick"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Zap className="size-3.5" aria-hidden />
        Quick reference
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "article"}
        onClick={() => onChange("article")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
          mode === "article"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ScrollText className="size-3.5" aria-hidden />
        Full article
      </button>
    </div>
  );
}

function BulletList({
  items,
  className,
}: {
  items: string[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
        >
          <span
            className="mt-2 size-1 shrink-0 rounded-full bg-primary/70"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function IconBulletList({
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
        <li
          key={item}
          className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
        >
          <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PolicyCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "neutral" | "success" | "danger" | "warning";
}) {
  if (items.length === 0) return null;

  const styles = {
    neutral: "border-border/70 bg-card/60",
    success: "border-emerald-500/25 bg-emerald-500/5",
    danger: "border-red-500/25 bg-red-500/5",
    warning: "border-amber-500/25 bg-amber-500/5",
  } as const;

  const titleStyles = {
    neutral: "text-foreground",
    success: "text-emerald-200",
    danger: "text-red-200",
    warning: "text-amber-200",
  } as const;

  const icons = {
    neutral: ListChecks,
    success: CheckCircle2,
    danger: XCircle,
    warning: CircleAlert,
  } as const;

  const iconColors = {
    neutral: "text-primary",
    success: "text-emerald-400",
    danger: "text-red-400",
    warning: "text-amber-400",
  } as const;

  const Icon = icons[tone];

  return (
    <section
      className={cn(
        "rounded-xl border p-4 shadow-sm",
        styles[tone],
      )}
    >
      <h3
        className={cn(
          "mb-3 flex items-center gap-2 text-sm font-semibold",
          titleStyles[tone],
        )}
      >
        <Icon className={cn("size-4", iconColors[tone])} aria-hidden />
        {title}
      </h3>
      <IconBulletList
        items={items}
        icon={Icon}
        iconClass={iconColors[tone]}
      />
    </section>
  );
}

function QuickReferencePanel({ section }: { section: DocumentationSection }) {
  const { quickReference: q } = section;

  return (
    <div className="space-y-5" role="tabpanel">
      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-5">
        <p className="text-base font-medium leading-relaxed text-foreground">
          {q.summary}
        </p>
        <p className="mt-3 inline-flex items-start gap-2 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Where to find it: </span>
            {q.location}
          </span>
        </p>
      </div>

      {q.bullets.length > 0 ? (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BookMarked className="size-4 text-sky-400" aria-hidden />
            At a glance
          </h3>
          <BulletList items={q.bullets} />
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PolicyCard title="Requirements" items={q.requirements} tone="warning" />
        <PolicyCard title="Do" items={q.dos} tone="success" />
      </div>

      <PolicyCard title="Do not" items={q.donts} tone="danger" />
    </div>
  );
}

function FullArticlePanel({ section }: { section: DocumentationSection }) {
  const { article } = section;

  return (
    <article className="space-y-6" role="tabpanel">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Overview
        </h3>
        {article.overview.map((paragraph) => (
          <p
            key={paragraph}
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {paragraph}
          </p>
        ))}
      </section>

      {article.walkthrough.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            How it works
          </h3>
          <ol className="space-y-3">
            {article.walkthrough.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-3"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed text-muted-foreground">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {article.notes && article.notes.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
          <h3 className="text-sm font-semibold text-sky-100">Good to know</h3>
          <BulletList items={article.notes} />
        </section>
      ) : null}

      <PolicyCard title="Requirements" items={article.requirements} tone="warning" />

      <div className="grid gap-4 lg:grid-cols-2">
        <PolicyCard title="Best practices" items={article.dos} tone="success" />
        <PolicyCard title="Common mistakes" items={article.donts} tone="danger" />
      </div>
    </article>
  );
}

export function DocumentationSectionPanel({
  section,
}: {
  section: DocumentationSection;
}) {
  const [view, setView] = useState<DocViewMode>("quick");

  return (
    <div className="space-y-5">
      <header className="space-y-3 border-b border-border/60 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/80">
          {section.category}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {section.title}
          </h2>
          <ViewToggle mode={view} onChange={setView} />
        </div>
      </header>

      {view === "quick" ? (
        <QuickReferencePanel section={section} />
      ) : (
        <FullArticlePanel section={section} />
      )}
    </div>
  );
}
