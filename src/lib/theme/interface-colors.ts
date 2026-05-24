export const INTERFACE_COLOR_STORAGE_KEY = "cart2barrel-interface-color";

export const INTERFACE_COLOR_IDS = [
  "default",
  "blue",
  "violet",
  "emerald",
  "amber",
  "rose",
  "orange",
  "teal",
  "fuchsia",
] as const;

export type InterfaceColorId = (typeof INTERFACE_COLOR_IDS)[number];

export type ThemeMode = "light" | "dark";

type ColorTokens = {
  primary: string;
  primaryForeground: string;
  ring: string;
  sidebarPrimary: string;
  brandLogoGlow: string;
};

export type InterfaceColorPreset = {
  label: string;
  swatch: string;
  light: ColorTokens;
  dark: ColorTokens;
};

export const INTERFACE_COLORS: Record<InterfaceColorId, InterfaceColorPreset> = {
  default: {
    label: "Default",
    swatch: "oklch(0.55 0 0)",
    light: {
      primary: "oklch(0.205 0 0)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.708 0 0)",
      sidebarPrimary: "oklch(0.205 0 0)",
      brandLogoGlow: "oklch(0.55 0 0)",
    },
    dark: {
      primary: "oklch(0.922 0 0)",
      primaryForeground: "oklch(0.205 0 0)",
      ring: "oklch(0.556 0 0)",
      sidebarPrimary: "oklch(0.488 0.243 264.376)",
      brandLogoGlow: "oklch(0.488 0.243 264.376)",
    },
  },
  blue: {
    label: "Blue",
    swatch: "oklch(0.55 0.22 264)",
    light: {
      primary: "oklch(0.45 0.2 264)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.55 0.18 264)",
      sidebarPrimary: "oklch(0.45 0.2 264)",
      brandLogoGlow: "oklch(0.55 0.22 264)",
    },
    dark: {
      primary: "oklch(0.62 0.19 264)",
      primaryForeground: "oklch(0.15 0.02 264)",
      ring: "oklch(0.55 0.16 264)",
      sidebarPrimary: "oklch(0.55 0.2 264)",
      brandLogoGlow: "oklch(0.62 0.22 264)",
    },
  },
  violet: {
    label: "Violet",
    swatch: "oklch(0.55 0.22 293)",
    light: {
      primary: "oklch(0.45 0.2 293)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.55 0.18 293)",
      sidebarPrimary: "oklch(0.45 0.2 293)",
      brandLogoGlow: "oklch(0.55 0.22 293)",
    },
    dark: {
      primary: "oklch(0.65 0.18 293)",
      primaryForeground: "oklch(0.15 0.02 293)",
      ring: "oklch(0.55 0.16 293)",
      sidebarPrimary: "oklch(0.55 0.2 293)",
      brandLogoGlow: "oklch(0.65 0.22 293)",
    },
  },
  emerald: {
    label: "Emerald",
    swatch: "oklch(0.55 0.16 155)",
    light: {
      primary: "oklch(0.42 0.14 155)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.52 0.12 155)",
      sidebarPrimary: "oklch(0.42 0.14 155)",
      brandLogoGlow: "oklch(0.55 0.16 155)",
    },
    dark: {
      primary: "oklch(0.68 0.14 155)",
      primaryForeground: "oklch(0.15 0.02 155)",
      ring: "oklch(0.52 0.12 155)",
      sidebarPrimary: "oklch(0.55 0.14 155)",
      brandLogoGlow: "oklch(0.68 0.16 155)",
    },
  },
  amber: {
    label: "Amber",
    swatch: "oklch(0.72 0.17 75)",
    light: {
      primary: "oklch(0.55 0.15 75)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.65 0.14 75)",
      sidebarPrimary: "oklch(0.55 0.15 75)",
      brandLogoGlow: "oklch(0.72 0.17 75)",
    },
    dark: {
      primary: "oklch(0.78 0.14 75)",
      primaryForeground: "oklch(0.2 0.03 75)",
      ring: "oklch(0.65 0.12 75)",
      sidebarPrimary: "oklch(0.72 0.15 75)",
      brandLogoGlow: "oklch(0.78 0.16 75)",
    },
  },
  rose: {
    label: "Rose",
    swatch: "oklch(0.58 0.2 12)",
    light: {
      primary: "oklch(0.5 0.18 12)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.58 0.16 12)",
      sidebarPrimary: "oklch(0.5 0.18 12)",
      brandLogoGlow: "oklch(0.58 0.2 12)",
    },
    dark: {
      primary: "oklch(0.65 0.17 12)",
      primaryForeground: "oklch(0.15 0.02 12)",
      ring: "oklch(0.55 0.14 12)",
      sidebarPrimary: "oklch(0.58 0.18 12)",
      brandLogoGlow: "oklch(0.65 0.2 12)",
    },
  },
  orange: {
    label: "Orange",
    swatch: "oklch(0.65 0.18 45)",
    light: {
      primary: "oklch(0.52 0.16 45)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.62 0.14 45)",
      sidebarPrimary: "oklch(0.52 0.16 45)",
      brandLogoGlow: "oklch(0.65 0.18 45)",
    },
    dark: {
      primary: "oklch(0.72 0.15 45)",
      primaryForeground: "oklch(0.18 0.03 45)",
      ring: "oklch(0.6 0.13 45)",
      sidebarPrimary: "oklch(0.65 0.16 45)",
      brandLogoGlow: "oklch(0.72 0.17 45)",
    },
  },
  teal: {
    label: "Teal",
    swatch: "oklch(0.55 0.12 180)",
    light: {
      primary: "oklch(0.42 0.1 180)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.52 0.09 180)",
      sidebarPrimary: "oklch(0.42 0.1 180)",
      brandLogoGlow: "oklch(0.55 0.12 180)",
    },
    dark: {
      primary: "oklch(0.68 0.11 180)",
      primaryForeground: "oklch(0.15 0.02 180)",
      ring: "oklch(0.52 0.09 180)",
      sidebarPrimary: "oklch(0.55 0.11 180)",
      brandLogoGlow: "oklch(0.68 0.13 180)",
    },
  },
  fuchsia: {
    label: "Fuchsia",
    swatch: "oklch(0.58 0.24 320)",
    light: {
      primary: "oklch(0.48 0.22 320)",
      primaryForeground: "oklch(0.985 0 0)",
      ring: "oklch(0.58 0.18 320)",
      sidebarPrimary: "oklch(0.48 0.22 320)",
      brandLogoGlow: "oklch(0.58 0.24 320)",
    },
    dark: {
      primary: "oklch(0.65 0.2 320)",
      primaryForeground: "oklch(0.15 0.02 320)",
      ring: "oklch(0.55 0.16 320)",
      sidebarPrimary: "oklch(0.58 0.22 320)",
      brandLogoGlow: "oklch(0.65 0.24 320)",
    },
  },
};

export function isInterfaceColorId(value: string): value is InterfaceColorId {
  return (INTERFACE_COLOR_IDS as readonly string[]).includes(value);
}

export function readStoredInterfaceColor(): InterfaceColorId {
  if (typeof window === "undefined") {
    return "default";
  }
  const stored = window.localStorage.getItem(INTERFACE_COLOR_STORAGE_KEY);
  if (stored && isInterfaceColorId(stored)) {
    return stored;
  }
  return "default";
}

export function applyInterfaceColor(colorId: InterfaceColorId): void {
  const root = document.documentElement;
  if (colorId === "default") {
    root.removeAttribute("data-interface-color");
    return;
  }
  root.setAttribute("data-interface-color", colorId);
}
