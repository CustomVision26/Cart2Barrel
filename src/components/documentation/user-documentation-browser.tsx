"use client";

import { DocumentationBrowser } from "@/components/documentation/documentation-browser";
import {
  DOCUMENTATION_CATEGORIES,
  USER_DOCUMENTATION_SECTIONS,
} from "@/lib/user-documentation";

type UserDocumentationBrowserProps = {
  variant?: "page" | "dialog";
  tone?: "plain" | "hiw";
  className?: string;
};

export function UserDocumentationBrowser({
  variant = "page",
  tone = "plain",
  className,
}: UserDocumentationBrowserProps) {
  return (
    <DocumentationBrowser
      sections={USER_DOCUMENTATION_SECTIONS}
      categories={DOCUMENTATION_CATEGORIES}
      variant={variant}
      tone={tone}
      className={className}
      searchPlaceholder="Search topics, pages, or features…"
    />
  );
}
