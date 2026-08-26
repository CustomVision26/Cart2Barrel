export type HubStockParcelDims = {
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export function hubStockParcelFromProduct(product: {
  parcelWeightOz: number | null;
  parcelLengthIn: number | null;
  parcelWidthIn: number | null;
  parcelHeightIn: number | null;
}): HubStockParcelDims | null {
  const weightOz = Number(product.parcelWeightOz);
  const lengthIn = Number(product.parcelLengthIn);
  const widthIn = Number(product.parcelWidthIn);
  const heightIn = Number(product.parcelHeightIn);
  if (
    !Number.isFinite(weightOz) ||
    weightOz < 0.1 ||
    !Number.isFinite(lengthIn) ||
    lengthIn < 0.1 ||
    !Number.isFinite(widthIn) ||
    widthIn < 0.1 ||
    !Number.isFinite(heightIn) ||
    heightIn < 0.1
  ) {
    return null;
  }
  return { weightOz, lengthIn, widthIn, heightIn };
}

/** Stacks SKUs into one outer carton: max L/W, summed height and weight. */
export function combineHubStockParcels(
  items: {
    parcel: HubStockParcelDims;
    quantity: number;
  }[],
): HubStockParcelDims | null {
  if (items.length === 0) return null;
  let weightOz = 0;
  let lengthIn = 0;
  let widthIn = 0;
  let heightIn = 0;
  for (const item of items) {
    const qty = Math.max(1, item.quantity);
    weightOz += item.parcel.weightOz * qty;
    lengthIn = Math.max(lengthIn, item.parcel.lengthIn);
    widthIn = Math.max(widthIn, item.parcel.widthIn);
    heightIn += item.parcel.heightIn * qty;
  }
  if (weightOz < 0.1 || lengthIn < 0.1 || widthIn < 0.1 || heightIn < 0.1) {
    return null;
  }
  return { weightOz, lengthIn, widthIn, heightIn };
}
