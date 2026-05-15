/** Identity fields commonly joined on admin line / batch lists. */
export type AdminCustomerIdentity = {
  fullName: string | null | undefined;
  email: string | null | undefined;
  clerkUserId: string;
};

/** Stable lowercase key for sorting customer sections. */
export function adminCustomerSortKey(i: AdminCustomerIdentity): string {
  const name = i.fullName?.trim();
  if (name) return name.toLowerCase();
  const mail = i.email?.trim();
  if (mail) return mail.toLowerCase();
  return i.clerkUserId.toLowerCase();
}

/** Primary label for a customer section header. */
export function adminCustomerDisplayLabel(i: AdminCustomerIdentity): string {
  const name = i.fullName?.trim();
  if (name) return name;
  const mail = i.email?.trim();
  if (mail) return mail;
  return `Account ${i.clerkUserId.slice(0, 10)}…`;
}
