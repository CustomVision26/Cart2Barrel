/** Shared result shape for barrel assignment server actions. */
export type BarrelAssignmentActionState =
  | { ok: true; message: string }
  | { ok: false; message: string };
