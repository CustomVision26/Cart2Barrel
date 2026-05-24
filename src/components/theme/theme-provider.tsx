"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

type AppearanceContextValue = {
  interfaceColor: InterfaceColorId;
  setInterfaceColor: (colorId: InterfaceColorId) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context) {
    throw new Error("useAppearance must be used within ThemeProvider");
  }
  return context;
}

function ClerkThemedProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const clerkTheme = resolvedTheme === "light" ? "light" : "dark";

  return (
    <ClerkProvider
      dynamic
      appearance={{
        baseTheme: clerkTheme,
      }}
    >
      {children}
    </ClerkProvider>
  );
}

function InterfaceColorSync({ children }: { children: ReactNode }) {
  const [interfaceColor, setInterfaceColorState] = useState<InterfaceColorId>(
    "default",
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInterfaceColorState(readStoredInterfaceColor());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    applyInterfaceColor(interfaceColor);
  }, [hydrated, interfaceColor]);

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="cart2barrel-theme"
    >
      <ClerkThemedProvider>
        <InterfaceColorSync>{children}</InterfaceColorSync>
      </ClerkThemedProvider>
    </NextThemesProvider>
  );
}
