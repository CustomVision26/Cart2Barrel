import type { BarrelPipelineProductDisplayRow } from "@/lib/barrel-pipeline-product-display";
import type { ContainerOfferingKind } from "@/lib/validations/container-offering";

/** Client-safe barrel status (matches `barrel_status` enum). */
export type BarrelStatus = "filling" | "ready_to_ship" | "shipped" | "delivered";

/** One historical container load/progress photo record. */
export type ProgressSnapshotView = {
  id: string;
  imageUrl: string;
  capacityPercentage: number;
  createdAt: string;
};

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
  /** Public URL of the latest container load/progress photo, if uploaded. */
  progressImageUrl?: string | null;
  /** Full visual record of load/progress photos, newest first. */
  progressSnapshots?: ProgressSnapshotView[];
  ownerClerkUserId?: string;
  /** Staff who last changed assignment for a product in this container. */
  lastUpdatedByClerkUserId?: string | null;
};

export type ProductToBarrelLineRow = BarrelPipelineProductDisplayRow & {
  fulfillmentStatus: string;
};

export type AdminBarrelPipelineRow = BarrelPipelineProductDisplayRow & {
  itemRequestId: string;
  productUrl: string;
  ownerClerkUserId: string;
  fulfillmentStatus: string;
  assignedBarrelId: string | null;
  /** Staff who last changed barrel assignment for this package. */
  lastUpdatedByClerkUserId: string | null;
};

/** @deprecated Use AdminBarrelPipelineRow */
export type AdminBarrelAssignmentRow = AdminBarrelPipelineRow & {
  barrelId: string;
  barrelLabel: string;
};
