import type { AdminCustomerIdentity } from "@/lib/admin-customer-group";
import { cn } from "@/lib/utils";

export function adminStaffDisplayLabel(identity: AdminCustomerIdentity): string {
  const name = identity.fullName?.trim();
  if (name) return name;
  const mail = identity.email?.trim();
  if (mail) return mail;
  return "Staff member";
}

export function adminStaffSecondaryLine(
  identity: AdminCustomerIdentity,
): string | null {
  const name = identity.fullName?.trim();
  const mail = identity.email?.trim();
  if (name && mail) return mail;
  if (!name && !mail && identity.clerkUserId.trim()) {
    return identity.clerkUserId;
  }
  return null;
}

export type AdminStaffProfilesMap = Record<
  string,
  { fullName: string | null; email: string | null }
>;

export function AdminUpdatedByCell({
  clerkUserId,
  profilesByClerkUserId,
  primaryClassName = "text-xs font-medium",
  secondaryClassName = "text-[10px] text-muted-foreground",
}: {
  clerkUserId?: string | null;
  profilesByClerkUserId?: AdminStaffProfilesMap;
  primaryClassName?: string;
  secondaryClassName?: string;
}) {
  const id = clerkUserId?.trim() ?? "";
  const profile = id ? profilesByClerkUserId?.[id] : undefined;
  return (
    <AdminStaffRecordLabel
      clerkUserId={id}
      fullName={profile?.fullName ?? null}
      email={profile?.email ?? null}
      primaryClassName={primaryClassName}
      secondaryClassName={secondaryClassName}
    />
  );
}

export function AdminStaffRecordLabel({
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
  if (!clerkUserId.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }

  const identity = { clerkUserId, fullName, email };
  const primary = adminStaffDisplayLabel(identity);
  const secondary = adminStaffSecondaryLine(identity);

  return (
    <span className={cn("min-w-0 space-y-0.5", className)}>
      <span
        className={cn(
          "block truncate font-medium text-foreground",
          primaryClassName,
        )}
        title={primary}
      >
        {primary}
      </span>
      {secondary ? (
        <span
          className={cn(
            "block truncate text-muted-foreground",
            secondaryClassName ?? "text-xs",
          )}
          title={secondary}
        >
          {secondary}
        </span>
      ) : null}
    </span>
  );
}
