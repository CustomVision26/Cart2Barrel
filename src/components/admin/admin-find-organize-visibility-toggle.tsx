"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Toggle for showing/hiding Find & organize filter controls. */
export function AdminFindOrganizeVisibilityToggle({
  id,
  visible,
  onVisibleChange,
  heading = "Find & organize",
  switchLabel = "Show filters and sort",
}: {
  id: string;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  heading?: string;
  switchLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs font-medium text-foreground">{heading}</p>
      <Switch
        id={id}
        checked={visible}
        onCheckedChange={(checked) => onVisibleChange(checked === true)}
        aria-label={switchLabel}
        aria-expanded={visible}
      />
      <Label
        htmlFor={id}
        className="cursor-pointer text-xs font-normal text-muted-foreground"
      >
        {switchLabel}
      </Label>
    </div>
  );
}
