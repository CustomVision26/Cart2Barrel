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
        "Guests see Sign in / Sign up; signed-in users see Dashboard.",
        "New users may be sent to onboarding before Home loads.",
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
        "The Home page is Cart2Barrel's public marketing storefront. It introduces the service, showcases featured US retailer products in a spotlight carousel, and gives visitors a clear path to sign in or create an account.",
        "For signed-in customers, Home acts as a bridge between marketing content and the dashboard. Depending on your onboarding status, you may be routed to complete contact details—or you can skip onboarding to explore first.",
      ],
      walkthrough: [
        "Browse the hero section for a high-level overview of the service.",
        "Scroll to the spotlight carousel for featured product highlights from US retailers.",
        "Use the header: How it works (public guide), Sign in, Sign up, or Dashboard (when signed in).",
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
        "Public guide explaining the full Cart2Barrel journey from quote to delivery.",
      location: "Marketing header → How it works, or visit /how-it-works.",
      bullets: [
        "Explains service fees and container options.",
        "Walks through the customer journey step by step.",
        "Shows the container catalog and typical timelines.",
        "No sign-in required.",
      ],
      requirements: ["None—public page."],
      dos: [
        "Read before your first item request.",
        "Refer back when a fee or step is unclear.",
      ],
      donts: ["Don't treat example fees as binding quotes."],
    },
    article: {
      overview: [
        "How it works is Cart2Barrel's public service explainer. It describes how US retailer shopping, hub processing, barrel consolidation, and international delivery fit together—so you know what to expect before you submit your first request.",
        "The page covers service fees, shipping containers, and the end-to-end customer journey. Anyone can read it without signing in.",
      ],
      walkthrough: [
        "Open How it works from the marketing site header or go directly to /how-it-works.",
        "Review the service fee structure and how charges apply to your orders.",
        "Browse the container catalog to understand barrel size options.",
        "Follow the illustrated customer journey from request through quote, payment, warehouse receipt, barrel packing, and final delivery.",
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
        "Step 1: Account contact (name and phone).",
        "Step 2: Shipping address for barrel delivery.",
        "Skip sends you to Home without saving details.",
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
        "Onboarding is the first account setup step after sign-up. It collects your legal contact information and primary delivery address—the label used when barrels ship to you anywhere in the world.",
        "You are not forced to complete every field immediately. The Skip control on the contact form lets you browse the storefront and dashboard first. Skipping does not save your details; you must add them under Dashboard → Shipping → Address before you can pay for cart items.",
      ],
      walkthrough: [
        "New signed-in users are directed here from Home until they complete or skip onboarding.",
        "Step 1 — Account contact: enter your full name and phone number used for billing and hub communication.",
        "Step 2 — Shipping address: enter the worldwide delivery address for barrel shipments.",
        "Optional — Skip: on the contact form, click Skip to bypass onboarding and go to Home immediately.",
        "After saving both steps without skipping, you are redirected to Home or the dashboard.",
        "If you skipped, return later to Dashboard → Shipping → Address to add contact and delivery details before checkout.",
      ],
      notes: [
        "Account contact (name/phone) and shipping address are stored separately—both may be needed for orders and delivery.",
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
        "The settings gear controls how Cart2Barrel looks on your device. It affects theme mode and accent color only—it does not change your account contact, shipping address, password, or notification preferences.",
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
        "Billing Receipt: invoices and Stripe receipts.",
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
        "Manage account is your Clerk-powered identity hub inside Cart2Barrel. It handles everything related to how you sign in—profile details, password, device sessions, and account deletion—plus a custom Billing Receipt tab for payment records.",
        "Cart2Barrel-specific data such as legal contact name and shipping address live separately under Dashboard → Shipping → Address. Keep both your Clerk profile and Cart2Barrel shipping details up to date.",
      ],
      walkthrough: [
        "Click your avatar in the top-right corner of the dashboard header.",
        "Select Manage account to open the account modal.",
        "Profile tab: update your profile image, display name, and primary email (managed by Clerk).",
        "Security tab: change password, review active devices, or permanently delete your account—see the Security tab guide for detail.",
        "Billing Receipt tab: view and download payment invoices, Stripe receipts, and refund records for your orders.",
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
        "Do not use the Clerk profile name as a substitute for the legal contact name on Dashboard → Shipping → Address; both may be needed for different purposes.",
        "Do not share session or security codes.",
        "Do not delete your account from the Security tab unless you understand that deletion is permanent and Cart2Barrel data cannot be restored—read the Security tab guide first.",
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
        "Delete account is permanent and removes Cart2Barrel data.",
        "No 2FA or backup codes in Cart2Barrel today.",
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
        "The Security tab protects your Cart2Barrel sign-in. In the current app, it shows three areas: Password, Active devices, and Delete account. Two-step verification and backup codes are not enabled for Cart2Barrel customers at this time—account protection relies on your password and reviewing where you are signed in.",
        "Deleting your account from this tab is irreversible. It removes your Clerk login and triggers deletion of your Cart2Barrel profile, orders, and payment records.",
      ],
      walkthrough: [
        "Open your avatar → Manage account → Security.",
        "Password: your password appears as dots. Click Update password to set a new one—you may need to confirm your current password or verify by email.",
        "Active devices: each row shows device type, browser, location, IP, and last activity. This device is labeled This device. Use the ⋯ menu on other rows to sign out sessions you do not recognize.",
        "Delete account: at the bottom, click Delete account and complete Clerk's confirmation steps.",
        "After deletion, you cannot sign in again. Cart2Barrel removes your profile, orders, and payment records. Downloaded PDFs on your device are kept; in-app copies are gone.",
      ],
      notes: [
        "Two-step verification and backup codes are not shown in Cart2Barrel's Security tab today. If added in a future update, they would appear as an additional section here.",
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
        "Do not delete your account if you still have unpaid cart lines, orders in progress, or shipments you need to track—deletion removes your Cart2Barrel data and you will lose dashboard access.",
        "Do not assume Cart2Barrel or Clerk can restore your profile, order history, or messages after deletion—once removed, that data is not recoverable.",
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
        "Use it to understand where you are in the Cart2Barrel workflow—requesting items, checking out, tracking purchases, and preparing shipments.",
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
      location: "Sidebar → Requested items.",
      bullets: [
        "AI-assisted request: paste product URLs.",
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
        "Open Requested items from the dashboard sidebar.",
        "Choose AI-assisted request to paste US retailer URLs and build a structured submission.",
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
        "Products → Active: accept, compare, or withdraw quotes.",
        "Products → History: past quote sessions.",
        "Batch quotes → Active: multi-item bundles.",
        "Accepting adds lines to cart at quoted price.",
      ],
      requirements: [
        "Signed-in account.",
        "Approved quote before checkout.",
      ],
      dos: [
        "Compare alternatives when staff offers options.",
        "Review fees before accepting.",
        "Use batch quotes for related multi-item orders.",
      ],
      donts: [
        "Don't accept quotes you won't pay for.",
        "Quoted price ≠ future barrel shipping charges.",
      ],
    },
    article: {
      overview: [
        "Add item is your quote workspace after requests are submitted. It separates active product quotes from history, and supports batch quote sessions when you are bundling several items into one estimate.",
        "Accepting a quote moves it to your cart at the quoted price. Barrel and outbound shipping charges are typically billed later when containers are ready to ship.",
      ],
      walkthrough: [
        "Navigate to Add item from the sidebar.",
        "Products → Active: review quotes you can accept, compare, or withdraw.",
        "Products → History: browse past product quote sessions.",
        "Batch quotes → Active: manage bundled multi-item estimate sessions.",
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
        "Do not assume quoted prices include future shipping barrel charges; those are billed separately when containers ship.",
      ],
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
        "Lists quotes, bundles, containers, outbound charges.",
        "Remove unwanted lines before checkout.",
        "Stripe embedded checkout for payment.",
        "Success page links to orders after payment.",
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
        "The cart holds everything approved and waiting for payment—product quotes, batch bundles, shipping containers, and outbound freight. Checkout uses Stripe's embedded payment flow for secure card processing.",
        "Nothing in your cart is a paid order until checkout completes successfully. Review every line, fee, and total before paying.",
      ],
      walkthrough: [
        "Open Cart from the sidebar or click the cart icon in the header.",
        "Review each payable line with fees and running totals.",
        "Remove lines you no longer want before starting checkout.",
        "Click checkout to open the secure Stripe embedded payment session.",
        "Complete payment in one session when possible.",
        "After success, the confirmation page summarizes your order and links to active orders.",
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
        "Actions depend on current order status.",
      ],
      requirements: ["Signed-in account.", "Paid order for data to appear."],
      dos: [
        "Monitor tracking and warehouse notifications.",
        "Contact support with order ID if something's wrong.",
      ],
      donts: [
        "Don't request refund after accepting final delivery unless allowed.",
        "Tracking may not update in real time.",
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
        "Select an order to view line details, tracking numbers, and status.",
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
        "Contact support with your order ID if something looks wrong.",
      ],
      donts: [
        "Do not request a refund after accepting final delivery unless policy allows.",
        "Do not assume carrier tracking updates in real time—refresh or check notifications.",
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
        "Shop: add containers to cart.",
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
        "Barrels are Cart2Barrel's shipping containers for consolidated international delivery. Shop for containers, assign warehouse-received products into them, and review past assignments from this section.",
        "Containers must be purchased before products can be packed for outbound shipment. Assignment is how you tell the hub which items belong in which barrel.",
      ],
      walkthrough: [
        "Shop tab: browse container offerings and add barrels to your cart.",
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
        "Pricing: pay outbound charges when containers are ready.",
        "Address: legal contact and delivery address.",
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
      ],
    },
    article: {
      overview: [
        "Shipping covers everything after products reach the hub and barrels enter the outbound pipeline: your delivery address, shipment tracking, customs/intake forms, and freight charges when containers are ready to leave.",
        "Account contact and shipping address are managed on the Address tab. /dashboard/settings redirects here for account shipping settings.",
      ],
      walkthrough: [
        "Tracking tab: submit and view barrel shipment intake details and carrier tracking.",
        "Pricing tab: appears when containers are ready—review and pay outbound freight and customs charges.",
        "Address tab: update legal contact (name, phone) and your primary worldwide delivery address.",
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
      ],
    },
  },
  {
    id: "support-messages",
    title: "Messages (support inbox)",
    category: "Support",
    quickReference: {
      summary: "View and reply to support tickets in one inbox.",
      location: "Sidebar → Messages, or /dashboard/support.",
      bullets: [
        "Lists tickets with status and last update.",
        "Open a thread to read and reply.",
        "Images optional in replies.",
        "Support replies trigger bell notifications.",
      ],
      requirements: ["Signed-in account."],
      dos: [
        "Reply in the existing thread.",
        "Reference order IDs in follow-ups.",
      ],
      donts: [
        "Can't edit sent messages—add a new reply.",
        "Don't use Messages for new quote requests.",
      ],
    },
    article: {
      overview: [
        "Messages is your support inbox for tickets opened through Contact us or order-related issues. Keep conversations in one thread so the hub team has full context when helping you.",
        "New replies from support appear in your notifications bell as well as in the ticket thread.",
      ],
      walkthrough: [
        "Open Messages from the sidebar or navigate to /dashboard/support.",
        "Browse your ticket list with status and last-update timestamps.",
        "Click a ticket to read the full conversation thread.",
        "Send replies with optional image attachments.",
        "Check the notifications bell when support responds.",
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
        "The User guide is Cart2Barrel's customer documentation. It explains every shopper-facing page, header control, and account feature with scannable quick references and deeper articles.",
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
