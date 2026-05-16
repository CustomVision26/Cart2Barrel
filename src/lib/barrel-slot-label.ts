export function formatBarrelSlotLabel(input: {
  nameSnapshot: string;
  sizeSnapshot: string;
  unitOrdinal: number;
}): string {
  const name = input.nameSnapshot.trim() || "Container";
  const size = input.sizeSnapshot.trim();
  const sizePart = size ? ` (${size})` : "";
  return `${name}${sizePart} · slot ${input.unitOrdinal}`;
}
