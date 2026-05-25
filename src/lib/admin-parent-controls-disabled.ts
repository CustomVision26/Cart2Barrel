import { cn } from "@/lib/utils";

/** Legacy helper; prefer hiding parent panels via AdminParentControlsShell or conditional render. */
export function adminParentControlsDisabledClass(disabled: boolean): string {
  return cn(disabled && "pointer-events-none opacity-50 transition-opacity");
}
