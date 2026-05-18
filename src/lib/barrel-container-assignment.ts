import type { BarrelStatus, UserBarrelOptionRow } from "@/lib/barrel-container-types";

/** Admin-editable load progress in 5% steps. */
export const BARREL_CAPACITY_PERCENT_OPTIONS = Array.from(
  { length: 21 },
  (_, i) => i * 5,
) as readonly number[];

export function isBarrelOpenForAssignment(
  barrel: Pick<UserBarrelOptionRow, "status" | "capacityPercentage">,
): boolean {
  return barrel.status === "filling" && barrel.capacityPercentage < 100;
}

export function isBarrelClosedForAssignment(
  barrel: Pick<UserBarrelOptionRow, "status" | "capacityPercentage">,
): boolean {
  return !isBarrelOpenForAssignment(barrel);
}

export function barrelAssignmentDropdownSuffix(
  barrel: Pick<UserBarrelOptionRow, "status" | "capacityPercentage">,
): string | null {
  if (barrel.status !== "filling") {
    switch (barrel.status) {
      case "ready_to_ship":
        return "ready to ship";
      case "shipped":
        return "shipped";
      case "delivered":
        return "delivered";
      default:
        return "unavailable";
    }
  }
  if (barrel.capacityPercentage >= 100) {
    return "full";
  }
  return null;
}

export function canAdminEditBarrelCapacity(status: BarrelStatus): boolean {
  return status === "filling";
}
