"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setCustomerOutboundChargeLinksAction } from "@/actions/user-outbound-shipping-charge-links";
import {
  containerCanJoinCompanyRateCard,
  containerEligibleForCourierRateLink,
  outboundShippingCompanyKey,
  type AdminRateLinkableContainer,
} from "@/lib/barrel-outbound-shipping-charge";
import { cn } from "@/lib/utils";

type UnpaidContainerLinkPanelProps = {
  sourceBarrelId: string;
  companyName: string;
  kind: "freight" | "broker" | "courier";
  containers: AdminRateLinkableContainer[];
  linkedBarrelIds: string[];
  disabled?: boolean;
  lockMessage?: string;
};

function kindLabel(kind: "freight" | "broker" | "courier"): string {
  if (kind === "freight") return "freight company";
  if (kind === "broker") return "broker";
  return "local courier";
}

export function UnpaidContainerLinkPanel({
  sourceBarrelId,
  companyName,
  kind,
  containers,
  linkedBarrelIds,
  disabled,
  lockMessage,
}: UnpaidContainerLinkPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const companyKey = outboundShippingCompanyKey(companyName);
  const eligible = containers.filter((container) => {
    if (container.unpaidByKind[kind] === false) return false;
    if (
      !containerCanJoinCompanyRateCard(
        container.partnerKeyByKind,
        [kind],
        companyKey,
      )
    ) {
      return false;
    }
    if (kind === "courier" && container.barrelId !== sourceBarrelId) {
      return containerEligibleForCourierRateLink(container);
    }
    return true;
  });

  const [selected, setSelected] = useState<string[]>(() => {
    const next = linkedBarrelIds.filter((id) =>
      eligible.some((item) => item.barrelId === id),
    );
    if (!next.includes(sourceBarrelId)) next.unshift(sourceBarrelId);
    return [...new Set(next)];
  });

  useEffect(() => {
    const next = linkedBarrelIds.filter((id) =>
      eligible.some((item) => item.barrelId === id),
    );
    if (!next.includes(sourceBarrelId)) next.unshift(sourceBarrelId);
    setSelected([...new Set(next)]);
  }, [sourceBarrelId, linkedBarrelIds.join("|")]);

  if (!companyKey || eligible.length < 2) return null;

  function save(nextIds: string[]) {
    const previous = selected;
    startTransition(async () => {
      const res = await setCustomerOutboundChargeLinksAction({
        sourceBarrelId,
        kind,
        linkedBarrelIds: nextIds,
      });
      if (!res.ok) {
        setSelected(previous);
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function toggle(barrelId: string) {
    if (barrelId === sourceBarrelId || pending || disabled) return;
    const next = selected.includes(barrelId)
      ? selected.filter((id) => id !== barrelId)
      : [...selected, barrelId];
    setSelected(next);
    save(next);
  }

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/30 px-3 py-3">
      <p className="text-sm font-medium text-foreground">
        Link unpaid containers to this {kindLabel(kind)}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {disabled && lockMessage
          ? lockMessage
          : kind === "courier"
            ? "Only containers that chose their own transportation can be linked here. Containers that already added or paid for this courier are not listed."
            : "Check other unpaid containers on this account to share this company rate. The first uses the 1-container rate; each extra adds the extra-container rate. Each container keeps its own card. One payment covers every linked container."}
      </p>
      {disabled && lockMessage ? null : (
      <ul className="space-y-1.5">
        {eligible.map((container) => {
          const isSource = container.barrelId === sourceBarrelId;
          const checked = selected.includes(container.barrelId);
          return (
            <li key={container.barrelId}>
              <label
                className={cn(
                  "flex items-start gap-2 rounded-md px-1.5 py-1 text-sm",
                  (pending || disabled) && "opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 accent-primary"
                  checked={checked}
                  disabled={isSource || pending || disabled}
                  onChange={() => toggle(container.barrelId)}
                />
                <span>
                  <span className="font-medium text-foreground">
                    {container.alias}
                  </span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {container.slotLabel}
                    {isSource ? " · this container" : null}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}
