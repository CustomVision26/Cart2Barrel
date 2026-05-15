export type WarehouseReceiveCondition =
  | "good"
  | "damaged"
  | "missing"
  | "wrong_item";

export const WAREHOUSE_RECEIVE_CONDITION_OPTIONS: {
  value: WarehouseReceiveCondition;
  label: string;
}[] = [
  { value: "good", label: "Good" },
  { value: "damaged", label: "Damaged" },
  { value: "missing", label: "Missing" },
  { value: "wrong_item", label: "Wrong Item" },
];

export function warehouseReceiveConditionLabel(c: WarehouseReceiveCondition): string {
  return (
    WAREHOUSE_RECEIVE_CONDITION_OPTIONS.find((o) => o.value === c)?.label ?? c
  );
}
