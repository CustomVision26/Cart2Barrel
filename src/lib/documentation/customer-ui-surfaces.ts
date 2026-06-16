import { DASHBOARD_ADD_ITEM_ROUTES } from "@/lib/dashboard-add-item-routes";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import { DASHBOARD_SUPPORT_ROUTES } from "@/lib/admin-support-routes";
import { HOW_IT_WORKS_ROUTES } from "@/lib/how-it-works-routes";
import type {
  SidebarNavLinkDefinition,
  UiSurfaceDefinition,
} from "@/lib/documentation/ui-surface-types";

/** Customer dashboard sidebar links — shared with `dashboard-nav.tsx`. */
export const CUSTOMER_SIDEBAR_NAV_LINKS: SidebarNavLinkDefinition[] = [
  {
    docId: "dashboard-overview",
    href: "/dashboard",
    label: "Overview",
    navSection: "Shopping",
  },
  {
    docId: "requested-items",
    href: DASHBOARD_REQUESTED_ITEMS_ROUTE,
    label: "Requested items",
    navSection: "Shopping",
  },
  {
    docId: "add-item",
    href: DASHBOARD_ADD_ITEM_ROUTES.productsActive,
    label: "Add item",
    navSection: "Shopping",
  },
  {
    docId: "cart",
    href: "/dashboard/cart",
    label: "Cart",
    navSection: "Shopping",
  },
  {
    docId: "orders",
    href: "/dashboard/orders",
    label: "Orders",
    navSection: "Orders & shipping",
  },
  {
    docId: "barrels",
    href: "/dashboard/barrels",
    label: "Barrels",
    navSection: "Orders & shipping",
  },
  {
    docId: "shipping",
    href: "/dashboard/shipping",
    label: "Shipping",
    navSection: "Orders & shipping",
  },
  {
    docId: "support-messages",
    href: DASHBOARD_SUPPORT_ROUTES.inbox,
    label: "Messages",
    navSection: "Support",
  },
];

const CUSTOMER_EXTRA_SURFACES: UiSurfaceDefinition[] = [
  {
    id: "home",
    title: "Home (marketing page)",
    category: "Getting started",
    route: "/",
    location: "Visit / or click Home in the dashboard header.",
    kind: "public",
  },
  {
    id: "how-it-works",
    title: "How it works",
    category: "Getting started",
    route: HOW_IT_WORKS_ROUTES.overview,
    location: "Marketing header → How it works, or visit /how-it-works.",
    kind: "public",
  },
  {
    id: "onboarding",
    title: "Onboarding (contact & shipping)",
    category: "Getting started",
    route: "/onboarding",
    location: "Automatic redirect from Home for new users, or visit /onboarding.",
    kind: "public",
  },
  {
    id: "header-home",
    title: "Header — Home link",
    category: "Header & account",
    route: "/",
    location: "Dashboard top bar → Home (left of Documentation).",
    kind: "header",
  },
  {
    id: "header-notifications",
    title: "Header — Notifications bell",
    category: "Header & account",
    route: "/dashboard",
    location: "Dashboard top bar → bell icon (badge shows unread count).",
    kind: "header",
  },
  {
    id: "header-cart",
    title: "Header — Cart icon",
    category: "Header & account",
    route: "/dashboard/cart",
    location: "Dashboard top bar → cart icon.",
    kind: "header",
  },
  {
    id: "header-settings",
    title: "Header — Settings (gear icon)",
    category: "Header & account",
    route: "/dashboard",
    location: "Dashboard top bar → gear icon (next to avatar).",
    kind: "header",
  },
  {
    id: "clerk-account",
    title: "Clerk — Manage account (profile modal)",
    category: "Header & account",
    route: "/dashboard",
    location: "Avatar (top right) → Manage account.",
    kind: "modal",
  },
  {
    id: "clerk-security",
    title: "Clerk — Security tab",
    category: "Header & account",
    route: "/dashboard",
    location: "Avatar → Manage account → Security.",
    kind: "modal",
  },
  {
    id: "contact-us",
    title: "Contact us (header dialog)",
    category: "Support",
    route: "/dashboard",
    location: "Dashboard top bar → Contact us.",
    kind: "header",
  },
  {
    id: "user-guide",
    title: "User guide (How it works)",
    category: "Getting started",
    route: HOW_IT_WORKS_ROUTES.userGuide,
    location: "How it works → User guide tab, or dashboard header → Documentation.",
    kind: "tab",
  },
];

function mapCustomerNavSectionToDocCategory(navSection: string): string {
  switch (navSection) {
    case "Shopping":
      return "Shopping";
    case "Orders & shipping":
      return "Orders & shipping";
    case "Support":
      return "Support";
    default:
      return navSection;
  }
}

function surfaceFromNavLink(link: SidebarNavLinkDefinition): UiSurfaceDefinition {
  return {
    id: link.docId,
    title: link.label,
    category: mapCustomerNavSectionToDocCategory(link.navSection),
    route: link.href,
    location: `Sidebar → ${link.label} (${link.href}).`,
    kind: "sidebar",
    navSection: link.navSection,
    navLabel: link.label,
  };
}

const CUSTOMER_SURFACE_OVERRIDES: Partial<
  Record<string, Partial<Pick<UiSurfaceDefinition, "title" | "category" | "location">>>
> = {
  "dashboard-overview": {
    title: "Dashboard — Overview",
    location: "Sidebar → Overview, or visit /dashboard.",
  },
  "add-item": {
    title: "Add item — Products & batch quotes",
  },
  cart: {
    title: "Cart & checkout",
    location: "Sidebar → Cart, or header cart icon.",
  },
  orders: {
    title: "Orders (active & history)",
    location: "Sidebar → Orders; history at /dashboard/orders-history.",
  },
  barrels: {
    title: "Barrels — Shop, assign & history",
  },
  shipping: {
    title: "Shipping — Tracking, pricing & address",
  },
  "support-messages": {
    title: "Messages (support inbox)",
    location: "Sidebar → Messages, or /dashboard/support.",
  },
};

export const CUSTOMER_UI_SURFACES: UiSurfaceDefinition[] = [
  ...CUSTOMER_SIDEBAR_NAV_LINKS.map((link) => {
    const base = surfaceFromNavLink(link);
    const override = CUSTOMER_SURFACE_OVERRIDES[link.docId];
    return override ? { ...base, ...override } : base;
  }),
  ...CUSTOMER_EXTRA_SURFACES,
];

export const CUSTOMER_UI_SURFACE_IDS = CUSTOMER_UI_SURFACES.map((surface) => surface.id);

export const DOCUMENTATION_CATEGORIES = [
  "Getting started",
  "Header & account",
  "Shopping",
  "Orders & shipping",
  "Support",
] as const;

export type DocumentationCategory = (typeof DOCUMENTATION_CATEGORIES)[number];
