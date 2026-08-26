import type { CartCheckoutSummaryLine } from "@/data/cart";
import type { HubStockOrderItem } from "@/db/schema";
import { allocateCentsByWeight } from "@/lib/allocate-cents";
import { formatHubStockUsAddress, hubStockUsShipToKey, isHubStockProductUrl } from "@/lib/hub-stock";

export type CartCheckoutHubStockLine = {
  itemRequestId: string;
  orderItemId: string;
  productName: string | null;
  productUrl: string;
  quantity: number;
  merchandiseCents: number;
  productReferenceDetail: string | null;
};

export type CartCheckoutHubStockPackage = {
  key: string;
  destination: "us_address" | "overseas_container";
  lines: CartCheckoutHubStockLine[];
  shippingCents: number;
  shippingLabel: string | null;
  /** Formatted US ship-to from the warehouse snapshot, when known. */
  shipToLabel: string | null;
  merchandiseCents: number;
  packageTotalCents: number;
};

function shippingLabel(carrier: string | null, service: string | null): string | null {
  const label = [carrier, service]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return label || null;
}

function isHubCheckoutLine(
  line: CartCheckoutSummaryLine,
  snapByRequestId: Map<string, HubStockOrderItem>,
): boolean {
  if (snapByRequestId.has(line.itemRequestId)) return true;
  if (line.source === "hub_stock") return true;
  return isHubStockProductUrl(line.productUrl);
}

function formatUsShipToLabel(snap: HubStockOrderItem | undefined): string | null {
  if (snap == null || snap.destination === "overseas_container") return null;
  const hasStreet = Boolean(snap.shipLine1?.trim());
  const hasLocality = Boolean(
    snap.shipCity?.trim() || snap.shipState?.trim() || snap.shipPostalCode?.trim(),
  );
  if (!hasStreet && !hasLocality) return null;
  return formatHubStockUsAddress({
    line1: snap.shipLine1,
    line2: snap.shipLine2,
    city: snap.shipCity,
    state: snap.shipState,
    postalCode: snap.shipPostalCode,
    country: snap.shipCountry,
  });
}

function toHubLine(
  line: CartCheckoutSummaryLine,
  snap: HubStockOrderItem | undefined,
): {
  dest: CartCheckoutHubStockPackage["destination"];
  shipKey: string | null;
  shipToLabel: string | null;
  line: CartCheckoutHubStockLine;
  shippingCents: number;
  shippingLabel: string | null;
} {
  const merchandiseCents =
    snap != null ?
      Math.max(0, snap.unitPriceCents * snap.quantity)
    : Math.max(0, line.lineTotalCents);
  const dest: CartCheckoutHubStockPackage["destination"] =
    snap?.destination === "overseas_container" ? "overseas_container" : "us_address";
  const shippingCents =
    dest === "overseas_container" ? 0
    : snap != null ? Math.max(0, snap.shippingCents)
    : Math.max(0, line.lineTotalCents - merchandiseCents);
  return {
    dest,
    shipKey:
      snap != null ?
        hubStockUsShipToKey({
          destination: snap.destination,
          shipLine1: snap.shipLine1,
          shipLine2: snap.shipLine2,
          shipCity: snap.shipCity,
          shipState: snap.shipState,
          shipPostalCode: snap.shipPostalCode,
        })
      : null,
    shipToLabel: formatUsShipToLabel(snap),
    line: {
      itemRequestId: line.itemRequestId,
      orderItemId: line.orderItemId,
      productName: line.productName,
      productUrl: line.productUrl,
      quantity: line.quantity,
      merchandiseCents,
      productReferenceDetail: line.productReferenceDetail,
    },
    shippingCents,
    shippingLabel: shippingLabel(snap?.shippingCarrier ?? null, snap?.shippingService ?? null),
  };
}

export function partitionCheckoutHubStockPackages(
  standaloneLines: CartCheckoutSummaryLine[],
  snapshots: HubStockOrderItem[],
): {
  packages: CartCheckoutHubStockPackage[];
  remainingStandalone: CartCheckoutSummaryLine[];
} {
  const snapByRequestId = new Map(snapshots.map((row) => [row.itemRequestId, row]));
  const remainingStandalone: CartCheckoutSummaryLine[] = [];
  const hubRows: ReturnType<typeof toHubLine>[] = [];

  for (const line of standaloneLines) {
    if (!isHubCheckoutLine(line, snapByRequestId)) {
      remainingStandalone.push(line);
      continue;
    }
    hubRows.push(toHubLine(line, snapByRequestId.get(line.itemRequestId)));
  }

  const usGroups = new Map<string, ReturnType<typeof toHubLine>[]>();
  const overseas: ReturnType<typeof toHubLine>[] = [];
  for (const row of hubRows) {
    if (row.dest !== "us_address") {
      overseas.push(row);
      continue;
    }
    const key = row.shipKey ?? `incomplete:${row.line.itemRequestId}`;
    const group = usGroups.get(key) ?? [];
    group.push(row);
    usGroups.set(key, group);
  }

  const packages: CartCheckoutHubStockPackage[] = [];
  for (const [key, group] of usGroups) {
    const merchandiseCents = group.reduce((sum, row) => sum + row.line.merchandiseCents, 0);
    const shippingCents = group.reduce((sum, row) => sum + row.shippingCents, 0);
    const rated = group.find((row) => row.shippingLabel);
    packages.push({
      key: `us:${key}`,
      destination: "us_address",
      lines: group.map((row) => row.line),
      shippingCents,
      shippingLabel: rated?.shippingLabel ?? null,
      shipToLabel: group.find((row) => row.shipToLabel)?.shipToLabel ?? null,
      merchandiseCents,
      packageTotalCents: merchandiseCents + shippingCents,
    });
  }
  if (overseas.length > 0) {
    const merchandiseCents = overseas.reduce((sum, row) => sum + row.line.merchandiseCents, 0);
    packages.push({
      key: "overseas",
      destination: "overseas_container",
      lines: overseas.map((row) => row.line),
      shippingCents: 0,
      shippingLabel: null,
      shipToLabel: null,
      merchandiseCents,
      packageTotalCents: merchandiseCents,
    });
  }

  return { packages, remainingStandalone };
}

export type HubStockPackageShippingShare = {
  itemRequestId: string;
  merchandiseCents: number;
  shippingShareCents: number;
  packageShippingCents: number;
  packageLineCount: number;
  shippingLabel: string | null;
};

/** Split a warehouse package's Shippo fee across SKUs by merchandise (cents sum to the package rate). */
export function hubStockPackageShippingShares(
  pkg: CartCheckoutHubStockPackage,
): HubStockPackageShippingShare[] {
  const shares = allocateCentsByWeight(
    pkg.shippingCents,
    pkg.lines.map((line) => line.merchandiseCents),
  );
  return pkg.lines.map((line, index) => ({
    itemRequestId: line.itemRequestId,
    merchandiseCents: line.merchandiseCents,
    shippingShareCents: shares[index] ?? 0,
    packageShippingCents: pkg.shippingCents,
    packageLineCount: pkg.lines.length,
    shippingLabel: pkg.shippingLabel,
  }));
}

export function findHubStockPackageShippingShare(
  packages: CartCheckoutHubStockPackage[],
  itemRequestId: string,
): HubStockPackageShippingShare | null {
  for (const pkg of packages) {
    if (pkg.destination !== "us_address") continue;
    const shares = hubStockPackageShippingShares(pkg);
    const match = shares.find((share) => share.itemRequestId === itemRequestId);
    if (match) return match;
  }
  return null;
}
