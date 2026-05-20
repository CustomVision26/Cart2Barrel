import type { BarrelPipelineProductDisplayRow } from "@/lib/barrel-pipeline-product-display";
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

export type ProductToBarrelLineRow = BarrelPipelineProductDisplayRow & {
  fulfillmentStatus: string;
};

export type AdminBarrelPipelineRow = BarrelPipelineProductDisplayRow & {
  ownerClerkUserId: string;
  fulfillmentStatus: string;
  assignedBarrelId: string | null;
};

/** @deprecated Use AdminBarrelPipelineRow */
export type AdminBarrelAssignmentRow = AdminBarrelPipelineRow & {
  barrelId: string;
  barrelLabel: string;
};
