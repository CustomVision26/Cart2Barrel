import { cn } from "@/lib/utils";

/** Grey out parent Find & organize / pagination while a nested customer panel is active. */
export function adminParentControlsDisabledClass(disabled: boolean): string {
  return cn(disabled && "pointer-events-none opacity-50 transition-opacity");
}
