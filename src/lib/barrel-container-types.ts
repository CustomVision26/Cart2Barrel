import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

/** Client-safe barrel status (matches `barrel_status` enum). */
export type BarrelStatus = "filling" | "ready_to_ship" | "shipped" | "delivered";

export type UserBarrelOptionRow = {
  barrelId: string;
  kind: ContainerOfferingKind;
  alias: string;
  slotLabel: string;
  /** Dropdown / display: alias + slot detail (+ optional item count). */
  label: string;
  status: BarrelStatus;
  itemCount: number;
  capacityPercentage: number;
  ownerClerkUserId?: string;
};

export type ProductToBarrelLineRow = {
  orderItemId: string;
  orderId: string;
  packageId: string;
  productName: string;
  fulfillmentStatus: string;
  fulfillmentLabel: string;
  assignedContainerAlias: string | null;
  assignedAt: string | null;
};

export type AdminBarrelPipelineRow = {
  packageId: string;
  orderItemId: string;
  orderId: string;
  ownerClerkUserId: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  fulfillmentStatus: string;
  fulfillmentLabel: string;
  assignedBarrelId: string | null;
  assignedContainerAlias: string | null;
  assignedAt: string | null;
};

/** @deprecated Use AdminBarrelPipelineRow */
export type AdminBarrelAssignmentRow = AdminBarrelPipelineRow & {
  barrelId: string;
  barrelLabel: string;
};
