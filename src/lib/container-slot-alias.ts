import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

export type ContainerAliasInput = {
  barrelId: string;
  kind: ContainerOfferingKind;
  createdAt: string;
};

/** Assigns `Barrel 1`, `Barrel 2`, `Bin 1`, … by kind in chronological order. */
export function buildContainerAliasMap(
  rows: ContainerAliasInput[],
): Map<string, string> {
  const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const counters: Record<ContainerOfferingKind, number> = { barrel: 0, bin: 0 };
  const map = new Map<string, string>();

  for (const row of sorted) {
    counters[row.kind] += 1;
    const n = counters[row.kind];
    map.set(
      row.barrelId,
      row.kind === "barrel" ? `Barrel ${n}` : `Bin ${n}`,
    );
  }

  return map;
}

/** Barrel slot `<select>` options — alias only (optional item count). */
export function formatContainerAliasOptionLabel(
  alias: string,
  itemCount?: number,
): string {
  if (itemCount != null && itemCount > 0) {
    return `${alias} (${itemCount} item${itemCount === 1 ? "" : "s"})`;
  }
  return alias;
}

export function formatContainerDropdownLabel(
  alias: string,
  slotLabel: string,
  itemCount?: number,
): string {
  const base = `${alias} — ${slotLabel}`;
  if (itemCount != null && itemCount > 0) {
    return `${base} (${itemCount} item${itemCount === 1 ? "" : "s"})`;
  }
  return base;
}

export function formatContainerDisplayLabel(
  alias: string,
  slotLabel: string,
): string {
  return `${alias} — ${slotLabel}`;
}

export function barrelStatusLabel(
  status: "filling" | "ready_to_ship" | "shipped" | "delivered",
): string {
  switch (status) {
    case "filling":
      return "Open for packing";
    case "ready_to_ship":
      return "Ready to ship";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    default: {
      const _x: never = status;
      return _x;
    }
  }
}

export function countContainersByKind(
  barrels: { kind: ContainerOfferingKind }[],
): { total: number; barrelCount: number; binCount: number } {
  let barrelCount = 0;
  let binCount = 0;
  for (const b of barrels) {
    if (b.kind === "barrel") barrelCount += 1;
    else binCount += 1;
  }
  return { total: barrels.length, barrelCount, binCount };
}

export function containerKindSortRank(kind: ContainerOfferingKind): number {
  return kind === "barrel" ? 0 : 1;
}

export function aliasSortKey(alias: string, kind: ContainerOfferingKind): number {
  const match = alias.match(/(\d+)$/);
  const n = match ? Number.parseInt(match[1]!, 10) : 0;
  return containerKindSortRank(kind) * 10_000 + n;
}
