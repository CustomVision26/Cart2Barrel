import { ADMIN_GUIDE_ROUTE } from "@/lib/admin-guide-routes";
import { ADMIN_ITEM_REQUESTS_ROUTES } from "@/lib/admin-item-requests-routes";
import { ADMIN_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import type {
  SidebarNavLinkDefinition,
  UiSurfaceDefinition,
} from "@/lib/documentation/ui-surface-types";

/** Admin sidebar links — keep in sync with `admin-nav.tsx` via shared import. */
export const ADMIN_SIDEBAR_NAV_LINKS: SidebarNavLinkDefinition[] = [
  {
    docId: "overview",
    href: "/admin/overview",
    label: "Overview",
    navSection: "Commerce",
  },
  {
    docId: "item-requests-active",
    href: ADMIN_ITEM_REQUESTS_ROUTES.activeRequestsQueue,
    label: "Item requests",
    navSection: "Commerce",
  },
  {
    docId: "orders",
    href: "/admin/orders",
    label: "Orders",
    navSection: "Commerce",
  },
  {
    docId: "purchase-orders",
    href: "/admin/purchase-orders",
    label: "Purchase orders",
    navSection: "Fulfillment",
  },
  {
    docId: "packages",
    href: "/admin/packages",
    label: "Packages",
    navSection: "Fulfillment",
  },
  {
    docId: "barrels",
    href: "/admin/barrels",
    label: "Barrels",
    navSection: "Fulfillment",
  },
  {
    docId: "shipments",
    href: "/admin/shipments",
    label: "Shipments",
    navSection: "Fulfillment",
  },
  {
    docId: "spotlight",
    href: "/admin/spotlight-products",
    label: "Spotlight",
    navSection: "Catalog & team",
  },
  {
    docId: "users",
    href: "/admin/users",
    label: "Users",
    navSection: "Catalog & team",
  },
  {
    docId: "support",
    href: ADMIN_SUPPORT_ROUTES.contact,
    label: "Support",
    navSection: "Catalog & team",
  },
  {
    docId: "admin-guide",
    href: ADMIN_GUIDE_ROUTE,
    label: "Admin guide",
    navSection: "Help",
  },
];

const ADMIN_HEADER_AND_EXTRA_SURFACES: UiSurfaceDefinition[] = [
  {
    id: "admin-access",
    title: "Admin access & layout",
    category: "Getting started",
    route: "/admin",
    location: "Sidebar navigation under /admin/*; non-admins are redirected to the dashboard.",
    kind: "admin-sidebar",
  },
  {
    id: "customer-filter",
    title: "Customer filter (header)",
    category: "Header & tools",
    route: "/admin",
    location: "Admin header bar → customer picker (center of top bar).",
    kind: "admin-header",
  },
  {
    id: "admin-notifications",
    title: "Admin notifications bell",
    category: "Header & tools",
    route: "/admin",
    location: "Admin header → bell icon (left of User app).",
    kind: "admin-header",
  },
  {
    id: "item-requests-batch",
    title: "Item requests — Batch items",
    category: "Commerce",
    route: ADMIN_ITEM_REQUESTS_ROUTES.batchItemsSubmitted,
    location: "Sidebar → Item requests → Batch Items tab.",
    kind: "tab",
  },
];

function surfaceFromNavLink(link: SidebarNavLinkDefinition): UiSurfaceDefinition {
  const location =
    link.navSection === "Help"
      ? `Sidebar → ${link.navSection} → ${link.label} (${link.href}).`
      : `Sidebar → ${link.label} (${link.href}).`;

  return {
    id: link.docId,
    title: link.label,
    category: mapAdminNavSectionToDocCategory(link.navSection),
    route: link.href,
    location,
    kind: "admin-sidebar",
    navSection: link.navSection,
    navLabel: link.label,
  };
}

function mapAdminNavSectionToDocCategory(navSection: string): string {
  switch (navSection) {
    case "Commerce":
      return "Commerce";
    case "Fulfillment":
      return "Fulfillment";
    case "Catalog & team":
      return "Catalog & team";
    case "Help":
      return "Getting started";
    default:
      return navSection;
  }
}

/** Title/category overrides for surfaces whose guide title differs from nav label. */
const ADMIN_SURFACE_OVERRIDES: Partial<
  Record<string, Partial<Pick<UiSurfaceDefinition, "title" | "category" | "location">>>
> = {
  overview: {
    title: "Overview — tabs",
    location: "Sidebar → Overview (/admin/overview).",
  },
  "item-requests-active": {
    title: "Item requests — Active requests",
    location: "Sidebar → Item requests → Active requests sub-tabs.",
  },
  orders: {
    title: "Orders & history",
    location: "Sidebar → Orders; history at /admin/orders-history.",
  },
  barrels: {
    title: "Barrels — assign & history",
  },
  users: {
    title: "Users & admin grants",
  },
  support: {
    title: "Support — contact & inbox",
  },
  "admin-guide": {
    title: "Admin guide (this page)",
    category: "Getting started",
  },
  spotlight: {
    title: "Spotlight products",
  },
};

export const ADMIN_UI_SURFACES: UiSurfaceDefinition[] = [
  ...ADMIN_SIDEBAR_NAV_LINKS.map((link) => {
    const base = surfaceFromNavLink(link);
    const override = ADMIN_SURFACE_OVERRIDES[link.docId];
    return override ? { ...base, ...override } : base;
  }),
  ...ADMIN_HEADER_AND_EXTRA_SURFACES,
];

export const ADMIN_UI_SURFACE_IDS = ADMIN_UI_SURFACES.map((surface) => surface.id);

export const ADMIN_DOCUMENTATION_CATEGORIES = [
  "Getting started",
  "Header & tools",
  "Commerce",
  "Fulfillment",
  "Catalog & team",
  "Support",
] as const;

export type AdminDocumentationCategory =
  (typeof ADMIN_DOCUMENTATION_CATEGORIES)[number];
