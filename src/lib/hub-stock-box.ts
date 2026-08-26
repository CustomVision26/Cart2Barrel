import type { HubStockParcelDims } from "@/lib/hub-stock-parcel";

export type HubStockOrderPackingPackage = {
  key: string;
  destination: "us_address" | "overseas_container";
  itemCount: number;
  unitCount: number;
  productLabels: string[];
  boxType: string | null;
  boxSizeLabel: string | null;
  shippingLabel: string | null;
};

function formatParcelMeasure(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function hubStockBoxTypeName(longestIn: number): string {
  if (longestIn <= 8) return "Small box";
  if (longestIn <= 14) return "Medium box";
  if (longestIn <= 20) return "Large box";
  return "Oversize box";
}

export function formatHubStockBoxSize(parcel: HubStockParcelDims): {
  boxType: string;
  boxSizeLabel: string;
} {
  const boxType = hubStockBoxTypeName(
    Math.max(parcel.lengthIn, parcel.widthIn, parcel.heightIn),
  );
  const boxSizeLabel = `${boxType} · ${formatParcelMeasure(parcel.lengthIn)} × ${formatParcelMeasure(parcel.widthIn)} × ${formatParcelMeasure(parcel.heightIn)} in · ${formatParcelMeasure(parcel.weightOz)} oz`;
  return { boxType, boxSizeLabel };
}

export function adminPaidOrderReceiptHref(
  orderId: string,
  format: "html" | "pdf" = "html",
): string {
  const params = new URLSearchParams({
    orderId,
    format,
  });
  return `/api/admin/payment-invoice?${params.toString()}`;
}
