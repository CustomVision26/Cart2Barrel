"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyInterfaceColor,
  INTERFACE_COLOR_STORAGE_KEY,
  readStoredInterfaceColor,
  type InterfaceColorId,
} from "@/lib/theme/interface-colors";

export const THEME_STORAGE_KEY = "cart2barrel-theme";

export type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: ThemeMode;
};

type AppearanceContextValue = {
  interfaceColor: InterfaceColorId;
  setInterfaceColor: (colorId: InterfaceColorId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light"
    ? "light"
    : "dark";
}

function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within ThemeProvider");
  }
  return context;
}

function InterfaceColorSync({ children }: { children: ReactNode }) {
  const [interfaceColor, setInterfaceColorState] = useState<InterfaceColorId>(
    "default",
  );

  useLayoutEffect(() => {
    const stored = readStoredInterfaceColor();
    setInterfaceColorState(stored);
    applyInterfaceColor(stored);
  }, []);

  const setInterfaceColor = useCallback((colorId: InterfaceColorId) => {
    setInterfaceColorState(colorId);
    applyInterfaceColor(colorId);
    window.localStorage.setItem(INTERFACE_COLOR_STORAGE_KEY, colorId);
  }, []);

  const value = useMemo(
    () => ({
      interfaceColor,
      setInterfaceColor,
    }),
    [interfaceColor, setInterfaceColor],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

function ThemeSync({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme: theme,
    }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <InterfaceColorSync>{children}</InterfaceColorSync>
    </ThemeContext.Provider>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeSync>{children}</ThemeSync>;
}
