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
        "The admin area is Amani Cart2Barrel's internal operations console. Every route under /admin is protected: signed-in users without the admin role are redirected to /dashboard.",
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
        "Fees & rates: in-app and outside-purchase service & handling tiers only.",
        "Customer packages: General package fee is barrel/bin packing (1 vs 2+ rates); Select customer and Saved packages for per-shopper overrides. No packing fee per quoted line.",
        "Shipping containers: solid-colored Catalog accordion and color-coded table; double-click a row to edit, then Publish / Unpublish.",
        "In-hub products: Hub ship-from addresses and Add in-hub product sub-tabs (warehouse origins, one primary; SKUs with packed weight/size for Shippo).",
        "Special features: catalog table of timed suitcase offers; double-click a row to edit, then Publish.",
        "Quote Expiry Settings: Hub / Customer / Product sub-tabs for default window, per-customer overrides, and per-product overrides (1 minute–90 days).",
      ],
      requirements: ["Admin access."],
      dos: [
        "Use Finance for reconciliation, not Summary alone.",
        "Change service & handling tiers deliberately—existing quotes may use prior bands.",
        "Edit barrel/bin packing under Customer packages → General package fee, not Fees & rates.",
        "Publish Quote Expiry Settings (hub, customer, or product override) when retailer volatility or refund risk changes the payment window policy.",
      ],
      donts: [
        "Don't look for a packing fee per quoted line—quotes hardcode packing at $0; packing is barrel/bin only.",
        "Don't edit container catalog without coordinating marketing spotlight.",
        "Don't change merchant tiers during active quote sessions without staff alignment.",
      ],
    },
    article: {
      overview: [
        "Admin Overview centralizes configuration and reporting that affects the whole platform. Sub-tabs split operational summary, financial reporting, service & handling tiers, barrel/bin packing packages, the container catalog, in-hub warehouse SKUs (Shippo US shipping), special suitcase offers, and the quote expiry window for shoppers.",
      ],
      walkthrough: [
        "Summary tab: starting point with refund-awaiting banner and orientation copy.",
        "Finance tab: filter by date range; review revenue, tax, Stripe fees, and refund totals (respects customer filter when set).",
        "Fees & rates tab: edit in-app and outside-purchase service & handling tiers. Packing and container combination rates are not on this tab.",
        "Customer packages tab: General package fee sets default barrel and bin packing (exactly 1 vs 2+ of each type). Select customer and Saved packages override those rates per shopper. Quotes do not add a packing fee per quoted product line.",
        "Shipping containers tab: add barrels, bins, and special-feature suitcases with prices and photos. Catalog is a solid-colored accordion so the table stays readable over the page watermark. Rows are color-coded (amber barrel, blue bin, violet suitcase). Double-click a row to open the editor, then Publish / Unpublish to show or hide the SKU on the shopper Barrels page.",
        "In-hub products tab: Hub ship-from addresses sub-tab to add US warehouse origins (double-click or Open to edit; only one can be primary for Shippo). Add in-hub product sub-tab to add SKUs with packed weight (ounces) and outer length/width/height (inches), then Publish so they appear on Home. Shippo uses those parcel fields plus SHIPPO_API_KEY to rate US delivery and to buy domestic labels from Orders. Set SHIPPO_WEBHOOK_TOKEN and a track_updated webhook so customer tracking stays current (production example: https://amanicart2-barrel.vercel.app/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_TOKEN>). Overseas-container destination does not call Shippo.",
        "Special features tab: catalog table of timed suitcase specials; double-click a row to open the editor.",
        "Quote Expiry Settings tab: Hub / Customer / Product sub-tabs. Publish the hub default (1 minute–90 days), assign a customer override for all of that shopper’s quotes, or search a quoted product and set a product-only override. Priority: product → customer → hub. Shorter windows reduce refunds and add-payment requests when retailer prices move.",
      ],
      notes: [
        "/admin/finance redirects to Overview with the Finance tab selected.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Document fee changes internally when they affect quoted margins.",
        "Keep packing rates on Customer packages in sync with How it works Pricing overview.",
        "Use Finance date filters that match your accounting period.",
        "Keep in-hub parcel weight/size and a primary hub ship-from address complete, and set SHIPPO_API_KEY, before publishing SKUs for US delivery.",
      ],
      donts: [
        "Do not delete or disable container offerings that customers already purchased without a migration plan.",
        "Do not change fee tiers without understanding impact on open cart lines and unpublished quotes.",
        "Do not add a packing fee to quote lines; packing is charged on barrels and bins only.",
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
        "Active requests handles individual product quote workflows—the core of Amani Cart2Barrel purchasing. Staff review customer-submitted retailer URLs, build estimates with fees, publish quotes to the customer cart, and manage resends or out-of-stock outcomes.",
      ],
      walkthrough: [
        "Open Item requests from the sidebar; Active requests is the default branch.",
        "Queue sub-tab: grouped in-flight work—new submissions, customer resends, quoted lines awaiting acceptance.",
        "Open a row and use Create Estimate with AI (new requests and customer resends), then adjust fees, publish or void quotes, and update status.",
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
        "Double-click an order card to open products. In-hub US warehouse orders sit in In progress as Awaiting shipment (not Waiting for purchase). On Order products, the packing card has Shippo dashboard, Generate label (buys a domestic PDF via Shippo), and Download label after purchase. After a label or tracking is saved, the card shows In transit to customer. After delivery, the line moves to Orders history; if the customer requests a return it reappears on Orders as Return requested. Open View return and Generate return label (customer address → warehouse; pick USPS/UPS/FedEx). After the label is bought, the line moves to Purchase orders as a return in transit. Preview shows the checkout receipt including the destination US address. View order receipt for in-hub US orders lists From as Amani Cart2Barrel at the primary hub ship-from, Bill to as the warehouse package US ship-to (not the Jamaica barrel address), and warehouse package shipping as its own line and totals row. Update tracking remains a fallback (Open tracking, Check delivery, Save tracking, Next). Shippo track_updated webhooks keep live status current, mark outbound packages delivered, and mark warehouse returns received (restock + notify) without clicking Next.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Match order line to customer filter before refunds.",
        "Generate the Shippo label from the packing card after packing, or update tracking if the API purchase fails.",
        "Generate a warehouse return label from View return after an in-hub US customer submits a return.",
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
        "For in-hub US products, the order appears under In progress as Awaiting shipment. Open Order products: the In-hub warehouse packing card has Shippo dashboard (apps.goshippo.com unless SHIPPO_DASHBOARD_URL is set), Generate label to recreate the shipment and buy the shopper's checkout rate as a domestic PDF, and Download label after a successful purchase. If that rate expired, pick a current USPS/UPS/FedEx rate. After a label is bought (or tracking is saved), the card shows In transit to customer (not In transit to you). Preview opens the checkout receipt, including the destination US address. Update tracking remains a manual fallback; Open tracking opens the carrier page; Check delivery asks Shippo for the latest carrier status (live Shippo key required — test keys cannot look up FedEx); Next marks the package delivered. Configure Shippo Dashboard → Webhooks → track_updated to POST https://amanicart2-barrel.vercel.app/api/webhooks/shippo?token=<SHIPPO_WEBHOOK_TOKEN> (or https://<host>/api/webhooks/shippo?token=…) so live status updates on the customer order and delivered packages notify the shopper without staff clicking Next. When a delivered in-hub US customer requests a return, the line returns to Orders as Return requested. Open View return, edit the customer note, and Generate return label (customer US address → primary hub ship-from). Pick a USPS/UPS/FedEx rate; the customer prints the PDF from Orders. That line then appears on Purchase orders as a return in transit. When Shippo reports DELIVERED on the return tracking (or staff click Mark return received), the customer is notified and hub stock is restored. Issue the Stripe refund from Purchase orders when the requested outcome is money back.",
        "On the packing card, View order receipt (HTML or PDF) for in-hub US orders shows From as Amani Cart2Barrel at the primary hub ship-from, Bill to as the warehouse package US ship-to—not the Jamaica barrel address—and warehouse package shipping as a separate line and totals row.",
        "Record company purchase, tracking updates, and warehouse delivery as operations progress.",
        "Process refund or return flows when policy and status allow.",
      ],
      requirements: ["Admin access.", "Paid order lines exist for data to appear."],
      dos: [
        "Cross-check Stripe payment state before issuing refunds.",
        "Use customer filter when handling support tickets tied to one order.",
        "Generate a warehouse return label from View return for in-hub US returns, then refund from Purchase orders after warehouse receipt.",
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
        "In-hub US returns appear here after a warehouse return label is bought (return in transit). Use Mark return received if Shippo has not already recorded warehouse receipt, then refund when the outcome is money back.",
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
        "For in-hub US product returns, confirm the package arrived (Shippo delivered webhook or Mark return received) before issuing a refund or shipping a replacement.",
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
        "Shipments handles the last mile of Amani Cart2Barrel operations—outbound barrel freight, customs-related charges, and carrier tracking once containers leave the hub toward the customer's country.",
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
        "Search, filter by retailer or publish status, and paginate the catalog table. Each row shows the retailer name (Amazon, Walmart, Temu), product URL, and how many variants are saved. Click headers to sort, including Retailer, Product URL, and Variants. Newest first until you click a header. Double-click a row to edit.",
        "Opening the page auto-checks stale retailer listings (price, URL, name, image). Changed rows highlight in amber with Check retailer.",
        "Paste a product URL and Run SerpApi lookup. Use an Amazon /dp/ASIN or Walmart /ip/ product page—not a brand store page. Results use two tabs under the URL: Store variants and Retailer comparison.",
        "Apply fills the form. Save on a variant stores that SKU as the listing if nothing is saved yet; later Saves add extra SKUs. Save all variants keeps the applied row as the listing.",
        "Publish / Unpublish each product so shoppers can see it.",
        "Publish / Unpublish the category so the group appears on Home.",
        "Create a new category from New category; delete one with confirmation.",
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
        "Add a category with New category, or select an existing tab.",
        "Find products with Search, filter by Status or Retailer, and click column headers (including Retailer, Product URL, and Variants) to sort. The Product URL column opens the saved retailer listing. Variants is the count of extra SKUs saved under that listing. Use Rows per page and Previous / Next to paginate.",
        "Add products: paste a retailer product URL (Amazon /dp/ASIN or Walmart /ip/, not a /stores/ brand page) and Run SerpApi lookup. Store variants and Retailer comparison are tabs under the URL. Apply fills the form. Save on a variant uses that SKU as the table listing when the product is not saved yet; further Saves add extra SKUs under it. Add product to category saves the current form.",
        "Double-click a record to edit the product name, price, size, color, image, and variants. Shoppers see one compact card per product; double-clicking a card with options opens color swatches and size pills.",
        "Amber Check retailer rows mean the live listing no longer matches (price, URL, name, image, or availability). Review with the retailer, then save the edit to clear the warning until the next automatic check (stale listings older than six hours, when you open this page).",
        "Publish a product to make it available to shoppers, then Publish category so the group appears on Home.",
        "Unpublish a product or category to hide it from the public carousel without deleting it.",
        "Delete category (after confirmation) removes the group and its products. Keep at least one category.",
      ],
      requirements: ["Admin access."],
      dos: [
        "Keep retailer URLs pointed at live product pages.",
        "Review amber Check retailer rows before leaving them published.",
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
        "All users: Clerk-registered accounts synced into the database; contact, primary address, extra addresses; suspend or ban.",
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
        "All users tab: browse registered profiles (synced from Clerk), contact details, and saved shipping addresses (one primary). Suspend or reinstate accounts.",
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
        "This Admin guide documents Amani Cart2Barrel's internal UI—the same quick reference and full article pattern as the customer User guide on How it works. It is only available under /admin/guide and is hidden from non-admin users.",
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
