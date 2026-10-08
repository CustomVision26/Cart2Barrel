"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createContainerPackingFeeRecordAction,
  deleteContainerPackingFeeRecordAction,
  setContainerPackingFeePublishedAction,
  updateContainerPackingFeeRecordAction,
} from "@/actions/admin-container-packing-fee-records";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, nativeSelectFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatUsd } from "@/lib/admin-markup";
import { centsToUsdInput, parseUsdToCents } from "@/lib/admin-pricing-form-utils";
import { appTableHead, appTableRowHover, appTableScroll } from "@/lib/app-table-surfaces";
import {
  barrelPackingFeeCents,
  binPackingFeeCents,
  cargoBoxPackingFeeCents,
} from "@/lib/container-packing-fee";
import type { ContainerPackingFeeRecord } from "@/lib/container-packing-fee";
import {
  CARGO_BOX_PACKING_SIZES,
  packingFeeContainerLabel,
  type CargoBoxPackingSize,
} from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

const fieldClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

type PackingKind = "barrel" | "bin" | "cargo_box";

function previewForRecord(record: {
  containerKind: PackingKind;
  cargoBoxSize: CargoBoxPackingSize | null;
  singleFeeCents: number;
  multiFeeCents: number;
}): string {
  if (record.containerKind === "barrel") {
    return `Preview: 4 barrels → 4 × ${formatUsd(record.multiFeeCents)} = ${formatUsd(
      barrelPackingFeeCents(4, {
        singleBarrelPackingFeeCents: record.singleFeeCents,
        multiBarrelPackingPerUnitCents: record.multiFeeCents,
        singleBinPackingFeeCents: 0,
        multiBinPackingPerUnitCents: 0,
      }),
    )}`;
  }
  if (record.containerKind === "bin") {
    return `Preview: 3 bins → 3 × ${formatUsd(record.multiFeeCents)} = ${formatUsd(
      binPackingFeeCents(3, {
        singleBarrelPackingFeeCents: 0,
        multiBarrelPackingPerUnitCents: 0,
        singleBinPackingFeeCents: record.singleFeeCents,
        multiBinPackingPerUnitCents: record.multiFeeCents,
      }),
    )}`;
  }
  const size = record.cargoBoxSize ?? "E";
  const total = cargoBoxPackingFeeCents(3, {
    singlePackingFeeCents: record.singleFeeCents,
    multiPackingPerUnitCents: record.multiFeeCents,
  });
  return `Preview: 3 cargo box ${size} → 3 × ${formatUsd(record.multiFeeCents)} = ${formatUsd(total)}`;
}

function PackingFeeFields({
  kind,
  cargoBoxSize,
  singleUsd,
  multiUsd,
  onSingleUsd,
  onMultiUsd,
  disabled,
}: {
  kind: PackingKind;
  cargoBoxSize: CargoBoxPackingSize | null;
  singleUsd: string;
  multiUsd: string;
  onSingleUsd: (value: string) => void;
  onMultiUsd: (value: string) => void;
  disabled?: boolean;
}) {
  const label = packingFeeContainerLabel(kind, cargoBoxSize);
  const unit =
    kind === "barrel" ? "barrel" : kind === "bin" ? "bin" : `cargo box ${cargoBoxSize ?? ""}`.trim();
  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-2">
        <Label htmlFor={`single-${kind}-${cargoBoxSize ?? "none"}`}>
          Exactly 1 {unit} (USD)
        </Label>
        <Input
          id={`single-${kind}-${cargoBoxSize ?? "none"}`}
          inputMode="decimal"
          value={singleUsd}
          disabled={disabled}
          onChange={(e) => onSingleUsd(e.target.value)}
          className={fieldClassName}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`multi-${kind}-${cargoBoxSize ?? "none"}`}>
          Each {unit} when 2+ in cart (USD)
        </Label>
        <Input
          id={`multi-${kind}-${cargoBoxSize ?? "none"}`}
          inputMode="decimal"
          value={multiUsd}
          disabled={disabled}
          onChange={(e) => onMultiUsd(e.target.value)}
          className={fieldClassName}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {previewForRecord({
          containerKind: kind,
          cargoBoxSize,
          singleFeeCents: parseUsdToCents(singleUsd),
          multiFeeCents: parseUsdToCents(multiUsd),
        })}
      </p>
    </div>
  );
}

type AdminGeneralPackageFeePanelProps = {
  records: ContainerPackingFeeRecord[];
};

export function AdminGeneralPackageFeePanel({
  records,
}: AdminGeneralPackageFeePanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<PackingKind>("barrel");
  const [cargoBoxSize, setCargoBoxSize] = useState<CargoBoxPackingSize>("E");
  const [singleUsd, setSingleUsd] = useState("0.00");
  const [multiUsd, setMultiUsd] = useState("0.00");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editSingleUsd, setEditSingleUsd] = useState("0.00");
  const [editMultiUsd, setEditMultiUsd] = useState("0.00");

  const openRecord = useMemo(
    () => records.find((row) => row.id === openId) ?? null,
    [openId, records],
  );
  const deleteRecord = useMemo(
    () => records.find((row) => row.id === deleteId) ?? null,
    [deleteId, records],
  );

  function openEdit(record: ContainerPackingFeeRecord) {
    setOpenId(record.id);
    setEditSingleUsd(centsToUsdInput(record.singleFeeCents));
    setEditMultiUsd(centsToUsdInput(record.multiFeeCents));
  }

  function createRecord() {
    startTransition(async () => {
      const res = await createContainerPackingFeeRecordAction({
        containerKind: kind,
        cargoBoxSize: kind === "cargo_box" ? cargoBoxSize : null,
        singleFeeCents: parseUsdToCents(singleUsd),
        multiFeeCents: parseUsdToCents(multiUsd),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSingleUsd("0.00");
      setMultiUsd("0.00");
      router.refresh();
    });
  }

  function saveOpen() {
    if (!openRecord) return;
    startTransition(async () => {
      const res = await updateContainerPackingFeeRecordAction({
        id: openRecord.id,
        singleFeeCents: parseUsdToCents(editSingleUsd),
        multiFeeCents: parseUsdToCents(editMultiUsd),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setOpenId(null);
      router.refresh();
    });
  }

  function togglePublish(record: ContainerPackingFeeRecord) {
    startTransition(async () => {
      const res = await setContainerPackingFeePublishedAction({
        id: record.id,
        published: !record.publishedAt,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  function confirmDelete() {
    if (!deleteRecord) return;
    startTransition(async () => {
      const res = await deleteContainerPackingFeeRecordAction({
        id: deleteRecord.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setDeleteId(null);
      if (openId === deleteRecord.id) setOpenId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create package fee</CardTitle>
          <CardDescription>
            Add a packing schedule for barrel, cargo box (E, EH, or D), or bin.
            One container uses the 1-container rate; 2+ of that type use the
            per-unit rate. Publish a row to show it on How it works and bill it
            at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="packing-kind">Container type</Label>
              <select
                id="packing-kind"
                className={nativeSelectFieldClassName}
                value={kind}
                disabled={pending}
                onChange={(e) => setKind(e.target.value as PackingKind)}
              >
                <option value="barrel">Barrel</option>
                <option value="cargo_box">Cargo box</option>
                <option value="bin">Bin</option>
              </select>
            </div>
            {kind === "cargo_box" ?
              <div className="space-y-2">
                <Label htmlFor="packing-box-size">Cargo box size</Label>
                <select
                  id="packing-box-size"
                  className={nativeSelectFieldClassName}
                  value={cargoBoxSize}
                  disabled={pending}
                  onChange={(e) =>
                    setCargoBoxSize(e.target.value as CargoBoxPackingSize)
                  }
                >
                  {CARGO_BOX_PACKING_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} box
                    </option>
                  ))}
                </select>
              </div>
            : null}
          </div>
          <PackingFeeFields
            kind={kind}
            cargoBoxSize={kind === "cargo_box" ? cargoBoxSize : null}
            singleUsd={singleUsd}
            multiUsd={multiUsd}
            onSingleUsd={setSingleUsd}
            onMultiUsd={setMultiUsd}
            disabled={pending}
          />
          <Button type="button" disabled={pending} onClick={createRecord}>
            {pending ? "Saving…" : "Add packing fee"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Packing &amp; container combinations</CardTitle>
          <CardDescription>
            Open a row to edit the 1-container and 2+ rates. Publish, edit, or
            delete each schedule independently.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ?
            <p className="text-sm text-muted-foreground">
              No packing fees yet. Add barrel, cargo box, or bin above.
            </p>
          : <div className={appTableScroll}>
              <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
                <thead className={appTableHead}>
                  <tr>
                    <th className="px-3 py-2 font-medium">Container</th>
                    <th className="px-3 py-2 font-medium">Exactly 1</th>
                    <th className="px-3 py-2 font-medium">Each when 2+</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.map((record) => (
                    <tr
                      key={record.id}
                      className={cn(appTableRowHover, "cursor-pointer")}
                      onDoubleClick={() => openEdit(record)}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">
                        {packingFeeContainerLabel(
                          record.containerKind,
                          record.cargoBoxSize,
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatUsd(record.singleFeeCents)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatUsd(record.multiFeeCents)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          kind={record.publishedAt ? "quoted" : "draft"}
                        >
                          {record.publishedAt ? "Published" : "Unpublished"}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={record.publishedAt ? "outline" : "default"}
                            disabled={pending}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePublish(record);
                            }}
                          >
                            {record.publishedAt ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEdit(record);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10"
                            disabled={pending}
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteId(record.id);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          }
        </CardContent>
      </Card>

      <Dialog
        open={openRecord != null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      >
        <DialogContent className="max-h-[min(92vh,40rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {openRecord
                ? packingFeeContainerLabel(
                    openRecord.containerKind,
                    openRecord.cargoBoxSize,
                  )
                : "Packing fee"}
            </DialogTitle>
            <DialogDescription>
              Exactly 1 uses the single rate; 2+ of this type use the per-unit
              rate × count.
            </DialogDescription>
          </DialogHeader>
          {openRecord ?
            <div className="space-y-4">
              <PackingFeeFields
                kind={openRecord.containerKind}
                cargoBoxSize={openRecord.cargoBoxSize}
                singleUsd={editSingleUsd}
                multiUsd={editMultiUsd}
                onSingleUsd={setEditSingleUsd}
                onMultiUsd={setEditMultiUsd}
                disabled={pending}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={pending} onClick={saveOpen}>
                  {pending ? "Saving…" : "Save packing fee"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => togglePublish(openRecord)}
                >
                  {openRecord.publishedAt ? "Unpublish" : "Publish"}
                </Button>
              </div>
            </div>
          : null}
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={deleteRecord != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete packing fee?"
        description={
          deleteRecord
            ? `Remove ${packingFeeContainerLabel(
                deleteRecord.containerKind,
                deleteRecord.cargoBoxSize,
              )} packing rates. Checkout will stop using this schedule.`
            : "Remove this packing fee."
        }
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
