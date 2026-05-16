"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  updateMerchantPackingBarrelFeesAction,
  updateMerchantPricingSettingsAction,
} from "@/actions/update-merchant-pricing-settings";
import type { MerchantPackingComboAdminRow } from "@/data/merchant-pricing-settings";
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
import { cn } from "@/lib/utils";

/** One tier as stored by the API / DB (inclusive ceiling only). */
export type FeeTierServerPayload = {
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

/** Full band in the editor (from / through inclusive, fee). */
export type FeeTierFormRow = {
  minUnitPriceInclusiveCents: number;
  maxUnitPriceInclusiveCents: number;
  feePerUnitCents: number;
};

/** One manual (barrel count, bin count) → total fee row in the editor. */
type ComboFormRow = {
  clientKey: string;
  barrelCount: number;
  binCount: number;
  feeCents: number;
};

function combosFromServer(rows: MerchantPackingComboAdminRow[]): ComboFormRow[] {
  return rows.map((r) => ({
    clientKey: `c-${r.id}-${r.sortIndex}`,
    barrelCount: r.barrelCount,
    binCount: r.binCount,
    feeCents: r.feeCents,
  }));
}

function parseCountInput(raw: string): number {
  const t = raw.trim();
  if (t === "") return 0;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(99_999, n);
}

type AdminSetFeeNRatePanelProps = {
  initialPackingFeePerLineCents: number;
  initialCombos: MerchantPackingComboAdminRow[];
  initialTiers: FeeTierServerPayload[];
};

function centsToUsdInput(cents: number): string {
  return (Math.max(0, cents) / 100).toFixed(2);
}

/** Very large max = “and above” band (matches seeded catch‑all tier). */
const OPEN_ENDED_MAX_THRESHOLD_CENTS = 1_000_000_000;

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, cents) / 100);
}

function isOpenEndedMax(maxCents: number): boolean {
  return maxCents >= OPEN_ENDED_MAX_THRESHOLD_CENTS;
}

function sortTierRows(rows: FeeTierFormRow[]): FeeTierFormRow[] {
  return [...rows].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
}

function serverTiersToFormRows(db: FeeTierServerPayload[]): FeeTierFormRow[] {
  const sorted = [...db].sort(
    (a, b) => a.maxUnitPriceInclusiveCents - b.maxUnitPriceInclusiveCents,
  );
  return sorted.map((t, i) => ({
    minUnitPriceInclusiveCents:
      i === 0 ? 1 : sorted[i - 1]!.maxUnitPriceInclusiveCents + 1,
    maxUnitPriceInclusiveCents: t.maxUnitPriceInclusiveCents,
    feePerUnitCents: t.feePerUnitCents,
  }));
}

function parseUsdToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function validateTiers(sorted: FeeTierFormRow[]): string | null {
  let openEndedCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!;
    if (isOpenEndedMax(r.maxUnitPriceInclusiveCents)) {
      openEndedCount += 1;
      if (i !== sorted.length - 1) {
        return "Only the last band may use the open-ended ceiling.";
      }
    }
    if (r.minUnitPriceInclusiveCents < 1) {
      return "Each band’s “from” amount must be at least $0.01.";
    }
    if (!isOpenEndedMax(r.maxUnitPriceInclusiveCents)) {
      if (r.minUnitPriceInclusiveCents > r.maxUnitPriceInclusiveCents) {
        return `"From" cannot be greater than “through” on the same row.`;
      }
    } else if (r.minUnitPriceInclusiveCents >= r.maxUnitPriceInclusiveCents) {
      return "The open-ended band’s “from” must be below the system ceiling.";
    }
    if (i > 0) {
      const prev = sorted[i - 1]!;
      if (r.minUnitPriceInclusiveCents !== prev.maxUnitPriceInclusiveCents + 1) {
        return `After ${formatUsdFromCents(prev.maxUnitPriceInclusiveCents)}, the next band must start at ${formatUsdFromCents(prev.maxUnitPriceInclusiveCents + 1)} (one cent above the previous “through”).`;
      }
      if (
        !isOpenEndedMax(r.maxUnitPriceInclusiveCents) &&
        r.maxUnitPriceInclusiveCents <= prev.maxUnitPriceInclusiveCents
      ) {
        return "Each band’s “through” must be greater than the previous band’s “through”.";
      }
    }
  }
  if (openEndedCount > 1) {
    return "At most one band may use the open-ended ceiling.";
  }
  if (
    sorted.length > 0 &&
    !isOpenEndedMax(sorted[sorted.length - 1]!.maxUnitPriceInclusiveCents)
  ) {
    return "The last band should use the open-ended ceiling (very high “through”) so every unit price is covered.";
  }
  return null;
}

/** After changing a row’s max, keep the next row’s min one cent above (if any). */
function patchMaxAndSyncNextMin(
  rows: FeeTierFormRow[],
  target: FeeTierFormRow,
  newMax: number,
): FeeTierFormRow[] {
  const sorted = sortTierRows(rows);
  const si = sorted.findIndex((r) => r === target);
  if (si < 0) return sortTierRows(rows);
  const next = sorted[si + 1];
  return sortTierRows(
    rows.map((r) => {
      if (r === target) return { ...r, maxUnitPriceInclusiveCents: newMax };
      if (next && r === next) {
        return { ...r, minUnitPriceInclusiveCents: newMax + 1 };
      }
      return r;
    }),
  );
}

const fieldSelectClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

export function AdminSetFeeNRatePanel({
  initialPackingFeePerLineCents,
  initialCombos,
  initialTiers,
}: AdminSetFeeNRatePanelProps) {
  const router = useRouter();
  const [packingDollars, setPackingDollars] = useState(
    centsToUsdInput(initialPackingFeePerLineCents),
  );
  const [comboRows, setComboRows] = useState<ComboFormRow[]>(() =>
    combosFromServer(initialCombos),
  );
  const [tierRows, setTierRows] = useState<FeeTierFormRow[]>(() =>
    sortTierRows(serverTiersToFormRows(initialTiers)),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [packMsg, setPackMsg] = useState<string | null>(null);
  const [packErr, setPackErr] = useState<string | null>(null);
  const [packPending, startPackTransition] = useTransition();

  const sortedPreview = useMemo(() => sortTierRows(tierRows), [tierRows]);

  return (
    <div className="space-y-6">
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
          <CardTitle className="text-lg">Packing &amp; container combinations</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">Per quoted line:</span> flat packing fee
            (below). <span className="font-medium text-foreground">Container mix:</span> add one row
            per total you charge for—e.g. 1 barrel + 0 bins = $100, 0 + 1 bin = $70, 1 barrel + 1
            bin = $150, 2 barrels + 0 bins = $185. Totals are{" "}
            <span className="font-medium text-foreground">exact barrel and bin quantities</span>{" "}
            in the cart (sum quantities by kind). Checkout should look up the matching row; add
            every mix you sell.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-4xl space-y-4">
          {packMsg ?
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
              {packMsg}
            </p>
          : null}
          {packErr ?
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {packErr}
            </p>
          : null}
          <div className="space-y-2">
            <Label htmlFor="packing-usd">Packing fee per quoted line (USD)</Label>
            <Input
              id="packing-usd"
              inputMode="decimal"
              value={packingDollars}
              onChange={(e) => setPackingDollars(e.target.value)}
              className={cn(fieldSelectClassName, "max-w-xs")}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Barrels (total qty)</th>
                  <th className="px-3 py-2 font-medium">Bins (total qty)</th>
                  <th className="px-3 py-2 font-medium">Total fee for this mix (USD)</th>
                  <th className="w-24 px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {comboRows.map((row) => (
                  <tr key={row.clientKey} className="border-b border-border/80 last:border-0">
                    <td className="px-3 py-2 align-top">
                      <Input
                        inputMode="numeric"
                        value={String(row.barrelCount)}
                        onChange={(e) => {
                          const n = parseCountInput(e.target.value);
                          setComboRows((rows) =>
                            rows.map((r) =>
                              r.clientKey === row.clientKey ? { ...r, barrelCount: n } : r,
                            ),
                          );
                        }}
                        className={fieldSelectClassName}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        inputMode="numeric"
                        value={String(row.binCount)}
                        onChange={(e) => {
                          const n = parseCountInput(e.target.value);
                          setComboRows((rows) =>
                            rows.map((r) =>
                              r.clientKey === row.clientKey ? { ...r, binCount: n } : r,
                            ),
                          );
                        }}
                        className={fieldSelectClassName}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Input
                        inputMode="decimal"
                        value={centsToUsdInput(row.feeCents)}
                        onChange={(e) => {
                          const c = parseUsdToCents(e.target.value);
                          setComboRows((rows) =>
                            rows.map((r) =>
                              r.clientKey === row.clientKey ? { ...r, feeCents: c } : r,
                            ),
                          );
                        }}
                        className={fieldSelectClassName}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setComboRows((rows) =>
                            rows.filter((r) => r.clientKey !== row.clientKey),
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setComboRows((rows) => [
                  ...rows,
                  {
                    clientKey: crypto.randomUUID(),
                    barrelCount: 1,
                    binCount: 0,
                    feeCents: 0,
                  },
                ])
              }
            >
              Add combination
            </Button>
            <Button
              type="button"
              disabled={packPending}
              onClick={() => {
                setPackMsg(null);
                setPackErr(null);
                startPackTransition(async () => {
                  const res = await updateMerchantPackingBarrelFeesAction({
                    packingFeePerLineCents: parseUsdToCents(packingDollars),
                    combos: comboRows.map((r) => ({
                      barrelCount: r.barrelCount,
                      binCount: r.binCount,
                      feeCents: r.feeCents,
                    })),
                  });
                  if (!res.ok) {
                    setPackErr(res.message);
                    return;
                  }
                  setPackMsg(res.message);
                  router.refresh();
                });
              }}
            >
              Save packing &amp; combination fees
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service &amp; handling tiers</CardTitle>
          <CardDescription>
            Each row is one <span className="font-medium text-foreground">price band</span> per
            consumer unit. Enter <span className="font-medium text-foreground">from</span> and{" "}
            <span className="font-medium text-foreground">through</span> (both inclusive). The
            next row’s “from” should match one cent above the previous “through” (it updates
            automatically when you change a “through”). The{" "}
            <span className="font-medium text-foreground">last row</span> uses an open-ended top so
            every price is covered; only its “from” is editable there.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr>
                  <th className="px-3 py-2 font-medium">From (USD)</th>
                  <th className="px-3 py-2 font-medium">Through (USD)</th>
                  <th className="px-3 py-2 font-medium">Fee per consumer unit (USD)</th>
                  <th className="w-24 px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {sortedPreview.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/80 last:border-0">
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-1">
                        <Label className="sr-only">From (USD), row {idx + 1}</Label>
                        <Input
                          inputMode="decimal"
                          value={centsToUsdInput(row.minUnitPriceInclusiveCents)}
                          onChange={(e) => {
                            const c = parseUsdToCents(e.target.value);
                            setTierRows((rows) =>
                              sortTierRows(
                                rows.map((r) =>
                                  r === row ? { ...r, minUnitPriceInclusiveCents: c } : r,
                                ),
                              ),
                            );
                          }}
                          className={fieldSelectClassName}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="space-y-1">
                        <Label className="sr-only">Through (USD), row {idx + 1}</Label>
                        {isOpenEndedMax(row.maxUnitPriceInclusiveCents) ?
                          <p className="rounded-md border border-border bg-muted/30 px-2.5 py-2 text-sm text-muted-foreground">
                            Open-ended (system max)
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
                            className={fieldSelectClassName}
                          />
                        }
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
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
                        className={fieldSelectClassName}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={tierRows.length <= 1}
                        onClick={() =>
                          setTierRows((rows) => {
                            const filtered = sortTierRows(
                              rows.filter((r) => r !== row),
                            );
                            if (filtered.length === 0) return filtered;
                            return filtered.map((r, i) =>
                              i === 0 ?
                                { ...r, minUnitPriceInclusiveCents: 1 }
                              : {
                                  ...r,
                                  minUnitPriceInclusiveCents:
                                    filtered[i - 1]!.maxUnitPriceInclusiveCents + 1,
                                },
                            );
                          })
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
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const sorted = sortedPreview;
                const last = sorted[sorted.length - 1];
                if (last && isOpenEndedMax(last.maxUnitPriceInclusiveCents)) {
                  const penult =
                    sorted.length >= 2 ? sorted[sorted.length - 2] : null;
                  const base = penult?.maxUnitPriceInclusiveCents ?? 0;
                  const newMax = base + 10_000;
                  const newMin = base + 1;
                  setTierRows((rows) =>
                    sortTierRows([
                      ...rows.map((r) =>
                        r === last ?
                          { ...r, minUnitPriceInclusiveCents: newMax + 1 }
                        : { ...r },
                      ),
                      {
                        minUnitPriceInclusiveCents: newMin,
                        maxUnitPriceInclusiveCents: newMax,
                        feePerUnitCents: 0,
                      },
                    ]),
                  );
                  return;
                }
                if (!last) {
                  setTierRows((rows) =>
                    sortTierRows([
                      ...rows,
                      {
                        minUnitPriceInclusiveCents: 1,
                        maxUnitPriceInclusiveCents: 2000,
                        feePerUnitCents: 0,
                      },
                    ]),
                  );
                  return;
                }
                const nextMin = last.maxUnitPriceInclusiveCents + 1;
                const nextMax = last.maxUnitPriceInclusiveCents + 10_000;
                setTierRows((rows) =>
                  sortTierRows([
                    ...rows,
                    {
                      minUnitPriceInclusiveCents: nextMin,
                      maxUnitPriceInclusiveCents: nextMax,
                      feePerUnitCents: 0,
                    },
                  ]),
                );
              }}
            >
              Add tier
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setMsg(null);
                setErr(null);
                const validationErr = validateTiers(sortedPreview);
                if (validationErr) {
                  setErr(validationErr);
                  return;
                }
                startTransition(async () => {
                  const res = await updateMerchantPricingSettingsAction({
                    packingFeePerLineCents: parseUsdToCents(packingDollars),
                    combos: comboRows.map((r) => ({
                      barrelCount: r.barrelCount,
                      binCount: r.binCount,
                      feeCents: r.feeCents,
                    })),
                    tiers: sortedPreview.map((t) => ({
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
              Save pricing
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
