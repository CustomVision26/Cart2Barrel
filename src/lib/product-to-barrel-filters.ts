import type {
  AdminBarrelPipelineRow,
  ProductToBarrelLineRow,
  UserBarrelOptionRow,
} from "@/lib/barrel-container-types";
import { aliasSortKey } from "@/lib/container-slot-alias";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

export type ProductAssignmentFilter = "all" | "awaiting" | "assigned";

export type ProductContainerFilter = "all" | "unassigned" | string;

export type ProductSortField = "assigned" | "product" | "container" | "fulfillment";

export type ProductSortDir = "asc" | "desc";

/** @deprecated Use ProductSortField + ProductSortDir */
export type ProductSortKey =
  | "product_asc"
  | "product_desc"
  | "container"
  | "assigned_newest"
  | "assigned_oldest"
  | "fulfillment";

export type ProductToBarrelFilterState = {
  search: string;
  assignment: ProductAssignmentFilter;
  container: ProductContainerFilter;
  fulfillment: string;
  sortField: ProductSortField;
  sortDir: ProductSortDir;
};

export const DEFAULT_PRODUCT_TO_BARREL_FILTERS: ProductToBarrelFilterState = {
  search: "",
  assignment: "all",
  container: "all",
  fulfillment: "all",
  sortField: "assigned",
  sortDir: "desc",
};

/** Fields shared by dashboard and admin pipeline product rows. */
export type PipelineFilterableRow = {
  productName: string;
  fulfillmentLabel: string;
  fulfillmentStatus: string;
  assignedContainerAlias: string | null;
  assignedAt: string | null;
  orderId: string;
  orderItemId: string;
  packageId: string;
  assignedBarrelId?: string | null;
  ownerClerkUserId?: string;
};

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function lineMatchesSearch(row: PipelineFilterableRow, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.productName,
    row.fulfillmentLabel,
    row.assignedContainerAlias ?? "",
    row.orderId,
    row.orderItemId,
    row.packageId,
    row.ownerClerkUserId ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function isPipelineLineAssigned(row: PipelineFilterableRow): boolean {
  return Boolean(row.assignedBarrelId ?? row.assignedContainerAlias?.trim());
}

export function filterAndSortPipelineLines<T extends PipelineFilterableRow>(
  lines: T[],
  filters: ProductToBarrelFilterState,
): T[] {
  const q = normalizeQuery(filters.search);

  let rows = lines.filter((row) => {
    if (!lineMatchesSearch(row, q)) return false;

    const assigned = isPipelineLineAssigned(row);
    if (filters.assignment === "awaiting" && assigned) return false;
    if (filters.assignment === "assigned" && !assigned) return false;

    if (filters.container === "unassigned" && assigned) return false;
    if (filters.container !== "all" && filters.container !== "unassigned") {
      const matchesContainer =
        row.assignedBarrelId === filters.container ||
        row.assignedContainerAlias === filters.container;
      if (!matchesContainer) return false;
    }

    if (
      filters.fulfillment !== "all" &&
      row.fulfillmentStatus !== filters.fulfillment
    ) {
      return false;
    }

    return true;
  });

  rows = [...rows];
  rows.sort((a, b) => comparePipelineLines(a, b, filters.sortField, filters.sortDir));
  return rows;
}

function comparePipelineLines(
  a: PipelineFilterableRow,
  b: PipelineFilterableRow,
  sortField: ProductSortField,
  sortDir: ProductSortDir,
): number {
  let result = 0;
  switch (sortField) {
    case "product":
      result = a.productName.localeCompare(b.productName);
      break;
    case "container": {
      const aa = a.assignedContainerAlias?.trim() ?? "\uffff";
      const bb = b.assignedContainerAlias?.trim() ?? "\uffff";
      result = aa.localeCompare(bb);
      break;
    }
    case "assigned": {
      if (sortDir === "desc") {
        const at = a.assignedAt ? Date.parse(a.assignedAt) : 0;
        const bt = b.assignedAt ? Date.parse(b.assignedAt) : 0;
        result = at - bt;
      } else {
        const at = a.assignedAt ? Date.parse(a.assignedAt) : Number.MAX_SAFE_INTEGER;
        const bt = b.assignedAt ? Date.parse(b.assignedAt) : Number.MAX_SAFE_INTEGER;
        result = at - bt;
      }
      break;
    }
    case "fulfillment":
      result = a.fulfillmentLabel.localeCompare(b.fulfillmentLabel);
      break;
    default:
      result = 0;
  }

  if (result === 0) {
    result = a.productName.localeCompare(b.productName);
  }

  if (sortField === "assigned") {
    return sortDir === "desc" ? -result : result;
  }

  return sortDir === "desc" ? -result : result;
}

export function uniqueFulfillmentStatuses(
  lines: PipelineFilterableRow[],
): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const row of lines) {
    if (!seen.has(row.fulfillmentStatus)) {
      seen.set(row.fulfillmentStatus, row.fulfillmentLabel);
    }
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function containerFilterOptionsByAlias(
  barrels: UserBarrelOptionRow[],
): { value: string; label: string }[] {
  const sorted = [...barrels].sort(
    (a, b) => aliasSortKey(a.alias, a.kind) - aliasSortKey(b.alias, b.kind),
  );
  return sorted.map((b) => ({
    value: b.alias,
    label: `${b.alias} · ${containerOfferingKindLabel(b.kind)} · ${b.slotLabel}`,
  }));
}

/** Admin assign UI — filter by barrel id for precise matching. */
export function containerFilterOptionsByBarrelId(
  barrels: UserBarrelOptionRow[],
): { value: string; label: string }[] {
  const sorted = [...barrels].sort(
    (a, b) => aliasSortKey(a.alias, a.kind) - aliasSortKey(b.alias, b.kind),
  );
  return sorted.map((b) => ({
    value: b.barrelId,
    label: `${b.alias} · ${containerOfferingKindLabel(b.kind)} · ${b.slotLabel}${
      b.ownerClerkUserId ? ` · ${b.ownerClerkUserId.slice(0, 8)}…` : ""
    }`,
  }));
}

export type ContainerKindFilter = "all" | "barrel" | "bin";

export function filterContainerInventoryRows(
  barrels: UserBarrelOptionRow[],
  search: string,
  kind: ContainerKindFilter,
): UserBarrelOptionRow[] {
  const q = normalizeQuery(search);
  return barrels.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (!q) return true;
    const haystack = [
      row.alias,
      row.slotLabel,
      row.label,
      containerOfferingKindLabel(row.kind),
      row.status,
      row.ownerClerkUserId ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** @deprecated Use isPipelineLineAssigned */
export function isProductLineAssigned(row: ProductToBarrelLineRow): boolean {
  return isPipelineLineAssigned(row);
}

/** @deprecated Use filterAndSortPipelineLines */
export function filterAndSortProductToBarrelLines(
  lines: ProductToBarrelLineRow[],
  filters: ProductToBarrelFilterState,
): ProductToBarrelLineRow[] {
  return filterAndSortPipelineLines(lines, filters);
}

/** @deprecated Use containerFilterOptionsByAlias */
export const containerFilterOptions = containerFilterOptionsByAlias;
