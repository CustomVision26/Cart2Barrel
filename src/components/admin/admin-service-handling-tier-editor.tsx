"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { UsdDecimalInput } from "@/components/admin/usd-decimal-input";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  addEditableTierRow,
  formRowsToServerPayload,
  prepareEditableRowsForSave,
  removeEditableTierRow,
  serverTiersToEditableRows,
  syncNextMinAfterMaxBlur,
  validateTiers,
  type FeeTierServerPayload,
} from "@/lib/service-handling-tier-form";

type AdminServiceHandlingTierEditorProps = {
  title: string;
  description: ReactNode;
  initialTiers: FeeTierServerPayload[];
  saveButtonLabel?: string;
  onSave: (
    tiers: FeeTierServerPayload[],
  ) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
};

export function AdminServiceHandlingTierEditor({
  title,
  description,
  initialTiers,
  saveButtonLabel = "Save tiers",
  onSave,
}: AdminServiceHandlingTierEditorProps) {
  const router = useRouter();
  const [tierRows, setTierRows] = useState(() =>
    serverTiersToEditableRows(initialTiers),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateRow(
    rowId: string,
    patch: Partial<(typeof tierRows)[number]>,
  ) {
    setTierRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg ?
          <p className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
            {msg}
          </p>
        : null}
        {err ?
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </p>
        : null}

        <FloatingHorizontalScroll viewportClassName="rounded-lg border border-border/80 bg-card ring-1 ring-foreground/5">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">From (USD)</th>
                <th className="px-3 py-2 font-medium">Through (USD)</th>
                <th className="px-3 py-2 font-medium">Fee per consumer unit (USD)</th>
                <th className="w-24 px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {tierRows.map((row, idx) => (
                <tr key={row.id} className="border-b border-border/80 last:border-0">
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-1">
                      <Label className="sr-only">From (USD), row {idx + 1}</Label>
                      <UsdDecimalInput
                        aria-label={`From USD row ${idx + 1}`}
                        value={row.minUsd}
                        onChange={(minUsd) => updateRow(row.id, { minUsd })}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="space-y-1">
                      <Label className="sr-only">Through (USD), row {idx + 1}</Label>
                      {row.openEndedMax ?
                        <p className="rounded-md border border-border bg-muted px-2.5 py-2 text-sm text-muted-foreground">
                          Open-ended (system max)
                        </p>
                      : <UsdDecimalInput
                          aria-label={`Through USD row ${idx + 1}`}
                          value={row.maxUsd}
                          onChange={(maxUsd) => updateRow(row.id, { maxUsd })}
                          onBlur={() =>
                            setTierRows((rows) =>
                              syncNextMinAfterMaxBlur(rows, row.id),
                            )
                          }
                        />
                      }
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <UsdDecimalInput
                      aria-label={`Fee per unit USD row ${idx + 1}`}
                      value={row.feeUsd}
                      onChange={(feeUsd) => updateRow(row.id, { feeUsd })}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={tierRows.length <= 1}
                      onClick={() =>
                        setTierRows((rows) => removeEditableTierRow(rows, row.id))
                      }
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FloatingHorizontalScroll>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setTierRows((rows) => addEditableTierRow(rows))}
          >
            Add tier
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setMsg(null);
              setErr(null);
              const centsRows = prepareEditableRowsForSave(tierRows);
              const validationErr = validateTiers(centsRows);
              if (validationErr) {
                setErr(validationErr);
                return;
              }
              startTransition(async () => {
                const res = await onSave(formRowsToServerPayload(centsRows));
                if (!res.ok) {
                  setErr(res.message);
                  return;
                }
                setMsg(res.message);
                setTierRows(serverTiersToEditableRows(formRowsToServerPayload(centsRows)));
                router.refresh();
              });
            }}
          >
            {saveButtonLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
