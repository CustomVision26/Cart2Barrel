import type { DocumentationSection } from "@/lib/documentation-types";
import { getDocumentationByCategory as groupDocumentationByCategory } from "@/lib/documentation-types";
import {
  CUSTOMER_SIDEBAR_NAV_LINKS,
  CUSTOMER_UI_SURFACES,
  DOCUMENTATION_CATEGORIES,
  type DocumentationCategory,
} from "@/lib/documentation/customer-ui-surfaces";
import type { DocumentationContentEntry } from "@/lib/documentation/ui-surface-types";
import {
  assertDocumentationSync,
  assertSidebarNavMatchesSurfaces,
  buildDocumentationSections,
} from "@/lib/documentation/sync-documentation";

export type {
  DocumentationArticle,
  DocumentationQuickReference,
  DocumentationSection,
  DocumentationView,
} from "@/lib/documentation-types";

export { DOCUMENTATION_CATEGORIES, type DocumentationCategory };

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

/** Prose and policies keyed by surface id — registry supplies titles, routes, and locations. */
const CUSTOMER_DOCUMENTATION_CONTENT_RAW: DocumentationSection[] = [
  {
    id: "home",
    title: "Home (marketing page)",
    category: "Getting started",
    quickReference: {
      summary:
        "Public storefront landing page with featured products and sign-in entry.",
      location: "Visit / or click Home in the dashboard header.",
      bullets: [
        "Hero section and spotlight carousel highlight US retailer products.",
        "Spotlight carousel cards stay compact. Double-click a product with color or size options to open the swatch and size picker; View and Request follow the selected variant.",
        "Guests see Sign in / Sign up; signed-in users see Dashboard. Sign up collects first name, last name, email, password, and confirm password on a glass card over Home. Back to home, clicking outside the card, or Escape returns to Home.",
        "Get an estimate (next to the hero badge) opens the AI-assisted item request at /dashboard/items/requested-items/ai-assisted-request. Sign in is required if you are not already signed in.",
        "In-hub products can be added to cart from Home; US delivery uses a saved United States address. Multiple in-hub SKUs to the same address ship as one warehouse package with a single Shippo rate.",
        "After skip or complete onboarding, Home works normally.",
      ],
      requirements: [
        "No account needed to browse.",
        "Account required for dashboard and orders.",
      ],
      dos: [
        "Read How it works before your first purchase.",
        "Complete or skip onboarding when prompted.",
      ],
      donts: [
        "Don't treat spotlight prices as final quotes.",
        "Don't share sign-in credentials.",
      ],
    },
    article: {
      overview: [
        "The Home page is Amani Cart2Barrel's public marketing storefront. It introduces the service, showcases featured US retailer products in a spotlight carousel, and gives visitors a clear path to sign in or create an account.",
        "For signed-in customers, Home acts as a bridge between marketing content and the dashboard. Depending on your onboarding status, you may be routed to complete contact details—or you can skip onboarding to explore first.",
      ],
      walkthrough: [
        "Browse featured spotlight products. Cards show photo, price, View, and Request. Double-click a product that has colors or sizes to open a larger dialog with swatches and size pills—the photo, price, View link, and Request follow the selected variant. Use View all N when there are many colors. In the category dialog, open Retailers and pick a store tab to show that retailer's product cards.",
        "Scroll to In-hub products to add warehouse stock to your cart. For US delivery, the item uses your default saved United States address. Shipping is one warehouse-package rate from Shippo for all in-hub items going to that address. Overseas packing does not require a US address and has no carrier shipping charge.",
        "Use the header: How it works (public guide), Sign in, Sign up (first name, last name, email, password, and confirm password on a glass card over Home; Back to home, click outside, or Escape returns to Home), or Dashboard (when signed in).",
        "If you are a new signed-in user who has not completed or skipped onboarding, visiting Home redirects you to the onboarding page.",
        "After you skip or finish onboarding, Home loads normally and you can move freely between marketing pages and the dashboard.",
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
  },
  {
    id: "how-it-works",
    title: "How it works",
    category: "Getting started",
    quickReference: {
      summary:
        "Public guide explaining the full Amani Cart2Barrel journey from quote to delivery.",
      location: "Marketing header → How it works, or visit /how-it-works.",
      bullets: [
        "Overview tab: services, journey, and typical costs. User guide tab: full customer documentation.",
        "Pricing overview shows published service & handling, container catalog prices, and barrel/bin packing rates.",
        "Packing fees follow barrel and bin counts (1 vs 2+ of each type)—not a fee per quoted product line.",
        "Destination-country charges are not included in the US outbound quote.",
        "No sign-in required.",
      ],
      requirements: ["None—public page."],
      dos: [
        "Read Overview before your first item request.",
        "Use the User guide tab for page-by-page reference.",
      ],
      donts: [
        "Don't treat published rates as binding quotes for your items.",
        "Don't assume destination duties or inland delivery are in the US outbound quote.",
      ],
    },
    article: {
      overview: [
        "How it works is Amani Cart2Barrel's public explainer. Overview describes how US retailer shopping, hub processing, barrel consolidation, and international delivery fit together. User guide is the same customer documentation signed-in shoppers open from Documentation in the dashboard header.",
        "Anyone can read both tabs without signing in. Overview includes a Pricing overview of current published rates; your signed-in dashboard shows exact totals at checkout.",
      ],
      walkthrough: [
        "Open How it works from the marketing header or go to /how-it-works (Overview tab by default).",
        "Review Pricing overview: in-app and outside-purchase service & handling charts, container catalog prices, and barrel/bin packing fees (exactly 1 vs 2+ of each type).",
        "Read services, the illustrated journey (request → quote → payment → warehouse receipt → barrel packing → delivery), and the four cost phases: product plus service & handling, container/barrel cost, US outbound freight, and destination-country charges.",
        "Destination charges (duties, inland delivery, port or warehouse storage, local handling) are billed on arrival by customs or the local carrier. They are not included in the US outbound quote.",
        "Switch to the User guide tab (or /how-it-works?tab=user-guide) for quick references and full articles on every customer page.",
      ],
      requirements: ["None—this page is public."],
      dos: [
        "Read Overview before submitting your first item request.",
        "Refer back when you are unsure why a fee or step exists.",
        "Use User guide when you need the exact location of a dashboard page or control.",
      ],
      donts: [
        "Do not treat published rates as binding quotes for your specific items—actual quotes appear after staff review.",
        "Do not expect destination-country charges to appear in Shipping → Pricing; that tab is the US outbound quote.",
      ],
    },
  },
  {
    id: "onboarding",
    title: "Onboarding (contact & shipping)",
    category: "Getting started",
    quickReference: {
      summary:
        "Collects contact name, phone, and delivery address—or lets you skip and finish later.",
      location: "Automatic redirect from Home for new users, or visit /onboarding.",
      bullets: [
        "One form: name, phone, and delivery address saved together.",
        "That first save is your primary shipping record.",
        "Skip sends you to Home without saving details.",
        "Marketing Home stays visible behind the form.",
        "Checkout still requires a saved address later.",
      ],
      requirements: [
        "Must be signed in.",
        "Complete or skip to leave the page.",
        "Address required before payment.",
      ],
      dos: [
        "Use legal name and reachable phone.",
        "Skip to explore; add address under Shipping → Address before checkout.",
      ],
      donts: [
        "Don't use fake or incomplete addresses.",
        "Skipping doesn't remove the address requirement at checkout.",
      ],
    },
    article: {
      overview: [
        "Onboarding is the first account setup step after sign-up. It collects your name, phone, and primary delivery address as one shipping record—the label used when barrels ship to you anywhere in the world.",
        "You are not forced to complete every field immediately. The Skip control lets you browse the storefront and dashboard first. Skipping does not save your details; you must add them under Dashboard → Shipping → Address before you can pay for cart items.",
      ],
      walkthrough: [
        "New signed-in users are directed here from Home until they complete or skip onboarding.",
        "The marketing Home page stays visible in the background; complete the form or use Skip.",
        "Enter your full name, phone, and worldwide delivery address on one form. Saving creates your primary shipping record.",
        "Optional — Skip: click Skip to bypass onboarding and go to Home immediately.",
        "After saving without skipping, you are redirected to Home.",
        "If you skipped, return later to Dashboard → Shipping → Address to add contact and delivery details before checkout. You can save more than one address and mark one as primary.",
      ],
      notes: [
        "Name, phone, and street are saved together on each shipping address. One address is primary.",
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
  },
  {
    id: "header-home",
    title: "Header — Home link",
    category: "Header & account",
    quickReference: {
      summary: "Returns to the marketing home page while staying signed in.",
      location: "Dashboard top bar → Home (left of Documentation).",
      bullets: [
        "Navigates to / without signing you out.",
        "Use Dashboard on the home header to return.",
        "Different from Dashboard Overview.",
      ],
      requirements: ["Signed-in session (dashboard header only)."],
      dos: ["Browse marketing content while signed in."],
      donts: ["Don't confuse Home with Dashboard Overview."],
    },
    article: {
      overview: [
        "The Home link in the dashboard header takes you back to the public marketing homepage without ending your session. It is useful when you want to re-read marketing content, browse the spotlight carousel, or share the storefront—while remaining logged in.",
      ],
      walkthrough: [
        "From any dashboard page, click Home in the top navigation bar.",
        "You are taken to / (the marketing home page). Your sign-in session stays active.",
        "To return to shopping tools, click Dashboard in the home page header or use your browser back button.",
      ],
      requirements: [
        "Signed-in session (dashboard header is only shown in the dashboard area).",
      ],
      dos: ["Use Home to browse marketing content while staying signed in."],
      donts: [
        "Do not confuse Home with Dashboard Overview—they are different pages.",
      ],
    },
  },
  {
    id: "header-notifications",
    title: "Header — Notifications bell",
    category: "Header & account",
    quickReference: {
      summary: "Unread alerts for quotes, orders, refunds, support, and account status.",
      location: "Dashboard top bar → bell icon (badge shows unread count).",
      bullets: [
        "Lists estimates ready, stock issues, purchase updates, refunds.",
        "Click an event to mark read and open the related page.",
        "Mark all read clears the list.",
      ],
      requirements: ["Signed-in account."],
      dos: [
        "Check after submitting requests or paying orders.",
        "Follow notification links instead of searching manually.",
      ],
      donts: [
        "Don't ignore suspension or reinstatement alerts.",
        "Notifications don't replace email from Stripe or the hub.",
      ],
    },
    article: {
      overview: [
        "The notifications bell is your in-app activity feed. It surfaces important status changes—quote updates, purchase progress, warehouse events, refunds, support replies, and account notices—so you do not have to refresh every dashboard page manually.",
        "The badge on the bell shows how many events are unread. Opening the dialog lets you review, navigate, or clear them.",
      ],
      walkthrough: [
        "Look for the bell icon in the dashboard header; a badge appears when you have unread events.",
        "Click the bell to open the notifications dialog.",
        "Review events such as estimates ready, out of stock, purchase confirmed, tracking updates, warehouse receipt, refunds, support replies, and account welcome/suspend/reinstate.",
        "Click an individual event to mark it as read and navigate to the linked dashboard page.",
        "Use Mark all read to dismiss every unread event at once.",
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
  },
  {
    id: "header-cart",
    title: "Header — Cart icon",
    category: "Header & account",
    quickReference: {
      summary: "Shortcut to your cart with a count of lines ready to pay.",
      location: "Dashboard top bar → cart icon.",
      bullets: [
        "Opens /dashboard/cart.",
        "Badge counts approved quotes, bundles, containers, outbound charges.",
        "Cart lines are not paid orders until checkout succeeds.",
      ],
      requirements: ["Signed-in account."],
      dos: ["Review cart before checkout."],
      donts: ["Don't assume cart items are purchased yet."],
    },
    article: {
      overview: [
        "The cart icon in the dashboard header gives you one-click access to everything waiting for payment. The badge number reflects billable lines—approved product quotes, batch bundles, shipping containers, and outbound freight charges—not items still being quoted.",
      ],
      walkthrough: [
        "Click the cart icon in the top bar to open /dashboard/cart.",
        "The badge shows how many payable lines are currently in your cart.",
        "From the cart page, review line items, fees, and totals before proceeding to checkout.",
      ],
      requirements: ["Signed-in account."],
      dos: [
        "Review the cart before checkout to confirm quantities, fees, and line items.",
      ],
      donts: [
        "Do not assume items are purchased until checkout succeeds—cart lines are not paid orders yet.",
      ],
    },
  },
  {
    id: "header-settings",
    title: "Header — Settings (gear icon)",
    category: "Header & account",
    quickReference: {
      summary: "Appearance only—theme mode and accent color for this browser.",
      location: "Dashboard top bar → gear icon (next to avatar).",
      bullets: [
        "Switch light or dark theme.",
        "Pick an interface accent color.",
        "Stored locally in your browser.",
        "Not for account name, phone, or address.",
      ],
      requirements: ["Dashboard header access."],
      dos: ["Choose a comfortable theme for long sessions."],
      donts: [
        "Don't use this for shipping address—use Shipping → Address.",
        "Settings may not sync across devices.",
      ],
    },
    article: {
      overview: [
        "The settings gear controls how Amani Cart2Barrel looks on your device. It affects theme mode and accent color only—it does not change your account contact, shipping address, password, or notification preferences.",
        "Preferences are saved in your browser's local storage, so they apply on this device unless your browser syncs storage across machines.",
      ],
      walkthrough: [
        "Click the gear icon in the dashboard header.",
        "Under Appearance, choose Light or Dark theme mode.",
        "Select an interface accent color from the dropdown or color swatches.",
        "Changes apply immediately across the dashboard and marketing pages on this device.",
      ],
      requirements: ["None beyond access to the dashboard header."],
      dos: ["Pick a theme that is comfortable for extended use."],
      donts: [
        "Do not use this dialog for account name, phone, or shipping address—those are under Dashboard → Shipping → Address.",
        "Do not expect settings to sync across devices unless your browser syncs local storage.",
      ],
    },
  },
  {
    id: "clerk-account",
    title: "Clerk — Manage account (profile modal)",
    category: "Header & account",
    quickReference: {
      summary:
        "Sign-in identity, profile email, security, and billing receipts.",
      location: "Avatar (top right) → Manage account.",
      bullets: [
        "Profile: image, display name, primary email.",
        "Security: password, devices, delete account.",
        "Billing Receipt: invoices for checkout (including in-hub products) and Stripe proration receipts.",
        "Sign out ends session on this device only.",
      ],
      requirements: [
        "Signed-in account.",
        "Receipts appear after first payment.",
      ],
      dos: [
        "Keep email current for sign-in and receipts.",
        "Review Security → Active devices regularly.",
      ],
      donts: [
        "Don't change email to one you can't access.",
        "Don't delete account without reading the Security guide.",
      ],
    },
    article: {
      overview: [
        "Manage account is your Clerk-powered identity hub inside Amani Cart2Barrel. It handles everything related to how you sign in—profile details, password, device sessions, and account deletion—plus a custom Billing Receipt tab for payment records.",
        "Amani Cart2Barrel shipping records (name, phone, and street on each address) live under Dashboard → Shipping → Address. Keep both your Clerk profile and Amani Cart2Barrel shipping details up to date.",
      ],
      walkthrough: [
        "Click your avatar in the top-right corner of the dashboard header.",
        "Select Manage account to open the account modal.",
        "Profile tab: update your profile image, display name, and primary email (managed by Clerk).",
        "Security tab: change password, review active devices, or permanently delete your account—see the Security tab guide for detail.",
        "Billing Receipt tab: view and download payment invoices for checkout orders, including in-hub warehouse products, plus Stripe receipts and refund records. Filter Show to In-hub products. In-hub US invoices list Amani Cart2Barrel at the warehouse ship-from as From, the product US ship-to as Bill to, merchandise as its own lines, and warehouse package shipping as a separate charge.",
        "Sign out from the avatar menu ends your session on this device; use Security → Active devices to end sessions elsewhere.",
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
        "Do not use the Clerk profile name as a substitute for the recipient name on Dashboard → Shipping → Address; shipping records include contact and street together.",
        "Do not share session or security codes.",
        "Do not delete your account from the Security tab unless you understand that deletion is permanent and Amani Cart2Barrel data cannot be restored—read the Security tab guide first.",
      ],
    },
  },
  {
    id: "clerk-security",
    title: "Clerk — Security tab",
    category: "Header & account",
    quickReference: {
      summary:
        "Password, signed-in devices, and permanent account deletion.",
      location: "Avatar → Manage account → Security.",
      bullets: [
        "Update password via the Password row.",
        "Active devices lists sessions; use ⋯ to sign out others.",
        "Delete account is permanent and removes Amani Cart2Barrel data.",
        "No 2FA or backup codes in Amani Cart2Barrel today.",
      ],
      requirements: [
        "Signed in to open Manage account.",
        "Confirmation required to delete account.",
      ],
      dos: [
        "Use a strong password; revoke unknown devices.",
        "Download receipts before deleting your account.",
        "Use Forgot password? on /login if locked out.",
      ],
      donts: [
        "Don't delete to fix a forgotten password.",
        "Don't delete with active orders or shipments in progress.",
        "Deletion cannot be undone.",
      ],
    },
    article: {
      overview: [
        "The Security tab protects your Amani Cart2Barrel sign-in. In the current app, it shows three areas: Password, Active devices, and Delete account. Two-step verification and backup codes are not enabled for Amani Cart2Barrel customers at this time—account protection relies on your password and reviewing where you are signed in.",
        "Deleting your account from this tab is irreversible. It removes your Clerk login and triggers deletion of your Amani Cart2Barrel profile, orders, and payment records.",
      ],
      walkthrough: [
        "Open your avatar → Manage account → Security.",
        "Password: your password appears as dots. Click Update password to set a new one—you may need to confirm your current password or verify by email.",
        "Active devices: each row shows device type, browser, location, IP, and last activity. This device is labeled This device. Use the ⋯ menu on other rows to sign out sessions you do not recognize.",
        "Delete account: at the bottom, click Delete account and complete Clerk's confirmation steps.",
        "After deletion, you cannot sign in again. Amani Cart2Barrel removes your profile, orders, and payment records. Downloaded PDFs on your device are kept; in-app copies are gone.",
      ],
      notes: [
        "Two-step verification and backup codes are not shown in Amani Cart2Barrel's Security tab today. If added in a future update, they would appear as an additional section here.",
        "If you forget your password, use Forgot password? on /login—do not delete your account to recover access.",
      ],
      requirements: [
        "You must be signed in to open Manage account.",
        "To change your password, you must complete any verification step Clerk requests.",
        "To delete your account, you must complete Clerk's confirmation flow—deletion cannot be undone from the app.",
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
        "Do not delete your account if you still have unpaid cart lines, orders in progress, or shipments you need to track—deletion removes your Amani Cart2Barrel data and you will lose dashboard access.",
        "Do not assume Amani Cart2Barrel or Clerk can restore your profile, order history, or messages after deletion—once removed, that data is not recoverable.",
        "Do not share your password or password-reset links with anyone, including people claiming to be support.",
        "Do not leave unrecognized devices signed in—use Active devices to revoke them.",
        "Do not delete your account on a shared device without signing out of other sessions if others use that device (delete affects the whole identity, not just one browser tab).",
      ],
    },
  },
  {
    id: "contact-us",
    title: "Contact us (header dialog)",
    category: "Support",
    quickReference: {
      summary: "Reach the hub team or open a support ticket from the dashboard.",
      location: "Dashboard top bar → Contact us.",
      bullets: [
        "Shows hub email, phone, and social links.",
        "Compose a subject and message to create a ticket.",
        "Images optional; routes to Messages on success.",
      ],
      requirements: ["Signed-in account.", "Clear subject and message."],
      dos: [
        "Include order IDs, links, or screenshots.",
        "Follow up in Messages, not duplicate tickets.",
      ],
      donts: [
        "Don't send card numbers or passwords.",
        "Don't open multiple tickets for one issue.",
      ],
    },
    article: {
      overview: [
        "Contact us opens a dialog from the dashboard header where you can see hub contact details and send a structured support message. Successful submissions create a support ticket and route you to the relevant thread or your Messages inbox.",
      ],
      walkthrough: [
        "Click Contact us in the dashboard header.",
        "Review hub contact information—email, phone, and social links when configured.",
        "Enter a subject and message describing your issue or question.",
        "Optionally attach images to illustrate the problem.",
        "Submit the form; on success you are taken to your ticket thread or the Messages inbox.",
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
  },
  {
    id: "dashboard-overview",
    title: "Dashboard — Overview",
    category: "Shopping",
    quickReference: {
      summary: "Dashboard home with stats, quick actions, and workflow steps.",
      location: "Sidebar → Overview, or visit /dashboard.",
      bullets: [
        "Stat cards link to key shopping areas.",
        "Quick actions: Add product, Cart, Orders, Barrels.",
        "Workflow strip: Request → Checkout → Track → Ship.",
        "Refund banners appear when action is needed.",
      ],
      requirements: [
        "Signed-in account.",
        "Shipping address required before checkout.",
      ],
      dos: [
        "Start here after sign-in.",
        "Use quick actions instead of hunting the sidebar.",
      ],
      donts: ["Zero counts don't always mean nothing is in progress."],
    },
    article: {
      overview: [
        "Dashboard Overview is your command center after sign-in. It summarizes open quotes, cart activity, orders, and barrels at a glance, and provides shortcuts into the most common tasks.",
        "Use it to understand where you are in the Amani Cart2Barrel workflow—requesting items, checking out, tracking purchases, and preparing shipments.",
      ],
      walkthrough: [
        "Open Overview from the sidebar or navigate to /dashboard.",
        "Review stat cards for counts linking to Requested items, Cart, Orders, and Barrels.",
        "Use quick actions to jump to Add product, Cart & checkout, Active orders, or Barrels.",
        "Follow the workflow strip: Request quotes → Checkout → Track orders → Ship home.",
        "Watch for refund-awaiting banners when a return or refund needs your attention.",
      ],
      requirements: [
        "Signed-in account. A saved shipping address is required before checkout.",
      ],
      dos: [
        "Start here after sign-in to see what needs attention.",
        "Use quick actions instead of hunting through the sidebar.",
      ],
      donts: [
        "Do not assume zero counts mean nothing is in progress—check each section if you expect activity.",
      ],
    },
  },
  {
    id: "requested-items",
    title: "Requested items",
    category: "Shopping",
    quickReference: {
      summary: "Submit new US retailer requests and track quote status.",
      location: "Sidebar → Requested items, or Home → Get an estimate.",
      bullets: [
        "AI-assisted request: paste product URLs.",
        "Select a variant row to copy that row's photo into Request details.",
        "Staff publish quotes you accept into the cart.",
        "Statuses: pending, estimate ready, out of stock, withdrawn.",
        "Unread updates show in sidebar badge and bell.",
      ],
      requirements: [
        "Signed-in account.",
        "Valid US retailer product URLs.",
      ],
      dos: [
        "Paste exact product page URLs.",
        "Select variant (size/color) when required.",
        "Respond promptly when estimates are ready.",
      ],
      donts: [
        "Don't duplicate requests for the same product.",
        "Submitted ≠ purchased until you pay in cart.",
      ],
    },
    article: {
      overview: [
        "Requested items is where you start the quoting process. Paste US retailer product links, provide variant details when needed, and wait for staff to review and publish estimates you can accept into your cart.",
        "This area also tracks everything already in the pipeline—so you can see which requests are waiting, ready, out of stock, or withdrawn.",
      ],
      walkthrough: [
        "Open Requested items from the dashboard sidebar, or click Get an estimate on Home to open the AI-assisted request flow.",
        "Choose AI-assisted request to paste US retailer URLs and build a structured submission.",
        "Select a store variant in the list to copy that row's name, price, product link, size, color, and photo into Request details—not the parent listing.",
        "Click Submit for staff review to send the request to staff for a quote.",
        "Staff review your request and publish quotes when ready.",
        "Track status: pending review, estimate ready, out of stock, withdrawn, and more.",
        "Unread quote updates appear in the sidebar badge and notifications bell.",
        "When an estimate is ready, move to Add item or your notifications to accept it into the cart.",
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
  },
  {
    id: "add-item",
    title: "Add item — Products & batch quotes",
    category: "Shopping",
    quickReference: {
      summary: "Manage active quotes, history, and batch estimate sessions.",
      location: "Sidebar → Add item.",
      bullets: [
        "Products → Active: Accept estimate is pinned on the right in Actions; Quote expiry shows Time left, live HH:MM:SS, and remaining time under it.",
        "Products → Expired Quotes: estimates that passed the payment window — preview or resubmit.",
        "Products → History: past quote sessions.",
        "Batch quotes → Active: Quote expiry card (Time left, live HH:MM:SS, remainder under it) on each line.",
        "If a quoted batch has any line expire before pay/checkout, the batch ends and products return as singles.",
        "Accepting adds lines to cart at quoted price.",
      ],
      requirements: [
        "Signed-in account.",
        "Approved quote before checkout.",
        "Accept and pay before the quote expiry window ends.",
      ],
      dos: [
        "Compare alternatives when staff offers options.",
        "Review fees and the Quote expiry column before accepting.",
        "Use batch quotes for related multi-item orders.",
        "Resubmit from Expired Quotes if the window closed.",
      ],
      donts: [
        "Don't wait past the expiry window to accept or pay.",
        "Don't accept quotes you won't pay for.",
        "Quoted price ≠ future barrel shipping charges.",
      ],
    },
    article: {
      overview: [
        "Add item is your quote workspace after requests are submitted. It separates active product quotes from history, and supports batch quote sessions when you are bundling several items into one estimate.",
        "After staff quotes a product, you have a limited window (set by the hub under Admin → Quote Expiry Settings, commonly 7 days, and as short as 1 minute; staff may set a custom window for your account or a specific product) to accept it and complete payment—whether as a single line or in a batch. Retailer prices change randomly; the expiry keeps the locked estimate honest and helps avoid refunds or extra payment requests when the store price drifts. The Active table Quote expiry card shows Time left, a live HH:MM:SS timer, and remaining time underneath. When time runs out, the product moves to Expired Quotes so you can preview the old estimate or resubmit for a fresh price.",
        "Accepting a quote moves it to your cart at the quoted price. Quotes do not include a packing fee per product line. Barrel packing and outbound shipping are billed when you buy containers and when staff publish freight charges.",
      ],
      walkthrough: [
        "Navigate to Add item from the sidebar.",
        "Products → Active: review quotes you can accept, compare, or withdraw. Accept estimate and Preview stay visible in the pinned Actions column on the right; check Quote expiry before you accept.",
        "Products → Expired Quotes: preview expired estimates or resubmit as a new pending request.",
        "Products → History: browse past product quote sessions.",
        "Batch quotes → Active: manage bundled multi-item estimate sessions; check Quote expiry on each product.",
        "If any line in a staff-quoted batch expires before you pay, the batch closes and each product returns as an individual quote (expired ones appear under Expired Quotes).",
        "Accept a quote to add the line to your cart (subject to stock at purchase time).",
        "Withdraw quotes you no longer want to keep your cart accurate.",
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
        "Do not assume quoted prices include packing or future barrel freight; packing is charged on barrels and bins in the cart, and outbound freight is billed when containers ship.",
      ],
    },
  },
  {
    id: "expired-quotes",
    title: "Add item — Expired Quotes",
    category: "Shopping",
    quickReference: {
      summary:
        "Estimates that passed the accept/pay window; preview or resubmit for a new quote.",
      location:
        "Sidebar → Add item → Products → Expired Quotes.",
      bullets: [
        "Shows expiration date/time, product number, name, retailer, URL, and last quoted price.",
        "Preview expired opens the prior estimate for reference.",
        "Resubmit new request voids the old estimate and returns the line to pending for staff.",
      ],
      requirements: ["Signed-in account.", "A quoted product that passed the expiry window."],
      dos: [
        "Resubmit promptly if you still want the product.",
        "Use Preview expired to review the old fees before resubmitting.",
      ],
      donts: [
        "Do not expect to accept an expired estimate from Active—it has already moved here.",
      ],
    },
    article: {
      overview: [
        "When staff quotes a product, you have a limited window (published by the hub under Admin → Quote Expiry Settings, or a custom window if staff set one for your account or that product) to accept it and pay. That window exists because retailer prices change often—holding a quote forever would force more refunds or additional payment when the store price moves. After the window, the line leaves Active and appears under Expired Quotes.",
      ],
      walkthrough: [
        "Open Add item → Products → Expired Quotes.",
        "Review the expiration timestamp, product details, and last quoted price.",
        "Use Preview expired to inspect the old estimate.",
        "Use Resubmit new request to open a fresh pending request for staff to quote again at current retailer pricing.",
      ],
      notes: [
        "If staff have already quoted a batch estimate and any line expires before you pay or check out, that batch ends automatically and products return as single quotes.",
        "Batch accept/checkout is blocked when a line has expired; expired lines appear here after the batch dissolves.",
        "Resubmitting does not keep the expired price; staff will re-check the retailer.",
      ],
      requirements: ["Signed-in account."],
      dos: ["Act on Quoted items before the Quote expiry column reaches zero."],
      donts: ["Do not assume an expired price is still available after resubmit."],
    },
  },
  {
    id: "cart",
    title: "Cart & checkout",
    category: "Shopping",
    quickReference: {
      summary: "Review payable lines and pay securely via Stripe.",
      location: "Sidebar → Cart, or header cart icon.",
      bullets: [
        "Lists quotes, bundles, containers, in-hub products, outbound charges.",
        "Container packing in checkout follows barrel and bin counts (1 vs 2+), not a fee per quoted product.",
        "In-hub US items are highlighted as a warehouse package. Click Shipping to compare Shippo rates from USPS, UPS, and FedEx (price and estimated delivery). View shipping address / Change address apply to the package.",
        "Checkout order summary groups in-hub products the same way, lists the destination US address, and shows package shipping as its own fee.",
        "After payment, Preview checkout charges on Orders shows the same warehouse grouping, destination address, and shipping fee without duplicating product lines.",
        "Paid order receipts include the warehouse box size for in-hub US packages. Merchandise and warehouse package shipping are listed separately (shipping also appears in the totals). For those orders, From is Amani Cart2Barrel at the primary hub ship-from address, and Bill to is the US ship-to on the warehouse package (not the Jamaica barrel address). The same invoice is listed under Manage account → Billing Receipt as In-hub product receipt.",
        "Remove unwanted lines before checkout.",
        "Stripe embedded checkout for payment.",
        "Success page View orders opens that paid order's product list.",
      ],
      requirements: [
        "Signed-in account.",
        "At least one cart line.",
        "Shipping address on file.",
        "Valid Stripe payment method.",
      ],
      dos: [
        "Verify address under Shipping → Address first.",
        "Save receipt from success page or Billing Receipt.",
      ],
      donts: [
        "Don't close browser mid-checkout unless payment succeeded.",
        "Only accepted quotes appear in cart.",
      ],
    },
    article: {
      overview: [
        "The cart holds everything approved and waiting for payment—product quotes, batch bundles, shipping containers, and outbound freight. Checkout uses Stripe's embedded payment flow for secure card processing. Packing fees on container lines follow how many barrels and bins you are buying (single vs 2+ rates), not a fee on each quoted product.",
        "Nothing in your cart is a paid order until checkout completes successfully. Review every line, fee, and total before paying.",
      ],
      walkthrough: [
        "Open Cart from the sidebar or click the cart icon in the header.",
        "Review each payable line with fees and running totals.",
        "For in-hub products shipping to a US address, the highlighted warehouse package groups every SKU going to that address. Click Shipping to have Shippo retrieve USPS, UPS, and FedEx rates so you can compare price and estimated delivery, then apply the rate you want. Hover the info balloon next to In-hub warehouse package for how hub SKUs ship. Open View shipping address or Change address to pick a saved United States address; the package rate refreshes when you change address or check out.",
        "Remove lines you no longer want before starting checkout.",
        "Click checkout to open the secure Stripe embedded payment session.",
        "On checkout, in-hub products stay grouped in a highlighted warehouse package with merchandise, the bundled shipping fee, and the destination US address listed separately. New checkouts also split that fee onto each SKU by catalog price.",
        "After you pay, Preview checkout charges on Orders shows the same warehouse grouping, destination address, merchandise, and shipping fee—without a second product list.",
        "Complete payment in one session when possible.",
        "After success, the confirmation page summarizes your order. View orders (on the summary and in the payment toast) opens that paid order's product list on Orders. Paid in-hub checkouts also appear under Manage account → Billing Receipt as In-hub product receipt (filter Show to In-hub products).",
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
  },
  {
    id: "orders",
    title: "Orders (active & history)",
    category: "Orders & shipping",
    quickReference: {
      summary: "Track purchases, tracking, refunds, and returns after payment.",
      location: "Sidebar → Orders; history at /dashboard/orders-history.",
      bullets: [
        "Active orders: in-progress hub fulfillment.",
        "History: completed or closed orders.",
        "Line details, tracking, refund/return actions.",
        "In-hub catalog photos appear on order cards. Paid in-hub US packages show as Awaiting shipment in In progress until staff generate a Shippo label (or enter tracking), then In transit to you. Order products keeps one Track shipment control in the header for the warehouse package (not on each product card), plus live carrier status from Shippo. After the package is delivered, it moves to Orders history as Delivered to you. Request return from history for in-hub US items; the line returns to Orders while staff generate a return label. Print the label from Preview request, drop the package at a carrier location, and watch live return tracking until the warehouse receives it.",
        "Preview checkout charges groups in-hub products as a warehouse package, shows the destination US address, lists merchandise and package shipping separately, and does not repeat the product list in a second breakdown.",
        "Opening Line charges for one in-hub SKU shows that product's share of the warehouse package shipping (split by catalog price), not the full package rate on a single line.",
        "When staff ship an in-hub US package, a notification includes carrier and tracking; Order products shows one Track shipment / Tracking details control in the header, plus live carrier status. When the package arrives (staff Next or a Shippo delivered webhook), a delivered notification links to Orders history.",
        "Actions depend on current order status.",
      ],
      requirements: ["Signed-in account.", "Paid order for data to appear."],
      dos: [
        "Monitor tracking and warehouse notifications.",
        "Contact support with order ID if something's wrong.",
      ],
      donts: [
        "Don't request refund after accepting final delivery unless allowed.",
        "Live status updates when Shippo sends a tracking event; refresh if it still looks stale.",
      ],
    },
    article: {
      overview: [
        "Orders is where paid purchases live after checkout. Track hub buying progress, carrier tracking, warehouse receipt, refunds, returns, and delivery acceptance—all scoped to your account.",
        "Active orders show what's in motion; Orders history shows completed or closed activity.",
      ],
      walkthrough: [
        "Open Orders from the sidebar for in-progress purchases.",
        "Visit Orders history for completed or closed orders.",
        "Select an order to view line details, tracking numbers, and status. In-hub catalog photos appear on each product card when staff uploaded them on the SKU. Paid in-hub US packages in transit show as In transit to you; Track shipment sits in the Order products header for the warehouse package. After delivery they appear in Orders history as Delivered to you.",
        "For an in-hub US product in Orders history, Request return submits a warehouse return. After staff generate the label, open Preview request to download the PDF, then drop the package at USPS, UPS, or FedEx. Live return tracking appears on the order; you are notified when the warehouse receives it.",
        "Preview checkout charges shows the warehouse package, destination US address, merchandise, and package shipping.",
        "Open Line charges on a single in-hub product to see that SKU's catalog price plus its share of the warehouse package shipping.",
        "When an in-hub US package ships, the bell notification includes carrier and tracking; open the order and use Track shipment in the Order products header (one control for the warehouse package) plus live carrier status. When the package is marked delivered (including via Shippo), a notification links to Orders history.",
        "Use in-order actions such as accept delivery or request refund/return when the status allows them.",
        "Watch the notifications bell for purchase, tracking, and warehouse updates.",
      ],
      requirements: [
        "Signed-in account.",
        "At least one paid order for data to appear.",
      ],
      dos: [
        "Monitor tracking updates and warehouse receipt notifications.",
        "Use in-order actions only when the status allows them.",
        "For an in-hub US return, print the label from Preview request and drop the package at a carrier location.",
        "Contact support with your order ID if something looks wrong.",
      ],
      donts: [
        "Do not request a refund after accepting final delivery unless policy allows.",
        "Do not assume carrier tracking is instant—live status arrives when Shippo sends a tracking event; refresh or check notifications if it still looks stale.",
      ],
    },
  },
  {
    id: "barrels",
    title: "Barrels — Shop, assign & history",
    category: "Orders & shipping",
    quickReference: {
      summary: "Buy containers, assign received products, view assignment history.",
      location: "Sidebar → Barrels.",
      bullets: [
        "Shop: add containers to cart. Packing fees use barrel and bin counts (1 vs 2+ of each type).",
        "Product to barrel: pack hub-received items.",
        "History: past assignments.",
        "Containers must be paid before packing.",
      ],
      requirements: [
        "Signed-in account.",
        "Paid container for assignment.",
        "Products received at hub.",
      ],
      dos: [
        "Choose the right container size.",
        "Assign promptly for faster outbound shipping.",
      ],
      donts: [
        "Don't assign to unpaid barrels.",
        "Ask support if unsure about container rules.",
      ],
    },
    article: {
      overview: [
        "Barrels are Amani Cart2Barrel's shipping containers for consolidated international delivery. Shop for containers, assign warehouse-received products into them, and review past assignments from this section.",
        "Containers must be purchased before products can be packed for outbound shipment. Assignment is how you tell the hub which items belong in which barrel.",
      ],
      walkthrough: [
        "Shop tab: browse container offerings and add barrels or bins to your cart. Checkout adds packing based on how many barrels and bins are in the cart—not a packing fee on each quoted product.",
        "Pay for containers through the normal cart checkout flow.",
        "Product to barrel tab: assign hub-received items into a paid container.",
        "History tab: review past product-to-barrel assignment sessions.",
        "After assignment, proceed to Shipping for tracking and outbound charges when containers are ready.",
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
  },
  {
    id: "shipping",
    title: "Shipping — Tracking, pricing & address",
    category: "Orders & shipping",
    quickReference: {
      summary: "Delivery address, barrel tracking, and outbound freight charges.",
      location: "Sidebar → Shipping.",
      bullets: [
        "Tracking: shipment intake and carrier status.",
        "Pricing: pay the US outbound quote when containers are ready. Destination-country charges on arrival are not included.",
        "Address: name, phone, and delivery street on each record; multiple addresses, one primary.",
        "/dashboard/settings redirects here.",
      ],
      requirements: [
        "Signed-in account.",
        "Saved address for outbound shipment.",
        "Containers in pipeline for tracking/pricing.",
      ],
      dos: [
        "Keep address current before barrels ship.",
        "Pay outbound charges promptly.",
      ],
      donts: [
        "Don't use gear settings for address—use Address tab.",
        "Don't ignore Pricing tab charges.",
        "Don't assume destination duties are in the US outbound quote.",
      ],
    },
    article: {
      overview: [
        "Shipping covers everything after products reach the hub and barrels enter the outbound pipeline: your delivery address, shipment tracking, customs/intake forms, and freight charges when containers are ready to leave.",
        "Account contact and shipping street are saved together on each address under the Address tab. You may keep several addresses and mark one as primary. /dashboard/settings redirects here for account shipping settings.",
      ],
      walkthrough: [
        "Tracking tab: submit and view barrel shipment intake details and carrier tracking.",
        "Pricing tab: appears when containers are ready—review and pay the US outbound quote (freight and any customs or pickup fees staff listed). Destination-country charges after arrival are billed locally and are not included in that quote.",
        "Address tab: add or edit shipping records (name, phone, and street together). Mark one as primary for barrels and invoices.",
        "Complete any customs or intake forms when prompted to avoid shipment delays.",
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
        "Do not treat the US outbound quote as covering destination duties, inland delivery, or local handling.",
      ],
    },
  },
  {
    id: "support-messages",
    title: "Messages (support inbox)",
    category: "Support",
    quickReference: {
      summary: "View, search, and reply to support tickets; remove threads to History.",
      location: "Sidebar → Messages, or /dashboard/support.",
      bullets: [
        "Unread count badges the Messages nav item.",
        "Search, filter, and paginate your inbox.",
        "New / Read badges on each conversation.",
        "Remove moves a thread to the History tab.",
        "Price-update decisions: check an option, optional note/image, then send.",
      ],
      requirements: ["Signed-in account."],
      dos: [
        "Reply in the existing thread.",
        "Use History to restore removed conversations.",
      ],
      donts: [
        "Can't edit sent messages—add a new reply.",
        "Don't use Messages for new quote requests.",
      ],
    },
    article: {
      overview: [
        "Messages is your support inbox for tickets opened through Contact us or order-related issues. Keep conversations in one thread so the hub team has full context when helping you.",
        "New replies from support appear in your notifications bell and as a badge on Messages. Opening a thread marks it read. Remove sends a conversation to History without deleting it.",
      ],
      walkthrough: [
        "Open Messages from the sidebar (badge shows unread hub replies).",
        "Search or filter, then open a conversation.",
        "For purchase price updates, check one decision option; optionally add a note or image, then send.",
        "Remove threads you do not need — they move to History.",
      ],
      requirements: ["Signed-in account."],
      dos: [
        "Reply in the existing thread for continuity.",
        "Restore removed threads from History when needed.",
      ],
      donts: [
        "Do not delete or edit sent messages—add a new reply instead.",
        "Do not use Messages for new quote requests—use Requested items or Add item.",
      ],
    },
  },
  {
    id: "support-messages-history",
    title: "Messages — History",
    category: "Support",
    quickReference: {
      summary: "Removed conversations, searchable and restorable.",
      location: "Messages → History, or /dashboard/support/history.",
      bullets: [
        "Removed badge on archived threads.",
        "Restore returns a thread to the inbox.",
        "Same search, filter, and pagination as Messages.",
      ],
      requirements: ["Signed-in account."],
      dos: ["Restore a thread before replying if you still need it."],
      donts: ["History is not permanent delete—staff can still see the ticket."],
    },
    article: {
      overview: [
        "History holds conversations you removed from Messages. Threads stay available to restore and remain visible to the hub team.",
      ],
      walkthrough: [
        "Open Messages → History.",
        "Search or filter removed threads.",
        "Use Restore to move a conversation back to the inbox.",
      ],
      requirements: ["Signed-in account."],
      dos: ["Use History to declutter without losing context."],
      donts: ["Do not expect History removal to erase the ticket for support staff."],
    },
  },
  {
    id: "user-guide",
    title: "User guide (How it works)",
    category: "Getting started",
    quickReference: {
      summary:
        "Full customer documentation with quick reference and articles for every page.",
      location: "How it works → User guide tab, or dashboard header → Documentation.",
      bullets: [
        "Public on /how-it-works?tab=user-guide (no sign-in required).",
        "Also available as Documentation in the signed-in dashboard header.",
        "Search topics; each has Quick reference and Full article views.",
      ],
      requirements: ["None for the public How it works tab."],
      dos: [
        "Share the How it works User guide link with prospects.",
        "Use Documentation in the dashboard when already signed in.",
      ],
      donts: [
        "Don't confuse with Admin guide (/admin/guide)—staff only.",
      ],
    },
    article: {
      overview: [
        "The User guide is Amani Cart2Barrel's customer documentation. It explains every shopper-facing page, header control, and account feature with scannable quick references and deeper articles. How it works → Overview is the public service explainer (pricing charts and cost phases); this User guide tab is the formal page-by-page reference.",
        "Guests can read it on How it works → User guide without an account. Signed-in customers can open the same content from the dashboard Documentation button.",
      ],
      walkthrough: [
        "Open How it works from the marketing header, then select the User guide tab.",
        "Or, when signed in, click Documentation in the dashboard top bar.",
        "Search or browse topics in the left sidebar grouped by category.",
        "Use Quick reference for at-a-glance rules; switch to Full article for step-by-step detail.",
      ],
      requirements: ["No account required on the public How it works tab."],
      dos: [
        "Read Getting started topics before your first item request.",
        "Refer back when unsure about checkout, shipping, or account security.",
      ],
      donts: [
        "Do not use the user guide as a substitute for support on urgent order issues—use Contact us.",
      ],
    },
  },
];

const CUSTOMER_DOCUMENTATION_CONTENT = toContentRecord(
  CUSTOMER_DOCUMENTATION_CONTENT_RAW,
);

assertDocumentationSync(
  CUSTOMER_UI_SURFACES,
  CUSTOMER_DOCUMENTATION_CONTENT,
  "customer",
);
assertSidebarNavMatchesSurfaces(
  CUSTOMER_SIDEBAR_NAV_LINKS,
  CUSTOMER_UI_SURFACES,
  "customer",
);

export const USER_DOCUMENTATION_SECTIONS = buildDocumentationSections(
  CUSTOMER_UI_SURFACES,
  CUSTOMER_DOCUMENTATION_CONTENT,
);

export function getDocumentationByCategory(): Record<
  DocumentationCategory,
  DocumentationSection[]
> {
  return groupDocumentationByCategory(DOCUMENTATION_CATEGORIES, USER_DOCUMENTATION_SECTIONS);
}
