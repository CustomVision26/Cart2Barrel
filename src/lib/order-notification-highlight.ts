export function parseOrderHighlightId(
  raw: string | string[] | undefined,
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

type OrderLineWithIds = {
  order: { id: string };
  orderItem: { id: string };
};

/** Resolve an order id from a notification highlight (order id or order line id). */
export function resolveOrderIdFromHighlight<T extends OrderLineWithIds>(
  rows: T[],
  highlightId: string,
): string | null {
  const direct = rows.find((row) => row.order.id === highlightId);
  if (direct) return direct.order.id;

  const byLine = rows.find((row) => row.orderItem.id === highlightId);
  return byLine?.order.id ?? null;
}

export function orderLinesForOrderId<T extends OrderLineWithIds>(
  rows: T[],
  orderId: string,
): T[] {
  return rows.filter((row) => row.order.id === orderId);
}
