import type { OrderItem } from "@/db/schema";
import {
  BARREL_PIPELINE_AWAITING_ASSIGNMENT,
  BARREL_PIPELINE_IN_CONTAINER,
} from "@/lib/barrel-pipeline-fulfillment";

/** Fulfillment states where the product is in the barrel packing pipeline. */
export const PRODUCT_RETURN_BARREL_STAGE_FULFILLMENTS = [
  BARREL_PIPELINE_AWAITING_ASSIGNMENT,
  BARREL_PIPELINE_IN_CONTAINER,
] as const satisfies readonly OrderItem["fulfillmentStatus"][];

export type ProductReturnBarrelStageFulfillment =
  (typeof PRODUCT_RETURN_BARREL_STAGE_FULFILLMENTS)[number];

export function isProductReturnBarrelStageFulfillment(
  status: OrderItem["fulfillmentStatus"],
): status is ProductReturnBarrelStageFulfillment {
  return (PRODUCT_RETURN_BARREL_STAGE_FULFILLMENTS as readonly string[]).includes(
    status,
  );
}

export function productReturnBarrelStageConfirmMessage(input: {
  fulfillmentStatus: OrderItem["fulfillmentStatus"];
  assignedContainerAlias?: string | null;
}): string {
  const inContainer = input.fulfillmentStatus === BARREL_PIPELINE_IN_CONTAINER;
  const containerNote =
    inContainer && input.assignedContainerAlias ?
      ` It is currently assigned to ${input.assignedContainerAlias}.`
    : inContainer ?
      " It is currently assigned to a container."
    : " It is awaiting container assignment.";

  return `This product is in the barrel packing stage.${containerNote} Submitting a return will temporarily remove it from container assignment queues until staff review your request or you cancel the return.`;
}
