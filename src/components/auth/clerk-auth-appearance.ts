import { dark, shadcn } from "@clerk/themes";
import type { SignIn } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type ClerkAuthAppearance = NonNullable<
  ComponentProps<typeof SignIn>["appearance"]
>;

const clerkFontFamily =
  "var(--font-poppins), ui-sans-serif, system-ui, sans-serif";

/** Explicit dark palette — Clerk modals do not always inherit app CSS variables. */
const clerkDarkVariables = {
  fontFamily: clerkFontFamily,
  borderRadius: "0.625rem",
  colorBackground: "#1c1c1f",
  colorForeground: "#fafafa",
  colorInput: "#2a2a2f",
  colorInputForeground: "#fafafa",
  colorMuted: "#2a2a2f",
  colorMutedForeground: "#a1a1aa",
  colorNeutral: "#fafafa",
  colorPrimary: "#60a5fa",
  colorPrimaryForeground: "#0f172a",
  colorDanger: "#f87171",
  colorRing: "#52525b",
  colorModalBackdrop: "rgba(0, 0, 0, 0.75)",
} as const;

/** Shared Clerk appearance — maps to app shadcn CSS variables (light/dark via `html` class). */
export const clerkBaseAppearance: ClerkAuthAppearance = {
  baseTheme: shadcn,
  variables: {
    fontFamily: clerkFontFamily,
    borderRadius: "0.625rem",
  },
};

export const clerkAuthCardAppearance: ClerkAuthAppearance = {
  ...clerkBaseAppearance,
  elements: {
    rootBox: "mx-auto w-full max-w-[420px]",
    card: "shadow-xl ring-1 ring-border/60",
  },
};

export const clerkUserButtonAppearance: ClerkAuthAppearance = {
  baseTheme: dark,
  variables: clerkDarkVariables,
  elements: {
    userButtonPopoverCard:
      "bg-[#1c1c1f] text-zinc-50 ring-1 ring-zinc-700",
    userButtonPopoverActionButton: "text-zinc-100 hover:bg-zinc-800",
    userButtonPopoverActionButtonText: "text-zinc-100",
    userButtonPopoverActionButtonIcon: "text-zinc-300",
    userButtonPopoverFooter: "border-t border-zinc-700",
    modalContent: "bg-[#1c1c1f] text-zinc-50",
    cardBox: "bg-[#1c1c1f] text-zinc-50 shadow-xl ring-1 ring-zinc-700",
    navbar: "bg-[#252528] text-zinc-50 border-zinc-700",
    navbarButton: "text-zinc-200 hover:bg-zinc-700",
    navbarButtonIcon: "text-zinc-400",
    pageScrollBox: "bg-[#1c1c1f] text-zinc-50",
    headerTitle: "text-zinc-50",
    headerSubtitle: "text-zinc-400",
    profileSectionTitle: "text-zinc-50",
    profileSectionContent: "text-zinc-200",
    profileSectionPrimaryButton: "bg-sky-600 text-white hover:bg-sky-500",
    formFieldLabel: "text-zinc-200",
    formFieldInput: "bg-zinc-800 text-zinc-100 border-zinc-600",
    badge: "bg-zinc-700 text-zinc-200 border-zinc-600",
    menuList: "bg-[#1c1c1f] text-zinc-50",
    menuItem: "text-zinc-100 hover:bg-zinc-800",
    buttonArrowIcon: "text-zinc-400",
    footerActionLink: "text-sky-400 hover:text-sky-300",
    footerActionText: "text-zinc-400",
  },
};