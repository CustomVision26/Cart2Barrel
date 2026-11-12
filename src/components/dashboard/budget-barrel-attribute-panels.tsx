"use client";

import { useMemo, useState } from "react";

import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUDGET_BARREL_CATEGORY_LABELS,
  type BudgetBarrelCategory,
} from "@/lib/budget-barrel/constants";
import {
  BEAUTY_TYPE_GROUPS,
  CLOTHING_SIZE_GROUPS,
  ELECTRONICS_TYPE_GROUPS,
  HOUSEHOLD_TYPE_GROUPS,
  SHOE_SIZE_GROUPS,
  type SizeOptionGroup,
} from "@/lib/budget-barrel/size-options";
import { cn } from "@/lib/utils";

export type AttributeDraft = {
  size: string;
  color: string;
  packSize: string;
  brand: string;
};

type FieldKind = "search" | "text";

type PanelField = {
  key: keyof AttributeDraft;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  groups?: SizeOptionGroup[];
};

const PANELS: Record<BudgetBarrelCategory, PanelField[]> = {
  food: [
    { key: "packSize", label: "Pack size", kind: "text", placeholder: "12 pack" },
    { key: "brand", label: "Preferred brands", kind: "text" },
  ],
  clothing: [
    { key: "size", label: "Clothing size", kind: "search", placeholder: "Search toddler, kids, or adult sizes", groups: CLOTHING_SIZE_GROUPS },
    { key: "color", label: "Color", kind: "text" },
    { key: "packSize", label: "Pack size", kind: "text", placeholder: "2 pack" },
    { key: "brand", label: "Preferred brands", kind: "text" },
  ],
  shoes: [
    { key: "size", label: "Shoe size", kind: "search", placeholder: "Search toddler, kids, or adult sizes", groups: SHOE_SIZE_GROUPS },
    { key: "color", label: "Color", kind: "text" },
    { key: "packSize", label: "Width", kind: "text", placeholder: "Medium" },
    { key: "brand", label: "Preferred brands", kind: "text" },
  ],
  electronics: [
    { key: "size", label: "Product type", kind: "search", placeholder: "Search headphones, chargers, tablets", groups: ELECTRONICS_TYPE_GROUPS },
    { key: "color", label: "Color", kind: "text" },
    { key: "packSize", label: "Model or storage", kind: "text", placeholder: "128 GB" },
    { key: "brand", label: "Preferred brands", kind: "text" },
  ],
  household: [
    { key: "size", label: "Product type", kind: "search", placeholder: "Search detergent, towels, cookware", groups: HOUSEHOLD_TYPE_GROUPS },
    { key: "color", label: "Color", kind: "text" },
    { key: "packSize", label: "Pack size", kind: "text", placeholder: "6 pack" },
    { key: "brand", label: "Preferred brands", kind: "text" },
  ],
  beauty: [
    { key: "size", label: "Product type", kind: "search", placeholder: "Search lotion, shampoo, sunscreen", groups: BEAUTY_TYPE_GROUPS },
    { key: "color", label: "Shade or color", kind: "text" },
    { key: "packSize", label: "Size", kind: "text", placeholder: "8 oz" },
    { key: "brand", label: "Preferred brands", kind: "text" },
  ],
};

export function CategoryAttributePanels({
  categories,
  values,
  disabled,
  onChange,
}: {
  categories: BudgetBarrelCategory[];
  values: Partial<Record<BudgetBarrelCategory, AttributeDraft>>;
  disabled: boolean;
  onChange: (category: BudgetBarrelCategory, key: keyof AttributeDraft, value: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <section
          key={category}
          className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4"
          aria-label={`${BUDGET_BARREL_CATEGORY_LABELS[category]} attributes`}
        >
          <p className="text-sm font-medium text-foreground">
            {BUDGET_BARREL_CATEGORY_LABELS[category]}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {PANELS[category].map((field) => {
              const value = values[category]?.[field.key] ?? "";
              const id = `${category}-${field.key}`;
              return field.kind === "search" && field.groups ? (
                <SearchableOptionField
                  key={id}
                  id={id}
                  label={field.label}
                  placeholder={field.placeholder}
                  value={value}
                  groups={field.groups}
                  disabled={disabled}
                  onChange={(next) => onChange(category, field.key, next)}
                />
              ) : (
                <div key={id} className="space-y-2">
                  <Label htmlFor={id}>{field.label}</Label>
                  <Input
                    id={id}
                    value={value}
                    placeholder={field.placeholder}
                    disabled={disabled}
                    onChange={(event) => onChange(category, field.key, event.target.value)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SearchableOptionField({
  id,
  label,
  placeholder,
  value,
  groups,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  groups: SizeOptionGroup[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const needle = (open ? query : value).trim().toLowerCase();
  const filtered = useMemo(
    () =>
      groups
        .map((group) => ({
          label: group.label,
          options: group.options.filter((option) => option.toLowerCase().includes(needle)),
        }))
        .filter((group) => group.options.length > 0),
    [groups, needle],
  );

  return (
    <div className="relative space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={open ? query : value}
        disabled={disabled}
        onFocus={() => {
          setQuery(value);
          setOpen(true);
        }}
        onClick={() => {
          setQuery(value);
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open ? (
        <ul
          id={`${id}-options`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">No matching size</li>
          ) : (
            filtered.map((group) => (
              <li key={group.label}>
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{group.label}</p>
                <ul>
                  {group.options.map((option) => (
                    <li key={option}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={option === value}
                        className={cn(
                          inputFieldClassName,
                          "h-8 w-full justify-start border-0 bg-transparent px-2 text-left text-sm shadow-none hover:bg-muted",
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange(option);
                          setQuery(option);
                          setOpen(false);
                        }}
                      >
                        {option}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
