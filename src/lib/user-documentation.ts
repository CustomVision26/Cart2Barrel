export type DocumentationSection = {
  id: string;
  title: string;
  category: string;
  purpose: string;
  howItWorks: string[];
  requirements: string[];
  dos: string[];
  donts: string[];
};

export const DOCUMENTATION_CATEGORIES = [
  "Getting started",
  "Header & account",
  "Shopping",
  "Orders & shipping",
  "Support",
] as const;

export type DocumentationCategory = (typeof DOCUMENTATION_CATEGORIES)[number];

export const USER_DOCUMENTATION_SECTIONS: DocumentationSection[] = [
  {
    id: "home",
    title: "Home (marketing page)",
    category: "Getting started",
    purpose:
      "The public landing page introduces Cart2Barrel, highlights featured products, and provides sign-in or sign-up entry points for new visitors.",
    howItWorks: [
      "Browse the hero section and spotlight carousel for featured US retailer products.",
      "Use the header to open How it works, sign in, or sign up.",
      "Signed-in users see a Dashboard link instead of auth buttons.",
      "New signed-in users who have not finished or skipped onboarding are sent to the onboarding page when they visit Home.",
      "After you skip or complete onboarding, Home loads normally and you can browse the storefront and dashboard.",
    ],
    requirements: [
      "No account is required to view the home page.",
      "A signed-in account is required to access the dashboard and place orders.",
    ],
    dos: [
      "Review How it works before your first purchase to understand fees and the barrel-shipping workflow.",
      "Complete contact and shipping details when you are ready to check out, or use Skip on onboarding to explore the app first.",
    ],
    donts: [
      "Do not assume prices on the spotlight carousel are final quotes—they are marketing highlights only.",
      "Do not share your sign-in credentials with others; each account is tied to one customer profile.",
    ],
  },
  {
    id: "how-it-works",
    title: "How it works",
    category: "Getting started",
    purpose:
      "Explains the end-to-end Cart2Barrel service: requesting US retailer items, hub processing, barrel consolidation, and delivery to your address.",
    howItWorks: [
      "Describes service fees, container options, and the customer journey from quote to delivery.",
      "Shows the container catalog and typical timelines.",
      "Accessible from the marketing header without signing in.",
    ],
    requirements: ["None—this page is public."],
    dos: [
      "Read this page before submitting your first item request.",
      "Refer back when you are unsure why a fee or step exists.",
    ],
    donts: [
      "Do not treat example fees as binding quotes for your specific items—actual quotes appear after staff review.",
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding (contact & shipping)",
    category: "Getting started",
    purpose:
      "Collects your legal contact name, phone number, and primary delivery address. You can complete this now or skip and finish later before checkout.",
    howItWorks: [
      "New signed-in users are directed here from Home until they complete or skip onboarding.",
      "Step 1: Save your account name and phone via the profile form (used for billing and hub contact).",
      "Step 2: Save your shipping address (worldwide delivery for barrel shipments).",
      "Skip (on the contact form): bypass onboarding for now and go to Home so you can browse the dashboard and request quotes.",
      "Skipping does not save contact or address details—you must add them later under Dashboard → Shipping → Address before paying.",
      "After you save both steps (without skipping), you are redirected to the home page or dashboard.",
    ],
    requirements: [
      "You must be signed in.",
      "Completing or skipping onboarding is required to leave this page and use Home freely.",
      "A valid delivery address is required before paying for cart items, even if you skipped earlier.",
    ],
    dos: [
      "Use your legal name and a phone number the hub can reach when you fill out the forms.",
      "Enter the address where you want barrels delivered, including correct country and postal code.",
      "Use Skip if you want to explore the app first, then return to Shipping → Address when you are ready to check out.",
      "Update your address later under Dashboard → Shipping → Address if you move.",
    ],
    donts: [
      "Do not use a fake or incomplete address—shipments cannot be routed correctly.",
      "Do not assume skipping onboarding permanently bypasses address requirements; checkout will still block without an address.",
    ],
  },
  {
    id: "header-home",
    title: "Header — Home link",
    category: "Header & account",
    purpose:
      "Returns you from the dashboard to the public marketing home page without signing out.",
    howItWorks: [
      "Click Home in the top bar to navigate to /.",
      "Your session remains active; use Dashboard from the home header to return.",
    ],
    requirements: ["Signed-in session (dashboard header is only shown in the dashboard area)."],
    dos: ["Use Home to browse marketing content while staying signed in."],
    donts: ["Do not confuse Home with Dashboard Overview—they are different pages."],
  },
  {
    id: "header-notifications",
    title: "Header — Notifications bell",
    category: "Header & account",
    purpose:
      "Shows unread status updates about quotes, orders, refunds, support replies, and account changes.",
    howItWorks: [
      "The badge shows your total unread count.",
      "Open the bell to see recent events (estimates ready, out of stock, purchase updates, warehouse receipt, refunds, support replies, account welcome/suspend/reinstate).",
      "Click an event to mark it read and jump to the related dashboard page.",
      "Use Mark all read to clear the list.",
    ],
    requirements: ["Signed-in account."],
    dos: [
      "Check notifications after submitting item requests or paying for orders.",
      "Follow links from notifications to the correct page instead of searching manually.",
    ],
    donts: [
      "Do not ignore account suspension or reinstatement notifications—they affect your ability to use the service.",
      "Notifications are not a substitute for email; critical billing issues may also arrive by email from Stripe or the hub.",
    ],
  },
  {
    id: "header-cart",
    title: "Header — Cart icon",
    category: "Header & account",
    purpose:
      "Quick access to your cart with a badge showing how many billable lines are waiting for checkout.",
    howItWorks: [
      "Click the cart icon to open /dashboard/cart.",
      "The badge reflects approved quote lines, batch bundles, containers, and outbound shipping charges ready to pay.",
    ],
    requirements: ["Signed-in account."],
    dos: ["Review the cart before checkout to confirm quantities, fees, and line items."],
    donts: [
      "Do not assume items are purchased until checkout succeeds—cart lines are not paid orders yet.",
    ],
  },
  {
    id: "header-settings",
    title: "Header — Settings (gear icon)",
    category: "Header & account",
    purpose:
      "Controls visual preferences for the Cart2Barrel interface on your device.",
    howItWorks: [
      "Open the gear icon to change theme mode (light or dark).",
      "Choose an interface accent color for buttons, links, and highlights.",
      "Preferences are stored locally in your browser.",
    ],
    requirements: ["None beyond access to the dashboard header."],
    dos: ["Pick a theme that is comfortable for extended use."],
    donts: [
      "Do not use this dialog for account name, phone, or shipping address—those are under Dashboard → Shipping → Address.",
      "Do not expect settings to sync across devices unless your browser syncs local storage.",
    ],
  },
  {
    id: "clerk-account",
    title: "Clerk — Manage account (profile modal)",
    category: "Header & account",
    purpose:
      "Manages your sign-in identity: email, password, security, sessions, and Cart2Barrel billing receipts.",
    howItWorks: [
      "Click your avatar → Manage account to open the account modal.",
      "Profile: update profile image, display name, and primary email (managed by Clerk).",
      "Security: password, active devices, and permanent account deletion—see the Security tab guide for full detail.",
      "Billing Receipt tab (Cart2Barrel custom): view and download payment invoices, Stripe receipts, and refund records for your orders.",
      "Sign out (from the avatar menu) ends your session on this device only; use Security → Active devices to review or end other sessions.",
    ],
    requirements: [
      "Signed-in account.",
      "Billing receipts only appear after you have completed at least one payment.",
    ],
    dos: [
      "Keep your email current—it is used for sign-in and payment receipts.",
      "Use a strong, unique password and review Active devices regularly.",
      "Download invoices from Billing Receipt for your records.",
    ],
    donts: [
      "Do not change your Clerk email to one you cannot access—you may lock yourself out.",
      "Do not use the Clerk profile name as a substitute for the legal contact name on Dashboard → Shipping → Address; both may be needed for different purposes.",
      "Do not share session or security codes.",
      "Do not delete your account from the Security tab unless you understand that deletion is permanent and Cart2Barrel data cannot be restored—read the Security tab guide first.",
    ],
  },
  {
    id: "clerk-security",
    title: "Clerk — Security tab",
    category: "Header & account",
    purpose:
      "Protects your sign-in identity and controls how you access Cart2Barrel. The Security tab also lets you permanently delete your account, which removes your Cart2Barrel profile and associated order records with no way to recover them.",
    howItWorks: [
      "Open your avatar → Manage account → Security.",
      "Password: your sign-in password is shown as dots. Click Update password to set a new one—you may need to confirm your current password or verify by email first.",
      "Active devices: lists browsers and devices where you are signed in. Each row shows the device type, browser, approximate location, IP address, and when the session was last active. The current device is labeled This device. Use the menu (⋯) on other sessions to sign out that device if you do not recognize it.",
      "Delete account: at the bottom of the Security page. Click Delete account and complete Clerk’s confirmation steps. This permanently removes your Clerk login and triggers removal of your Cart2Barrel profile, orders, and payment records. Deletion cannot be undone.",
      "Records you already downloaded (PDF invoices, Stripe receipts from Billing Receipt) remain on your device; copies stored only inside Cart2Barrel are gone after deletion.",
      "Two-step verification and backup codes: Cart2Barrel does not currently show these options in the Security tab. If they are added in a future update, they would appear here as an extra section—until then, account protection is your password plus reviewing Active devices.",
    ],
    requirements: [
      "You must be signed in to open Manage account.",
      "To change your password, you must complete any verification step Clerk requests.",
      "To delete your account, you must complete Clerk’s confirmation flow—deletion cannot be undone from the app.",
    ],
    dos: [
      "Use a strong, unique password and change it if you suspect it was exposed.",
      "Review Active devices regularly and sign out sessions you do not recognize.",
      "Download billing receipts and save important order details before deleting your account.",
      "Contact support via Contact us or Messages if you have active orders, barrels in transit, or open tickets before deleting—staff may need your account to resolve shipments.",
      "If you only want to stop using the service temporarily, sign out instead of deleting your account.",
      "If you forget your password, use Forgot password? on the /login page before considering account deletion.",
    ],
    donts: [
      "Do not delete your account to fix a forgotten password—use password reset on /login or contact support instead.",
      "Do not delete your account if you still have unpaid cart lines, orders in progress, or shipments you need to track—deletion removes your Cart2Barrel data and you will lose dashboard access.",
      "Do not assume Cart2Barrel or Clerk can restore your profile, order history, or messages after deletion—once removed, that data is not recoverable.",
      "Do not share your password or password-reset links with anyone, including people claiming to be support.",
      "Do not leave unrecognized devices signed in—use Active devices to revoke them.",
      "Do not delete your account on a shared device without signing out of other sessions if others use that device (delete affects the whole identity, not just one browser tab).",
    ],
  },
  {
    id: "contact-us",
    title: "Contact us (header dialog)",
    category: "Support",
    purpose:
      "Reach the hub team directly or open a support ticket for issues, complaints, or questions.",
    howItWorks: [
      "Click Contact us in the dashboard header.",
      "View hub email, phone, and social links when configured.",
      "Compose a subject and message (images optional) to create a support ticket.",
      "On success you are routed to your ticket thread or the Messages inbox.",
    ],
    requirements: [
      "Signed-in account.",
      "A clear subject and message describing your issue.",
    ],
    dos: [
      "Include order IDs, item links, or screenshots when reporting a problem.",
      "Use Messages to follow up on an existing ticket instead of opening duplicates.",
    ],
    donts: [
      "Do not send payment card numbers or passwords in support messages.",
      "Do not open multiple tickets for the same issue—it slows resolution.",
    ],
  },
  {
    id: "dashboard-overview",
    title: "Dashboard — Overview",
    category: "Shopping",
    purpose:
      "Your home base in the app: workflow summary, quick actions, and counts for open quotes, cart items, orders, and barrels.",
    howItWorks: [
      "Stat cards link to Requested items, Cart, Orders, and Barrels.",
      "Quick actions jump to Add product, Cart, Active orders, and Barrels.",
      "The workflow strip walks through Request → Checkout → Track → Ship.",
      "Refund-awaiting banners appear when action is needed on a return or refund.",
    ],
    requirements: ["Signed-in account. A saved shipping address is required before checkout."],
    dos: [
      "Start here after sign-in to see what needs attention.",
      "Use quick actions instead of hunting through the sidebar.",
    ],
    donts: [
      "Do not assume zero counts mean nothing is in progress—check each section if you expect activity.",
    ],
  },
  {
    id: "requested-items",
    title: "Requested items",
    category: "Shopping",
    purpose:
      "Entry point for submitting new item requests and reviewing the status of requests already in the pipeline.",
    howItWorks: [
      "Choose AI-assisted request to paste US retailer URLs and build a structured request.",
      "Staff review your submission and publish quotes you can accept into the cart.",
      "Track status: pending review, estimate ready, out of stock, withdrawn, etc.",
      "Unread quote updates also appear in the sidebar badge and notifications bell.",
    ],
    requirements: [
      "Signed-in account.",
      "Valid US retailer product URLs for new requests.",
    ],
    dos: [
      "Paste the exact product page URL, not a search results page.",
      "Select size, color, or variant when the product page offers options.",
      "Respond promptly when an estimate is ready so stock does not change.",
    ],
    donts: [
      "Do not submit duplicate requests for the same product—use the existing line or reinstate if withdrawn.",
      "Do not request items from unsupported retailers without checking How it works.",
      "Do not treat a submitted request as a confirmed purchase until you pay in the cart.",
    ],
  },
  {
    id: "add-item",
    title: "Add item — Products & batch quotes",
    category: "Shopping",
    purpose:
      "Workspace for active product quotes, quote history, and batch quote sessions (multiple items bundled for a single estimate).",
    howItWorks: [
      "Products → Active: quotes you can accept, compare, or withdraw.",
      "Products → History: past product quote sessions.",
      "Batch quotes → Active: bundled multi-item estimate sessions.",
      "Accepting a quote adds the line to your cart at the quoted price (subject to stock at purchase time).",
    ],
    requirements: [
      "Signed-in account.",
      "An approved quote before the line can be checked out.",
    ],
    dos: [
      "Compare retailer options when staff provides alternatives.",
      "Review fees shown on each quote before accepting.",
      "Use batch quotes when ordering several related items together.",
    ],
    donts: [
      "Do not accept quotes you do not intend to pay for—withdraw instead to keep your cart accurate.",
      "Do not assume quoted prices include future shipping barrel charges; those are billed separately when containers ship.",
    ],
  },
  {
    id: "cart",
    title: "Cart & checkout",
    category: "Shopping",
    purpose:
      "Review all approved charges—product quotes, batch bundles, shipping containers, and outbound freight—before paying via Stripe.",
    howItWorks: [
      "Cart lists each payable line with fees and totals.",
      "Remove lines you no longer want before checkout.",
      "Checkout opens a secure Stripe embedded payment session.",
      "After successful payment, Success page confirms fulfillment and links to orders.",
    ],
    requirements: [
      "Signed-in account.",
      "At least one approved cart line.",
      "Complete shipping address on file.",
      "Valid payment method accepted by Stripe.",
    ],
    dos: [
      "Verify your shipping address under Shipping → Address before paying.",
      "Complete payment in one session; if interrupted, return to the cart and try again.",
      "Save your receipt from the success page or Billing Receipt in your account.",
    ],
    donts: [
      "Do not close the browser during Stripe checkout unless payment already succeeded.",
      "Do not pay for lines you have not reviewed—refunds depend on order status and policy.",
      "Do not add items to the cart by requesting quotes elsewhere; only accepted quotes appear here.",
    ],
  },
  {
    id: "orders",
    title: "Orders (active & history)",
    category: "Orders & shipping",
    purpose:
      "Track purchase progress, warehouse receipt, tracking numbers, refunds, returns, and delivery acceptance for paid orders.",
    howItWorks: [
      "Active orders: in-progress purchases and hub fulfillment.",
      "Orders history: completed or closed orders.",
      "Open an order to see line details, tracking, refund status, and return options.",
      "Some actions (accept delivery, request refund/return) depend on current order status.",
    ],
    requirements: ["Signed-in account.", "At least one paid order for data to appear."],
    dos: [
      "Monitor tracking updates and warehouse receipt notifications.",
      "Use in-order actions only when the status allows them.",
      "Contact support with your order ID if something looks wrong.",
    ],
    donts: [
      "Do not request a refund after accepting final delivery unless policy allows.",
      "Do not assume carrier tracking updates in real time—refresh or check notifications.",
    ],
  },
  {
    id: "barrels",
    title: "Barrels — Shop, assign & history",
    category: "Orders & shipping",
    purpose:
      "Purchase shipping containers (barrels), assign received products into barrels, and review past assignments.",
    howItWorks: [
      "Shop: browse container offerings and add barrels to your cart.",
      "Product to barrel: place warehouse-received items into a container for consolidated shipping.",
      "History: view past assignment sessions.",
      "Barrels must be paid for before products can be packed for outbound shipment.",
    ],
    requirements: [
      "Signed-in account.",
      "Paid container(s) for assignment.",
      "Products received at the hub for product-to-barrel.",
    ],
    dos: [
      "Buy the correct container size for your shipment volume.",
      "Assign items promptly so outbound shipping can be scheduled.",
    ],
    donts: [
      "Do not assign items to a barrel you have not paid for.",
      "Do not mix assignment rules across containers without staff guidance if unsure.",
    ],
  },
  {
    id: "shipping",
    title: "Shipping — Tracking, pricing & address",
    category: "Orders & shipping",
    purpose:
      "Manage delivery address, track barrel shipments, and pay outbound freight/customs charges when containers are ready to ship.",
    howItWorks: [
      "Tracking: submit and view barrel shipment intake details and carrier tracking.",
      "Pricing: appears when containers are ready—review and pay outbound charges.",
      "Address: update legal contact (name, phone) and primary delivery address.",
      "/dashboard/settings redirects here for account shipping settings.",
    ],
    requirements: [
      "Signed-in account.",
      "Saved shipping address for any outbound shipment.",
      "Containers in the shipping pipeline for tracking and pricing tabs.",
    ],
    dos: [
      "Keep your address current before barrels ship.",
      "Complete customs or intake forms when prompted.",
      "Pay outbound charges promptly to avoid shipment delays.",
    ],
    donts: [
      "Do not use the Settings gear dialog for address changes—use Shipping → Address.",
      "Do not ignore Pricing tab charges—shipments may be held until paid.",
    ],
  },
  {
    id: "support-messages",
    title: "Messages (support inbox)",
    category: "Support",
    purpose:
      "View and reply to support tickets you opened via Contact us or from order-related issues.",
    howItWorks: [
      "Inbox lists your tickets with status and last update.",
      "Open a ticket to read the thread and send replies (images optional).",
      "Support replies trigger notifications in the bell.",
    ],
    requirements: ["Signed-in account."],
    dos: [
      "Reply in the existing thread for continuity.",
      "Reference ticket subject or order IDs in follow-ups.",
    ],
    donts: [
      "Do not delete or edit sent messages—add a new reply instead.",
      "Do not use Messages for new quote requests—use Requested items or Add item.",
    ],
  },
];

export function getDocumentationByCategory(): Record<
  DocumentationCategory,
  DocumentationSection[]
> {
  const grouped = {} as Record<DocumentationCategory, DocumentationSection[]>;
  for (const category of DOCUMENTATION_CATEGORIES) {
    grouped[category] = USER_DOCUMENTATION_SECTIONS.filter(
      (section) => section.category === category,
    );
  }
  return grouped;
}
