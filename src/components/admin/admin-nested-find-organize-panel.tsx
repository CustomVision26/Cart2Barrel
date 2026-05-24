"use client";

import { AdminFindOrganizeVisibilityToggle } from "@/components/admin/admin-find-organize-visibility-toggle";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

const SELECT_CLASS =
  "h-8 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export type AdminNestedFindOrganizePageSize =
  (typeof PAGE_SIZE_OPTIONS)[number];

export function AdminNestedFindOrganizePanel({
  switchId,
  searchInputId,
  pageSizeSelectId,
  visible,
  onVisibleChange,
  search,
  onSearchChange,
  searchLabel = "Search",
  searchPlaceholder = "Product, URL, site, status, id…",
  searchDescription = "Filters records in this panel only. Column headers below sort the filtered list.",
  pageSize,
  onPageSizeChange,
  pageSizeLabel = "Rows per page",
  pageSizeDescription = "Paginates the records shown in this panel.",
  showFrom,
  showTo,
  totalCount,
  totalLoaded,
  itemLabel = "record",
  emptyMessage = "No records for this customer.",
  noMatchMessage = "No records match the current search.",
  className,
}: {
  switchId: string;
  searchInputId: string;
  pageSizeSelectId: string;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel?: string;
  searchPlaceholder?: string;
  searchDescription?: string;
  pageSize: AdminNestedFindOrganizePageSize;
  onPageSizeChange: (size: AdminNestedFindOrganizePageSize) => void;
  pageSizeLabel?: string;
  pageSizeDescription?: string;
  showFrom: number;
  showTo: number;
  totalCount: number;
  totalLoaded?: number;
  itemLabel?: string;
  emptyMessage?: string;
  noMatchMessage?: string;
  className?: string;
}) {
  const plural = totalCount === 1 ? itemLabel : `${itemLabel}s`;

  return (
    <div className={cn("mb-4 space-y-3 rounded-lg border border-border bg-muted/10 p-4", className)}>
      <AdminFindOrganizeVisibilityToggle
        id={switchId}
        visible={visible}
        onVisibleChange={onVisibleChange}
      />

      {visible ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field className="gap-1.5 sm:col-span-2 lg:col-span-2">
              <FieldLabel htmlFor={searchInputId} className="text-xs">
                {searchLabel}
              </FieldLabel>
              <FieldContent>
                <Input
                  id={searchInputId}
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                  autoComplete="off"
                  onClick={(e) => e.stopPropagation()}
                />
              </FieldContent>
              <FieldDescription>{searchDescription}</FieldDescription>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor={pageSizeSelectId} className="text-xs">
                {pageSizeLabel}
              </FieldLabel>
              <FieldContent>
                <select
                  id={pageSizeSelectId}
                  className={SELECT_CLASS}
                  value={pageSize}
                  onChange={(e) =>
                    onPageSizeChange(
                      Number(e.target.value) as AdminNestedFindOrganizePageSize,
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </FieldContent>
              <FieldDescription>{pageSizeDescription}</FieldDescription>
            </Field>
          </div>

          <p className="text-xs text-muted-foreground">
            {totalCount === 0 ? (
              search.trim() ? (
                <>{noMatchMessage}</>
              ) : (
                <>{emptyMessage}</>
              )
            ) : (
              <>
                Showing{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {showFrom}–{showTo}
                </span>{" "}
                of{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {totalCount}
                </span>{" "}
                {plural}
                {totalLoaded != null && totalCount < totalLoaded ? (
                  <>
                    {" "}
                    (
                    <span className="tabular-nums">{totalLoaded}</span> total for
                    customer)
                  </>
                ) : null}
              </>
            )}
          </p>
        </>
      ) : null}
    </div>
  );
}
