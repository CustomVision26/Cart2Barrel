"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  deleteCustomerPricingPackageAction,
  saveCustomerPricingPackageAction,
} from "@/actions/customer-pricing-package";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type { CustomerPricingPackageSnapshot } from "@/data/customer-pricing-packages";
import type { MerchantPricingEstimateSnapshot } from "@/data/merchant-pricing-settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  centsToUsdInput,
  containerRatesToFormState,
  formStateToContainerRates,
  isOpenEndedMax,
  parseUsdToCents,
  patchMaxAndSyncNextMin,
  serverTiersToFormRows,
  sortTierRows,
  validateTiers,
  type FeeTierFormRow,
} from "@/lib/admin-pricing-form-utils";
import { cn } from "@/lib/utils";

const fieldClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

type AdminCustomerPricingPackagesPanelProps = {
  users: AdminProfilePickerRow[];
  selectedClerkUserId?: string;
  globalPricing: MerchantPricingEstimateSnapshot;
  customerPackage: CustomerPricingPackageSnapshot | null;
};

function buildInitialForm(
  global: MerchantPricingEstimateSnapshot,
  pkg: CustomerPricingPackageSnapshot | null,
) {
  const source = pkg ?? {
    packingFeePerLineCents: global.packingFeePerLineCents,
    containerPackingRates: global.containerPackingRates,
    serviceTiers: null,
    label: null,
    clerkUserId: "",
  };
  const overrideTiers = Boolean(pkg?.serviceTiers && pkg.serviceTiers.length > 0);
  const tierSource =
    overrideTiers && pkg?.serviceTiers ?
      pkg.serviceTiers
    : global.serviceTiers;
  return {
    label: pkg?.label ?? "",
    packingDollars: centsToUsdInput(source.packingFeePerLineCents),
    containerForm: containerRatesToFormState(
      pkg?.containerPackingRates ?? global.containerPackingRates,
    ),
    overrideServiceTiers: overrideTiers,
    tierRows: sortTierRows(serverTiersToFormRows(tierSource)),
  };
}

export function AdminCustomerPricingPackagesPanel({
  users,
  selectedClerkUserId,
  globalPricing,
  customerPackage,
}: AdminCustomerPricingPackagesPanelProps) {
  const router = useRouter();
  const [userFilter, setUserFilter] = useState("");
  const initial = buildInitialForm(globalPricing, customerPackage);
  const [label, setLabel] = useState(initial.label);
  const [packingDollars, setPackingDollars] = useState(initial.packingDollars);
  const [containerForm, setContainerForm] = useState(initial.containerForm);
  const [overrideServiceTiers, setOverrideServiceTiers] = useState(
    initial.overrideServiceTiers,
  );
  const [tierRows, setTierRows] = useState<FeeTierFormRow[]>(initial.tierRows);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        u.clerkUserId.toLowerCase().includes(q),
    );
  }, [users, userFilter]);

  const sortedTiers = useMemo(() => sortTierRows(tierRows), [tierRows]);
  const containerRatesPreview = useMemo(
    () => formStateToContainerRates(containerForm),
    [containerForm],
  );

  const selectedUser = users.find((u) => u.clerkUserId === selectedClerkUserId);

  function selectUser(clerkUserId: string) {
    router.push(
      `/admin/overview?tab=customer-packages&packageTab=customer&userId=${encodeURIComponent(clerkUserId)}`,
    );
  }

  function applyGlobalDefaults() {
    const g = globalPricing;
    setPackingDollars(centsToUsdInput(g.packingFeePerLineCents));
    setContainerForm(containerRatesToFormState(g.containerPackingRates));
    setOverrideServiceTiers(false);
    setTierRows(sortTierRows(serverTiersToFormRows(g.serviceTiers)));
  }

  return (
    <div className="space-y-6" key={selectedClerkUserId ?? "none"}>
      {msg ?
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {msg}
        </p>
      : null}
      {err ?
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </p>
      : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select customer</CardTitle>
          <CardDescription>
            Choose a shopper from your user list. Customers with a custom package are marked in
            the list.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-xl space-y-3">
          <div className="space-y-2">
            <Label htmlFor="user-filter">Search by name or email</Label>
            <Input
              id="user-filter"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Start typing…"
              className={fieldClassName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-select">Customer</Label>
            <select
              id="customer-select"
              value={selectedClerkUserId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                if (id) selectUser(id);
              }}
              className={cn(fieldClassName, "cursor-pointer")}
            >
              <option value="">— Select a customer —</option>
              {filteredUsers.map((u) => (
                <option key={u.clerkUserId} value={u.clerkUserId}>
                  [{u.accountKind === "admin" ? "Admin" : "Customer"}] {u.displayName}
                  {u.email ? ` · ${u.email}` : ""}
                  {u.hasCustomPackage ? " · custom package" : ""}
                </option>
              ))}
            </select>
          </div>
          {filteredUsers.length === 0 ?
            <p className="text-sm text-muted-foreground">No users match your search.</p>
          : null}
        </CardContent>
      </Card>

      {!selectedClerkUserId || !selectedUser ?
        <p className="text-sm text-muted-foreground">
          Select a customer above to view or edit their pricing package.
        </p>
      : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Package for {selectedUser.displayName}
              </CardTitle>
              <CardDescription>
                Overrides the{" "}
                <span className="font-medium text-foreground">General package fee</span> and
                global service tiers for this customer&apos;s quotes, cart packing fees, and
                checkout. Service tiers use global settings unless you enable a custom tier table
                below.
              </CardDescription>
            </CardHeader>
            <CardContent className="max-w-4xl space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={applyGlobalDefaults}>
                  Copy from global defaults
                </Button>
                {customerPackage ?
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setMsg(null);
                      setErr(null);
                      if (
                        !window.confirm(
                          "Remove this customer's custom package? They will use global fees again.",
                        )
                      ) {
                        return;
                      }
                      startTransition(async () => {
                        const res = await deleteCustomerPricingPackageAction({
                          clerkUserId: selectedClerkUserId,
                        });
                        if (!res.ok) {
                          setErr(res.message);
                          return;
                        }
                        setMsg(res.message);
                        router.refresh();
                      });
                    }}
                  >
                    Remove custom package
                  </Button>
                : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pkg-label">Package label (optional)</Label>
                <Input
                  id="pkg-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. VIP account"
                  className={cn(fieldClassName, "max-w-md")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cust-packing-usd">Packing fee per quoted line (USD)</Label>
                <Input
                  id="cust-packing-usd"
                  inputMode="decimal"
                  value={packingDollars}
                  onChange={(e) => setPackingDollars(e.target.value)}
                  className={cn(fieldClassName, "max-w-xs")}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-sm font-medium text-foreground">Barrels</p>
                  <div className="space-y-2">
                    <Label htmlFor="cust-single-barrel">Exactly 1 barrel (USD)</Label>
                    <Input
                      id="cust-single-barrel"
                      inputMode="decimal"
                      value={containerForm.singleBarrelDollars}
                      onChange={(e) =>
                        setContainerForm((f) => ({
                          ...f,
                          singleBarrelDollars: e.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cust-multi-barrel">Each barrel when 2+ in cart (USD)</Label>
                    <Input
                      id="cust-multi-barrel"
                      inputMode="decimal"
                      value={containerForm.multiBarrelDollars}
                      onChange={(e) =>
                        setContainerForm((f) => ({
                          ...f,
                          multiBarrelDollars: e.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                  <p className="text-sm font-medium text-foreground">Bins</p>
                  <div className="space-y-2">
                    <Label htmlFor="cust-single-bin">Exactly 1 bin (USD)</Label>
                    <Input
                      id="cust-single-bin"
                      inputMode="decimal"
                      value={containerForm.singleBinDollars}
                      onChange={(e) =>
                        setContainerForm((f) => ({
                          ...f,
                          singleBinDollars: e.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cust-multi-bin">Each bin when 2+ in cart (USD)</Label>
                    <Input
                      id="cust-multi-bin"
                      inputMode="decimal"
                      value={containerForm.multiBinDollars}
                      onChange={(e) =>
                        setContainerForm((f) => ({
                          ...f,
                          multiBinDollars: e.target.value,
                        }))
                      }
                      className={fieldClassName}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/10 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Custom service &amp; handling tiers
                  </p>
                  <p className="text-xs text-muted-foreground">
                    When off, this customer uses the global tier table from Fees &amp; rates.
                  </p>
                </div>
                <Switch
                  checked={overrideServiceTiers}
                  onCheckedChange={setOverrideServiceTiers}
                  aria-label="Override service tiers"
                />
              </div>

              {overrideServiceTiers ?
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                    <thead className="border-b border-border bg-muted/40">
                      <tr>
                        <th className="px-3 py-2 font-medium">From (USD)</th>
                        <th className="px-3 py-2 font-medium">Through (USD)</th>
                        <th className="px-3 py-2 font-medium">Fee / unit (USD)</th>
                        <th className="w-20 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTiers.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/80 last:border-0">
                          <td className="px-3 py-2">
                            <Input
                              inputMode="decimal"
                              value={centsToUsdInput(row.minUnitPriceInclusiveCents)}
                              onChange={(e) => {
                                const c = parseUsdToCents(e.target.value);
                                setTierRows((rows) =>
                                  sortTierRows(
                                    rows.map((r) =>
                                      r === row ?
                                        { ...r, minUnitPriceInclusiveCents: c }
                                      : r,
                                    ),
                                  ),
                                );
                              }}
                              className={fieldClassName}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {isOpenEndedMax(row.maxUnitPriceInclusiveCents) ?
                              <p className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-sm text-muted-foreground">
                                Open-ended
                              </p>
                            : <Input
                                inputMode="decimal"
                                value={centsToUsdInput(row.maxUnitPriceInclusiveCents)}
                                onChange={(e) => {
                                  const c = parseUsdToCents(e.target.value);
                                  setTierRows((prev) =>
                                    patchMaxAndSyncNextMin(prev, row, c),
                                  );
                                }}
                                className={fieldClassName}
                              />
                            }
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              inputMode="decimal"
                              value={centsToUsdInput(row.feePerUnitCents)}
                              onChange={(e) => {
                                const c = parseUsdToCents(e.target.value);
                                setTierRows((rows) =>
                                  sortTierRows(
                                    rows.map((r) =>
                                      r === row ? { ...r, feePerUnitCents: c } : r,
                                    ),
                                  ),
                                );
                              }}
                              className={fieldClassName}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={tierRows.length <= 1}
                              onClick={() =>
                                setTierRows((rows) =>
                                  sortTierRows(rows.filter((r) => r !== row)),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              : null}

              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMsg(null);
                  setErr(null);
                  if (overrideServiceTiers) {
                    const tierErr = validateTiers(sortedTiers);
                    if (tierErr) {
                      setErr(tierErr);
                      return;
                    }
                  }
                  startTransition(async () => {
                    const res = await saveCustomerPricingPackageAction({
                      clerkUserId: selectedClerkUserId,
                      label: label.trim() || null,
                      packingFeePerLineCents: parseUsdToCents(packingDollars),
                      containerPackingRates: containerRatesPreview,
                      overrideServiceTiers,
                      tiers: sortedTiers.map((t) => ({
                        maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
                        feePerUnitCents: t.feePerUnitCents,
                      })),
                    });
                    if (!res.ok) {
                      setErr(res.message);
                      return;
                    }
                    setMsg(res.message);
                    router.refresh();
                  });
                }}
              >
                Save customer package
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
