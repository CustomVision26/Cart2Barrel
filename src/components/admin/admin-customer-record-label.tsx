import {
  adminCustomerDisplayLabel,
  type AdminCustomerIdentity,
} from "@/lib/admin-customer-group";
import { cn } from "@/lib/utils";

export function adminCustomerSecondaryLine(
  identity: AdminCustomerIdentity,
): string | null {
  const name = identity.fullName?.trim();
  const mail = identity.email?.trim();
  if (name && mail) return mail;
  return null;
}

export function AdminCustomerRecordLabel({
  clerkUserId,
  fullName,
  email,
  className,
  primaryClassName,
  secondaryClassName,
}: AdminCustomerIdentity & {
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
}) {
  const identity = { clerkUserId, fullName, email };
  const secondary = adminCustomerSecondaryLine(identity);

  return (
    <span className={cn("min-w-0 space-y-0.5", className)}>
      <span
        className={cn(
          "block truncate font-semibold text-foreground",
          primaryClassName,
        )}
        title={adminCustomerDisplayLabel(identity)}
      >
        {adminCustomerDisplayLabel(identity)}
      </span>
      {secondary ? (
        <span
          className={cn(
            "block truncate text-xs text-muted-foreground",
            secondaryClassName,
          )}
          title={secondary}
        >
          {secondary}
        </span>
      ) : null}
    </span>
  );
}
