"use client";

import { DocumentationBrowser } from "@/components/documentation/documentation-browser";
import {
  ADMIN_DOCUMENTATION_CATEGORIES,
  ADMIN_DOCUMENTATION_SECTIONS,
} from "@/lib/admin-documentation";

type AdminDocumentationBrowserProps = {
  variant?: "page" | "dialog";
  className?: string;
};

export function AdminDocumentationBrowser({
  variant = "page",
  className,
}: AdminDocumentationBrowserProps) {
  return (
    <DocumentationBrowser
      sections={ADMIN_DOCUMENTATION_SECTIONS}
      categories={ADMIN_DOCUMENTATION_CATEGORIES}
      variant={variant}
      className={className}
      searchPlaceholder="Search admin topics, pages, or workflows…"
    />
  );
}
