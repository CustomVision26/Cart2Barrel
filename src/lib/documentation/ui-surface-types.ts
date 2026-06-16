/** Canonical UI surface metadata — source of truth for nav labels, routes, and guide locations. */

export type UiSurfaceKind =
  | "public"
  | "sidebar"
  | "header"
  | "modal"
  | "tab"
  | "admin-sidebar"
  | "admin-header";

export type UiSurfaceDefinition = {
  /** Stable documentation id; must match a content entry. */
  id: string;
  title: string;
  category: string;
  /** Primary route or deep link for this surface. */
  route: string;
  /** Human-readable “where to find it” string shown in guides. */
  location: string;
  kind: UiSurfaceKind;
  /** Sidebar section title when kind is sidebar/admin-sidebar. */
  navSection?: string;
  /** Nav link label when shown in a menu. */
  navLabel?: string;
};

export type DocumentationContentEntry = {
  quickReference: {
    summary: string;
    bullets: string[];
    requirements: string[];
    dos: string[];
    donts: string[];
    /** Optional override; defaults to surface.location */
    location?: string;
  };
  article: {
    overview: string[];
    walkthrough: string[];
    notes?: string[];
    requirements: string[];
    dos: string[];
    donts: string[];
  };
};

export type SidebarNavLinkDefinition = {
  docId: string;
  href: string;
  label: string;
  navSection: string;
};
