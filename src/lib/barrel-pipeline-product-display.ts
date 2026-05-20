/** Shared product fields for barrel packing queue UIs (admin + dashboard). */
export type BarrelPipelineProductDisplayRow = {
  packageId: string;
  orderItemId: string;
  orderId: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  fulfillmentLabel: string;
  assignedContainerAlias: string | null;
  assignedAt: string | null;
};

export const barrelPipelineProductGridClassName =
  "grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

export function formatBarrelAssignmentWhenShort(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
