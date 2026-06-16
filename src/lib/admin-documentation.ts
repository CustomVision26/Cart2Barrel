import type { DocumentationSection } from "@/lib/documentation-types";
import { getDocumentationByCategory as groupDocumentationByCategory } from "@/lib/documentation-types";
import {
  ADMIN_DOCUMENTATION_CATEGORIES,
  ADMIN_SIDEBAR_NAV_LINKS,
  ADMIN_UI_SURFACES,
  type AdminDocumentationCategory,
} from "@/lib/documentation/admin-ui-surfaces";
import type { DocumentationContentEntry } from "@/lib/documentation/ui-surface-types";
import {
  assertDocumentationSync,
  assertSidebarNavMatchesSurfaces,
  buildDocumentationSections,
} from "@/lib/documentation/sync-documentation";

function toContentRecord(
  sections: DocumentationSection[],
): Record<string, DocumentationContentEntry> {
  return Object.fromEntries(
    sections.map((section) => [
      section.id,
      {
        quickReference: {
          summary: section.quickReference.summary,
          bullets: section.quickReference.bullets,
          requirements: section.quickReference.requirements,
          dos: section.quickReference.dos,
          donts: section.quickReference.donts,
        },
        article: section.article,
      },
    ]),
  );
}

const ADMIN_DOCUMENTATION_CONTENT_RAW: DocumentationSection[] = [
  {
    id: "admin-access",
    title: "Admin access & layout",
    category: "Getting started",
    quickReference: {
      summary: "Staff-only area for quotes, orders, warehouse, and customer operations.",
      location: "Sidebar navigation under /admin/*; non-admins are redirected to the dashboard.",
      bullets: [
        "Requires Clerk admin role (granted under Users → Assign admin).",
        "Left sidebar groups Commerce, Fulfillment, Catalog & team, and Help.",
        "Mobile: horizontal nav strip mirrors sidebar links.",
        "User app link returns to the customer dashboard without signing out.",
      ],
      requirements: ["Clerk admin role on your account."],
      dos: [
        "Confirm you are on /admin before changing customer data.",
        "Use User app to verify the customer-facing view when debugging.",
      ],
      donts: [
        "Don't share admin credentials.",
        "Don't grant admin access without recording it in Grant log.",
      ],
    },
    article: {
      overview: [
        "The admin area is Cart2Barrel's internal operations console. Every route under /admin is protected: signed-in users without the admin role are redirected to /dashboard.",
        "The layout provides a persistent sidebar (or mobile strip), a customer filter in the header, admin notifications, and quick access back to the user app.",
      ],
      walkthrough: [
        "Sign in with an account that has admin privileges.",
        "Open /admin or click Admin from the dashboard header when available.",
        "Use the left sidebar to move between operational areas.",
        "The main content area shows the active page; many sections have their own sub-tabs.",
        "Use User app in the header to switch to the customer dashboard view.",
      ],
      requirements: ["Clerk admin role assigned to your user account."],
      dos: [
        "Verify admin access in Users → Assign admin if a colleague cannot enter /admin.",
        "Use the customer filter when working on a specific shopper's records.",
      ],
      donts: [
        "Do not perform bulk changes without understanding downstream order and shipment effects.",
        "Do not assume changes in admin are visible to customers until quotes are published or statuses update.",
      ],
    },
  },
  {
    id: "customer-filter",
    title: "Customer filter (header)",
    category: "Header & tools",
    quickReference: {
      summary: "Scopes many admin lists to one shopper's Clerk account.",
      location: "Admin header bar → customer picker (center of top bar).",
      bullets: [
        "Select a customer to filter overview, item requests, orders, and more.",
        "Filter persists in URL query params across navigation.",
        "Clear selection to see all customers again.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Set the filter before quoting or editing a specific account.",
        "Clear filter when switching to global reporting.",
      ],
      donts: [
        "Don't forget the filter is active—you may think data is missing globally.",
        "Don't quote or refund against the wrong customer—verify the picker label.",
      ],
    },
    article: {
      overview: [
        "The customer filter in the admin header limits many pages to a single shopper. This prevents cross-customer mistakes when quoting, fulfilling, or reviewing finance for one account.",
        "Selected customers are reflected in URL parameters so links can be shared with other staff while preserving context.",
      ],
      walkthrough: [
        "Open the customer picker in the admin header.",
        "Search or select the target shopper by name or email.",
        "Navigate to Item requests, Orders, Overview tabs, etc.—filtered views show only that customer's rows.",
        "Clear the selection to return to all-customer mode.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Always confirm the filtered customer matches the ticket or email you are handling.",
        "Clear the filter after finishing account-specific work.",
      ],
      donts: [
        "Do not leave a customer filter active when performing global inventory or finance review unless intentional.",
        "Do not modify records for customer A while customer B is selected in the picker.",
      ],
    },
  },
  {
    id: "admin-notifications",
    title: "Admin notifications bell",
    category: "Header & tools",
    quickReference: {
      summary: "Unread staff alerts for new requests, orders, and support activity.",
      location: "Admin header → bell icon (left of User app).",
      bullets: [
        "Badge shows unread admin activity count.",
        "Events link to the relevant admin page.",
        "Mark read individually or clear all.",
      ],
      requirements: ["Admin access."],
      dos: ["Check after shift start and when badge increases."],
      donts: ["Don't rely on notifications alone for time-critical purchasing deadlines."],
    },
    article: {
      overview: [
        "Admin notifications surface operational events—new item submissions, order changes, support messages, and related activity—so staff do not need to poll every queue manually.",
      ],
      walkthrough: [
        "Watch the bell badge in the admin header for unread count.",
        "Open the bell to read recent events.",
        "Click an event to navigate to the linked admin destination.",
        "Mark events read when handled, or use mark-all when caught up.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Prioritize notifications tied to customer-facing SLAs (new quotes, support replies).",
      ],
      donts: [
        "Do not ignore support-related notifications—customers may be waiting on inbox replies.",
      ],
    },
  },
  {
    id: "overview",
    title: "Overview — tabs",
    category: "Commerce",
    quickReference: {
      summary: "Hub for summary metrics, finance, pricing config, packages, and containers.",
      location: "Sidebar → Overview (/admin/overview).",
      bullets: [
        "Summary: refund queue banner and high-level orientation.",
        "Finance: revenue, taxes, Stripe fees, refunds by date.",
        "Fees & rates: service tiers and container packing rates.",
        "Customer packages: per-customer or general package pricing.",
        "Shipping containers: catalog offerings for sale to customers.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Use Finance for reconciliation, not Summary alone.",
        "Change fees & rates deliberately—existing quotes may use prior tiers.",
      ],
      donts: [
        "Don't edit container catalog without coordinating marketing spotlight.",
        "Don't change merchant tiers during active quote sessions without staff alignment.",
      ],
    },
    article: {
      overview: [
        "Admin Overview centralizes configuration and reporting that affects the whole platform. Sub-tabs split operational summary, financial reporting, merchant pricing, customer-specific packages, and the container catalog sold in the user app.",
      ],
      walkthrough: [
        "Summary tab: starting point with refund-awaiting banner and orientation copy.",
        "Finance tab: filter by date range; review revenue, tax, Stripe fees, and refund totals (respects customer filter when set).",
        "Fees & rates tab: edit in-app and outside-purchase service fee tiers and container packing fee rates.",
        "Customer packages tab: manage general or per-customer package pricing presets.",
        "Shipping containers tab: CRUD container offerings, images, and prices shown on user Barrels shop.",
      ],
      notes: [
        "/admin/finance redirects to Overview with the Finance tab selected.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Document fee changes internally when they affect quoted margins.",
        "Use Finance date filters that match your accounting period.",
      ],
      donts: [
        "Do not delete or disable container offerings that customers already purchased without a migration plan.",
        "Do not change fee tiers without understanding impact on open cart lines and unpublished quotes.",
      ],
    },
  },
  {
    id: "item-requests-active",
    title: "Item requests — Active requests",
    category: "Commerce",
    quickReference: {
      summary: "Quote and fulfill single-line customer URL submissions.",
      location: "Sidebar → Item requests → Active requests sub-tabs.",
      bullets: [
        "Queue: in-flight work per account—new submissions, resends, awaiting acceptance.",
        "Quote history: staff estimate revisions for single-line requests.",
        "Outside purchase: intake for buys not started via customer URL flow.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Publish estimates promptly; stock changes affect quoted items.",
        "Use Quote history to audit revision trail, not voided resend lines.",
      ],
      donts: [
        "Don't publish quotes without verifying URL, variant, and fees.",
        "Don't confuse Queue lines with Batch Items bundles.",
      ],
    },
    article: {
      overview: [
        "Active requests handles individual product quote workflows—the core of Cart2Barrel purchasing. Staff review customer-submitted retailer URLs, build estimates with fees, publish quotes to the customer cart, and manage resends or out-of-stock outcomes.",
      ],
      walkthrough: [
        "Open Item requests from the sidebar; Active requests is the default branch.",
        "Queue sub-tab: grouped in-flight work—new submissions, customer resends, quoted lines awaiting acceptance.",
        "Open a row to run AI-assisted estimate tools, adjust fees, publish or void quotes, and update status.",
        "Quote history sub-tab: revision history for single-line staff estimates (voided quotes from customer resends stay off this list by design).",
        "Outside purchase sub-tab: intake when staff must buy items outside the normal customer URL submission path.",
      ],
      requirements: ["Admin access.", "Valid product URLs and pricing rules for estimates."],
      dos: [
        "Verify retailer, variant, and quantity before publishing.",
        "Communicate out-of-stock promptly so customers can adjust requests.",
        "Use customer filter when working a single account's queue.",
      ],
      donts: [
        "Do not publish duplicate quotes for the same active line.",
        "Do not void published quotes without following refund or cart cleanup procedures.",
      ],
    },
  },
  {
    id: "item-requests-batch",
    title: "Item requests — Batch items",
    category: "Commerce",
    quickReference: {
      summary: "Multi-item bundle estimates submitted as one customer session.",
      location: "Sidebar → Item requests → Batch Items tab.",
      bullets: [
        "Submitted: new batch sessions awaiting staff estimates.",
        "Batch estimates: active bundled quote work.",
        "Batch history: archived batch sessions.",
        "Badge on tab shows pending batch count.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Estimate all lines in a bundle before publishing the batch.",
        "Check pending badge when starting a shift.",
      ],
      donts: [
        "Don't publish partial batches without documenting which lines are excluded.",
        "Don't mix batch and single-line queues when searching for a customer line.",
      ],
    },
    article: {
      overview: [
        "Batch Items manages multi-product estimate sessions that customers submit together. Staff produce a consolidated estimate so the customer can accept the bundle into the cart as one coordinated purchase.",
      ],
      walkthrough: [
        "Click Batch Items in the Item requests tab bar; badge shows pending count.",
        "Submitted sub-tab: newly submitted bundles needing staff review.",
        "Batch estimates sub-tab: in-progress bundled estimate sessions.",
        "Batch history sub-tab: completed or archived batch work.",
        "Publish batch estimates so the customer can accept lines into their cart.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Review every line in the bundle for stock and fee accuracy.",
        "Align batch totals with individual service tier rules.",
      ],
      donts: [
        "Do not leave submitted batches unquoted when customers are waiting to check out.",
        "Do not split batch acceptance rules without customer communication.",
      ],
    },
  },
  {
    id: "orders",
    title: "Orders & history",
    category: "Commerce",
    quickReference: {
      summary: "Paid customer order lines—fulfillment, refunds, and tracking.",
      location: "Sidebar → Orders; history at /admin/orders-history.",
      bullets: [
        "Active orders: carousel/table of paid lines needing hub action.",
        "Orders history: closed or completed admin order views.",
        "Refund, tracking, purchase confirmation, and warehouse flows per line.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Match order line to customer filter before refunds.",
        "Update tracking when purchase completes.",
      ],
      donts: [
        "Don't refund without checking payment and shipment state.",
        "Don't change fulfillment status to skip warehouse steps.",
      ],
    },
    article: {
      overview: [
        "Admin Orders is the control plane for paid customer purchases after checkout. Staff confirm hub buying, enter tracking, record warehouse receipt, process refunds and returns, and move lines through fulfillment states.",
      ],
      walkthrough: [
        "Open Orders from the sidebar for active paid lines.",
        "Use Orders history for completed or archived views.",
        "Open a line to see payment details, customer info, and available staff actions.",
        "Record company purchase, tracking updates, and warehouse delivery as operations progress.",
        "Process refund or return flows when policy and status allow.",
      ],
      requirements: ["Admin access.", "Paid order lines exist for data to appear."],
      dos: [
        "Cross-check Stripe payment state before issuing refunds.",
        "Use customer filter when handling support tickets tied to one order.",
      ],
      donts: [
        "Do not mark warehouse receipt before goods are physically received.",
        "Do not approve refunds that violate published policy without supervisor note.",
      ],
    },
  },
  {
    id: "purchase-orders",
    title: "Purchase orders",
    category: "Fulfillment",
    quickReference: {
      summary: "Staff buying queue for items that need hub purchase.",
      location: "Sidebar → Purchase orders.",
      bullets: [
        "Lists lines ready for staff to buy from US retailers.",
        "Coordinates purchasing after customer payment.",
        "Works with order fulfillment status updates.",
      ],
      requirements: ["Admin access."],
      dos: ["Buy only after payment is confirmed.", "Record tracking back on the order line."],
      donts: ["Don't purchase unpaid lines.", "Don't use personal cards without expense policy."],
    },
    article: {
      overview: [
        "Purchase orders is the staff buying queue—where hub operators execute US retailer purchases for lines customers have already paid for. It bridges payment confirmation and physical procurement.",
      ],
      walkthrough: [
        "Open Purchase orders from the Fulfillment section.",
        "Review lines awaiting hub purchase with retailer and variant details.",
        "Complete purchases according to internal buying procedures.",
        "Update corresponding order lines with purchase confirmation and tracking.",
      ],
      requirements: ["Admin access.", "Customer payment confirmed for the line."],
      dos: [
        "Verify variant and quantity match the quoted line before buying.",
        "Enter carrier tracking when the retailer ships to the hub.",
      ],
      donts: [
        "Do not purchase items for unpaid or voided quotes.",
        "Do not substitute products without customer quote revision or approval path.",
      ],
    },
  },
  {
    id: "packages",
    title: "Packages (warehouse receiving)",
    category: "Fulfillment",
    quickReference: {
      summary: "Intake and track packages arriving at the hub warehouse.",
      location: "Sidebar → Packages.",
      bullets: [
        "Record inbound carrier deliveries to the hub.",
        "Match packages to customer order lines.",
        "Feeds warehouse receipt status on orders.",
      ],
      requirements: ["Admin access."],
      dos: ["Scan or enter tracking accurately.", "Link packages to the correct customer."],
      donts: ["Don't mark received without physical package.", "Don't mix unidentified freight."],
    },
    article: {
      overview: [
        "Packages is warehouse receiving intake—logging when retailer shipments arrive at the hub and associating them with the correct customer purchases.",
      ],
      walkthrough: [
        "Open Packages from the Fulfillment sidebar.",
        "Record inbound shipment details as carriers deliver to the hub.",
        "Associate packages with customer order lines where applicable.",
        "Downstream order views reflect warehouse receipt when intake is complete.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Photograph or note damage on intake when relevant for claims.",
        "Resolve unidentified packages before barrel assignment.",
      ],
      donts: [
        "Do not assign packages to the wrong customer account.",
        "Do not skip intake for bulk deliveries—audit trail depends on it.",
      ],
    },
  },
  {
    id: "barrels",
    title: "Barrels — assign & history",
    category: "Fulfillment",
    quickReference: {
      summary: "Pack customer products into paid shipping containers.",
      location: "Sidebar → Barrels.",
      bullets: [
        "Assign to barrel: place received products into containers.",
        "Assign to barrel history: past assignment sessions.",
        "Customer must have paid for containers before packing.",
      ],
      requirements: ["Admin access.", "Paid containers and received products."],
      dos: ["Verify container ownership per customer.", "Complete assignment before outbound shipment."],
      donts: ["Don't pack into unpaid barrels.", "Don't exceed container weight/volume limits."],
    },
    article: {
      overview: [
        "Admin Barrels mirrors the customer product-to-barrel flow from the operations side. Staff help ensure received merchandise is assigned to the correct paid containers so outbound shipment can be scheduled.",
      ],
      walkthrough: [
        "Open Barrels from the Fulfillment section.",
        "Assign to barrel tab: select customer products and target containers.",
        "Complete assignment sessions so shipping can proceed.",
        "History tab: audit past assignment work.",
      ],
      requirements: [
        "Admin access.",
        "Customer-paid containers and hub-received products.",
      ],
      dos: [
        "Confirm container size matches shipment plan.",
        "Use customer filter when packing for one account.",
      ],
      donts: [
        "Do not assign products to containers another customer paid for.",
        "Do not close assignments with missing items without documenting exceptions.",
      ],
    },
  },
  {
    id: "shipments",
    title: "Shipments",
    category: "Fulfillment",
    quickReference: {
      summary: "Outbound barrel freight, customs charges, and shipment tracking.",
      location: "Sidebar → Shipments.",
      bullets: [
        "Create and manage outbound shipment charges.",
        "Customs and freight billing to customer cart.",
        "Carrier tracking for international delivery.",
      ],
      requirements: ["Admin access.", "Containers ready to ship."],
      dos: ["Bill outbound charges before releasing shipment.", "Enter accurate customs data."],
      donts: ["Don't ship without paid outbound charges when required.", "Don't guess customs values."],
    },
    article: {
      overview: [
        "Shipments handles the last mile of Cart2Barrel operations—outbound barrel freight, customs-related charges, and carrier tracking once containers leave the hub toward the customer's country.",
      ],
      walkthrough: [
        "Open Shipments from the Fulfillment sidebar.",
        "Review containers ready for outbound processing.",
        "Create or update shipment charges so customers can pay via their cart Pricing tab.",
        "Record carrier tracking and customs intake details as required.",
      ],
      requirements: ["Admin access.", "Packed containers and customer delivery address on file."],
      dos: [
        "Verify customer paid outbound charges before handoff to carrier.",
        "Keep tracking numbers synchronized with customer Shipping views.",
      ],
      donts: [
        "Do not release barrels with unpaid required freight charges unless explicitly approved.",
        "Do not enter incorrect customs declarations—downstream delivery may be blocked.",
      ],
    },
  },
  {
    id: "spotlight",
    title: "Spotlight products",
    category: "Catalog & team",
    quickReference: {
      summary: "Marketing carousel products on the public home page.",
      location: "Sidebar → Spotlight.",
      bullets: [
        "CRUD spotlight catalog entries.",
        "Categories, images, retailer links.",
        "Shown to signed-in and guest visitors on Home.",
      ],
      requirements: ["Admin access."],
      dos: ["Use high-quality images and valid retailer URLs.", "Rotate featured items seasonally."],
      donts: ["Don't feature out-of-stock items without disclaimer.", "Don't expose internal SKUs as final prices."],
    },
    article: {
      overview: [
        "Spotlight products powers the marketing carousel on the public home page. Admin staff curate featured US retailer items to inspire new customers—these are highlights, not binding quotes.",
      ],
      walkthrough: [
        "Open Spotlight from the Catalog & team section.",
        "Add or edit spotlight entries with title, category, image, and retailer link.",
        "Activate or deactivate items to control home page visibility.",
        "Changes appear on the public home page for guests and signed-in users.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Keep retailer URLs pointed at live product pages.",
        "Align spotlight messaging with How it works fee disclaimers.",
      ],
      donts: [
        "Do not present spotlight prices as guaranteed quotes.",
        "Do not upload copyrighted images without rights.",
      ],
    },
  },
  {
    id: "users",
    title: "Users & admin grants",
    category: "Catalog & team",
    quickReference: {
      summary: "Customer accounts, admin role assignment, and grant audit log.",
      location: "Sidebar → Users.",
      bullets: [
        "All users: registered shoppers; suspend or ban.",
        "Assign admin: grant or revoke admin role.",
        "Grant log: audit trail of admin grants.",
      ],
      requirements: ["Admin access."],
      dos: ["Record why admin access was granted.", "Revoke admin when staff offboards."],
      donts: ["Don't grant admin casually.", "Don't suspend accounts without support note."],
    },
    article: {
      overview: [
        "Users management covers registered customer accounts and internal admin access control. Only existing admins should grant new admins; the grant log provides accountability.",
      ],
      walkthrough: [
        "All users tab: browse registered profiles, view activity, suspend or reinstate accounts.",
        "Assign admin tab: search for a user and grant or remove Clerk admin role.",
        "Grant log tab: review historical admin assignments with timestamps.",
        "Account suspension triggers customer notifications in the user app.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Follow least-privilege—grant admin only to staff who need it.",
        "Document offboarding by revoking admin promptly.",
      ],
      donts: [
        "Do not grant admin to customer accounts used for shopping tests without isolation.",
        "Do not suspend paying customers without checking open orders and shipments.",
      ],
    },
  },
  {
    id: "support",
    title: "Support — contact & inbox",
    category: "Support",
    quickReference: {
      summary: "Hub contact settings and customer support ticket inbox.",
      location: "Sidebar → Support.",
      bullets: [
        "Contact: edit public hub email, phone, social links.",
        "Inbox: tickets grouped by customer.",
        "Ticket thread: reply as staff; customer sees in Messages.",
      ],
      requirements: ["Admin access."],
      dos: ["Keep contact info current.", "Reply in existing threads."],
      donts: ["Don't post internal notes visible to customers.", "Don't share payment data in replies."],
    },
    article: {
      overview: [
        "Admin Support configures how customers reach the hub and lets staff respond to tickets created via Contact us or order issues. Replies sync to the customer Messages inbox and notifications bell.",
      ],
      walkthrough: [
        "Contact tab: edit hub contact details shown in the customer Contact us dialog.",
        "Inbox tab: browse open and closed tickets grouped by customer.",
        "Open a ticket thread to read history and send staff replies (images optional).",
        "Customer receives notification when staff responds.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Reference order IDs and item links in replies.",
        "Escalate freight or customs issues to fulfillment leads when needed.",
      ],
      donts: [
        "Do not paste card numbers or passwords into ticket replies.",
        "Do not close tickets without resolving or documenting next steps.",
      ],
    },
  },
  {
    id: "admin-guide",
    title: "Admin guide (this page)",
    category: "Getting started",
    quickReference: {
      summary: "Staff documentation for every admin page and workflow.",
      location: "Sidebar → Help → Admin guide (/admin/guide).",
      bullets: [
        "Quick reference for scanning; full article for depth.",
        "Search across all admin topics.",
        "Only visible to users with admin role.",
      ],
      requirements: ["Admin access."],
      dos: ["Bookmark for onboarding new staff.", "Read Commerce sections before quoting."],
      donts: ["Don't share guide screenshots with non-admin customers."],
    },
    article: {
      overview: [
        "This Admin guide documents Cart2Barrel's internal UI—the same quick reference and full article pattern as the customer User guide on How it works. It is only available under /admin/guide and is hidden from non-admin users.",
      ],
      walkthrough: [
        "Open Admin guide from the sidebar Help section.",
        "Search or pick a topic from the left list.",
        "Use Quick reference for at-a-glance rules and locations.",
        "Switch to Full article for step-by-step workflows, requirements, and mistakes to avoid.",
      ],
      requirements: ["Clerk admin role."],
      dos: [
        "Onboard new staff by walking through Getting started and Commerce sections.",
        "Cross-reference customer User guide when explaining features to shoppers.",
      ],
      donts: [
        "Do not assume this guide replaces operational runbooks for physical warehouse safety.",
        "Do not expose admin-only URLs or procedures in customer-facing support replies.",
      ],
    },
  },
];

const ADMIN_DOCUMENTATION_CONTENT = toContentRecord(ADMIN_DOCUMENTATION_CONTENT_RAW);

assertDocumentationSync(ADMIN_UI_SURFACES, ADMIN_DOCUMENTATION_CONTENT, "admin");
assertSidebarNavMatchesSurfaces(
  ADMIN_SIDEBAR_NAV_LINKS,
  ADMIN_UI_SURFACES,
  "admin",
);

export const ADMIN_DOCUMENTATION_SECTIONS = buildDocumentationSections(
  ADMIN_UI_SURFACES,
  ADMIN_DOCUMENTATION_CONTENT,
);

export function getAdminDocumentationByCategory(): Record<
  AdminDocumentationCategory,
  DocumentationSection[]
> {
  return groupDocumentationByCategory(
    ADMIN_DOCUMENTATION_CATEGORIES,
    ADMIN_DOCUMENTATION_SECTIONS,
  );
}

export {
  ADMIN_DOCUMENTATION_CATEGORIES,
  type AdminDocumentationCategory,
} from "@/lib/documentation/admin-ui-surfaces";
