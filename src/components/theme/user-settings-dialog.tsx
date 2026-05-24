"use client";

import { Monitor, Moon, Palette, Settings, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { useEffect, useState } from "react";

import { useAppearance } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  INTERFACE_COLOR_IDS,
  INTERFACE_COLORS,
  type InterfaceColorId,
} from "@/lib/theme/interface-colors";

type SettingsTab = "appearance";

export function UserSettingsDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
  const { theme, setTheme } = useTheme();
  const { interfaceColor, setInterfaceColor } = useAppearance();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label="Settings"
        disabled
      >
        <Settings className="size-4" />
      </Button>
    );
  }

  const currentTheme = theme === "light" ? "light" : "dark";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Open settings"
          />
        }
      >
        <Settings className="size-4" />
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/80 px-4 py-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize how Cart2Barrel looks on your device.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-[280px]">
          <nav
            className="flex w-36 shrink-0 flex-col gap-1 border-r border-border/80 bg-muted/30 p-2"
            aria-label="Settings sections"
          >
            <button
              type="button"
              onClick={() => setActiveTab("appearance")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                activeTab === "appearance" ?
                  "bg-background font-medium text-foreground shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
            >
              <Palette className="size-4 shrink-0" />
              Appearance
            </button>
          </nav>
          <div className="min-w-0 flex-1 p-4">
            {activeTab === "appearance" ?
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label>Theme mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Choose between light and dark interface colors.
                  </p>
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="group"
                    aria-label="Theme mode"
                  >
                    <Button
                      type="button"
                      variant={currentTheme === "light" ? "secondary" : "outline"}
                      className="h-auto justify-start gap-2 py-2.5"
                      onClick={() => setTheme("light")}
                    >
                      <Sun className="size-4 shrink-0" />
                      Light
                    </Button>
                    <Button
                      type="button"
                      variant={currentTheme === "dark" ? "secondary" : "outline"}
                      className="h-auto justify-start gap-2 py-2.5"
                      onClick={() => setTheme("dark")}
                    >
                      <Moon className="size-4 shrink-0" />
                      Dark
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    <Monitor className="size-3.5 shrink-0" />
                    Current: {currentTheme === "light" ? "Light" : "Dark"} mode
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="interface-color">Interface color</Label>
                  <p className="text-xs text-muted-foreground">
                    Accent color for buttons, links, and highlights.
                  </p>
                  <div className="relative">
                    <select
                      id="interface-color"
                      value={interfaceColor}
                      onChange={(event) => {
                        setInterfaceColor(event.target.value as InterfaceColorId);
                      }}
                      className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {INTERFACE_COLOR_IDS.map((colorId) => (
                        <option key={colorId} value={colorId}>
                          {INTERFACE_COLORS[colorId].label}
                        </option>
                      ))}
                    </select>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 rounded-full ring-1 ring-border/80"
                      style={{
                        background: INTERFACE_COLORS[interfaceColor].swatch,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INTERFACE_COLOR_IDS.map((colorId) => {
                      const preset = INTERFACE_COLORS[colorId];
                      const selected = interfaceColor === colorId;
                      return (
                        <button
                          key={colorId}
                          type="button"
                          title={preset.label}
                          aria-label={`${preset.label} interface color`}
                          aria-pressed={selected}
                          onClick={() => setInterfaceColor(colorId)}
                          className={cn(
                            "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-105",
                            selected ? "ring-primary" : "ring-transparent",
                          )}
                          style={{ background: preset.swatch }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
