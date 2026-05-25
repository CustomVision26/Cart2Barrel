export function generateSupportTicketNumber(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `C2B-${year}-${suffix}`;
}

export function previewSupportMessage(body: string, max = 120): string {
  const trimmed = body.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function ticketNeedsStaffAttention(
  status: "open" | "awaiting_staff" | "awaiting_customer" | "resolved" | "closed",
): boolean {
  return status === "open" || status === "awaiting_staff";
}
