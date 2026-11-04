"use client";

import { useMemo, useState, useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { saveShoppingListEstimateAction } from "@/actions/admin-save-shopping-list-estimate";
import { uploadShoppingListLinePhotoAction } from "@/actions/upload-shopping-list-line-photo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  shoppingListLineTaxCents,
  type AdminShoppingListQuoteView,
} from "@/lib/shopping-list-quote";
import {
  isStarterBundleSourceKind,
  type StarterBundleSnapshot,
} from "@/lib/starter-bundles";
import {
  computeLineEstimateCents,
  formatUsd,
  type AdminMarkupSettings,
  type MerchantServiceTierRow,
} from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/[$,]/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

type LineEdit = {
  itemRequestId: string;
  productName: string;
  quantity: number;
  productSize: string;
  productColor: string;
  note: string;
  productImageUrl: string | null;
  itemCost$: string;
  serviceFee$: string;
  estimatedShipping$: string;
  tax$: string;
};

type LineField = Exclude<keyof LineEdit, "itemRequestId" | "productImageUrl">;

type ImagePreview = { src: string; alt: string };

type FieldEditor = {
  listId: string;
  itemRequestId: string;
  field: LineField;
};

const LINE_FIELD_LABELS: Record<LineField, string> = {
  productName: "Product name",
  quantity: "Quantity",
  productSize: "Size",
  productColor: "Color",
  note: "Note",
  itemCost$: "Price",
  serviceFee$: "Service & handling",
  estimatedShipping$: "Shipping",
  tax$: "Sales tax",
};

const MULTILINE_FIELDS = new Set<LineField>(["productName", "note"]);
const MONEY_FIELDS = new Set<LineField>([
  "itemCost$",
  "serviceFee$",
  "estimatedShipping$",
  "tax$",
]);

function lineFieldValue(line: LineEdit, field: LineField): string {
  if (field === "quantity") return String(line.quantity);
  return line[field];
}

function LineCellInput({
  onEnlarge,
  ...props
}: ComponentProps<typeof Input> & { onEnlarge: () => void }) {
  return (
    <div
      className="min-w-0 w-full"
      title="Double-click to edit in a larger field"
      onDoubleClick={(event) => {
        event.preventDefault();
        onEnlarge();
      }}
    >
      <Input {...props} />
    </div>
  );
}

function snapshotLineTotal(
  snapshot: StarterBundleSnapshot | null | undefined,
  productName: string,
  quantity: number,
): number | null {
  if (!snapshot) return null;
  const match = snapshot.items.find(
    (item) =>
      item.productName.trim().toLowerCase() === productName.trim().toLowerCase() &&
      item.quantity === quantity,
  );
  return match?.lineTotalCents ?? null;
}

function lineFromView(
  row: AdminShoppingListQuoteView["lines"][number],
  settings: AdminMarkupSettings,
  snapshot?: StarterBundleSnapshot | null,
): LineEdit {
  const quote = row.quote;
  const productName =
    row.request.productName?.trim() || row.line.productName?.trim() || "";
  const snapshotTotal = snapshotLineTotal(snapshot, productName, row.request.quantity);
  return {
    itemRequestId: row.request.id,
    productName,
    quantity: row.request.quantity,
    productSize: row.request.productSize ?? row.line.productSize ?? "",
    productColor: row.request.productColor ?? row.line.productColor ?? "",
    note: row.request.note ?? row.line.note ?? "",
    productImageUrl: row.request.productImageUrl ?? row.line.productImageUrl,
    itemCost$: centsToDollarInput(quote?.itemCost ?? snapshotTotal ?? 0),
    serviceFee$: centsToDollarInput(quote?.serviceFee ?? 0),
    estimatedShipping$: centsToDollarInput(
      quote?.estimatedShipping ?? settings.defaultShippingCents,
    ),
    tax$: centsToDollarInput(shoppingListLineTaxCents(quote)),
  };
}

function applySuggestedFees(
  line: LineEdit,
  settings: AdminMarkupSettings,
  serviceTiers: MerchantServiceTierRow[],
): LineEdit {
  const qty = Math.max(1, line.quantity);
  const merch = parseDollarsToCents(line.itemCost$);
  const shipping = parseDollarsToCents(line.estimatedShipping$);
  const unit = qty > 0 ? Math.round(merch / qty) : merch;
  const est = computeLineEstimateCents(
    unit,
    qty,
    { taxBps: settings.taxBps, defaultShippingCents: shipping },
    { serviceTiers },
  );
  return {
    ...line,
    serviceFee$: centsToDollarInput(est.serviceFeeCents ?? 0),
    tax$: centsToDollarInput(est.taxCents),
  };
}

function initialOpenListId(
  lists: AdminShoppingListQuoteView[],
  initialBatchSessionId?: string,
): string | null {
  if (initialBatchSessionId) {
    const match = lists.find(
      (row) => row.list.batchQuoteSessionId === initialBatchSessionId,
    );
    if (match) return match.list.id;
  }
  return lists[0]?.list.id ?? null;
}

export function AdminShoppingListQuotesPanel({
  lists,
  taxBps,
  defaultShippingCents,
  serviceTiers,
  initialBatchSessionId,
}: {
  lists: AdminShoppingListQuoteView[];
  taxBps: number;
  defaultShippingCents: number;
  serviceTiers: MerchantServiceTierRow[];
  initialBatchSessionId?: string;
}) {
  const router = useRouter();
  const settings: AdminMarkupSettings = { taxBps, defaultShippingCents };
  const [openId, setOpenId] = useState<string | null>(() =>
    initialOpenListId(lists, initialBatchSessionId),
  );
  const [edits, setEdits] = useState<Record<string, LineEdit[]>>(() => {
    const next: Record<string, LineEdit[]> = {};
    for (const list of lists) {
      next[list.list.id] = list.lines.map((row) =>
        lineFromView(row, settings, list.list.starterBundleSnapshot),
      );
    }
    return next;
  });
  const [staffNotes, setStaffNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [fieldEditor, setFieldEditor] = useState<FieldEditor | null>(null);

  const active = lists.find((row) => row.list.id === openId) ?? null;
  const activeLines = openId ? (edits[openId] ?? []) : [];

  const totals = useMemo(() => {
    let merchandise = 0;
    let shipping = 0;
    let tax = 0;
    let service = 0;
    for (const line of activeLines) {
      merchandise += parseDollarsToCents(line.itemCost$);
      shipping += parseDollarsToCents(line.estimatedShipping$);
      tax += parseDollarsToCents(line.tax$);
      service += parseDollarsToCents(line.serviceFee$);
    }
    return {
      merchandise,
      shipping,
      tax,
      service,
      grand: merchandise + shipping + tax + service,
    };
  }, [activeLines]);

  function patchLine(listId: string, itemRequestId: string, patch: Partial<LineEdit>) {
    setEdits((current) => ({
      ...current,
      [listId]: (current[listId] ?? []).map((row) =>
        row.itemRequestId === itemRequestId ? { ...row, ...patch } : row,
      ),
    }));
  }

  function onPickLinePhoto(
    listId: string,
    itemRequestId: string,
    fileList: FileList | null,
  ) {
    const file = fileList?.[0];
    if (!file || pending) return;
    const fd = new FormData();
    fd.set("file", file);
    setUploadingKey(itemRequestId);
    startTransition(async () => {
      const res = await uploadShoppingListLinePhotoAction(fd);
      setUploadingKey(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      patchLine(listId, itemRequestId, { productImageUrl: res.imageUrl });
    });
  }

  function suggestFees(listId: string, line: LineEdit) {
    const next = applySuggestedFees(line, settings, serviceTiers);
    patchLine(listId, line.itemRequestId, {
      serviceFee$: next.serviceFee$,
      tax$: next.tax$,
    });
  }

  function applyLineField(
    listId: string,
    line: LineEdit,
    field: LineField,
    raw: string,
  ) {
    if (field === "quantity") {
      const quantity = Math.max(1, Number.parseInt(raw, 10) || 1);
      const next = { ...line, quantity };
      const suggested = applySuggestedFees(next, settings, serviceTiers);
      patchLine(listId, line.itemRequestId, {
        quantity,
        serviceFee$: suggested.serviceFee$,
        tax$: suggested.tax$,
      });
      return;
    }
    if (field === "itemCost$") {
      patchLine(listId, line.itemRequestId, { itemCost$: raw });
      return;
    }
    patchLine(listId, line.itemRequestId, { [field]: raw });
  }

  function closeFieldEditor() {
    if (fieldEditor) {
      const line = (edits[fieldEditor.listId] ?? []).find(
        (row) => row.itemRequestId === fieldEditor.itemRequestId,
      );
      if (line && fieldEditor.field === "itemCost$") {
        suggestFees(fieldEditor.listId, line);
      }
    }
    setFieldEditor(null);
  }

  const fieldEditorLine =
    fieldEditor ?
      ((edits[fieldEditor.listId] ?? []).find(
        (row) => row.itemRequestId === fieldEditor.itemRequestId,
      ) ?? null)
    : null;

  function save(list: AdminShoppingListQuoteView) {
    const lines = edits[list.list.id] ?? [];
    if (lines.length === 0) {
      toast.error("This list has no product lines.");
      return;
    }
    for (const line of lines) {
      if (!line.productName.trim()) {
        toast.error("Every product needs a name.");
        return;
      }
    }
    startTransition(async () => {
      const merch = lines.reduce((sum, line) => sum + parseDollarsToCents(line.itemCost$), 0);
      const ship = lines.reduce(
        (sum, line) => sum + parseDollarsToCents(line.estimatedShipping$),
        0,
      );
      const tax = lines.reduce((sum, line) => sum + parseDollarsToCents(line.tax$), 0);
      const res = await saveShoppingListEstimateAction({
        shoppingListQuoteId: list.list.id,
        siteMerchandiseCents: merch,
        siteShippingCents: ship,
        siteSaleTaxCents: tax,
        staffNote: staffNotes[list.list.id]?.trim() || undefined,
        lines: lines.map((line) => ({
          itemRequestId: line.itemRequestId,
          productName: line.productName.trim(),
          quantity: line.quantity,
          productSize: line.productSize.trim() || undefined,
          productColor: line.productColor.trim() || undefined,
          note: line.note.trim() || undefined,
          productImageUrl: line.productImageUrl?.trim() || undefined,
          itemCost: parseDollarsToCents(line.itemCost$),
          serviceFee: parseDollarsToCents(line.serviceFee$),
          estimatedShipping: parseDollarsToCents(line.estimatedShipping$),
          tax: parseDollarsToCents(line.tax$),
        })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  if (lists.length === 0) {
    return (
      <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No shopping-list quotes yet. When a shopper submits a list photo from Requested
        items or a Starter Bundle, it appears here for pricing.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Price each product, then send the estimate. The shopper previews and accepts it on Add
        item → Batch quotes, which adds the bundle to cart.
      </p>
      <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <ul className="space-y-1">
          {lists.map((row) => {
            const selected = row.list.id === openId;
            return (
              <li key={row.list.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(row.list.id)}
                  className={
                    selected
                      ? "w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm shadow-sm"
                      : "w-full rounded-lg border border-transparent px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  }
                >
                  <span className="block font-medium text-foreground">
                    {row.customerFullName?.trim() || row.customerEmail || "Shopper"}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    {isStarterBundleSourceKind(row.list.sourceKind) ?
                      <StatusBadge kind="inCart">Starter Bundle</StatusBadge>
                    : <StatusBadge kind="neutral">Shopping list</StatusBadge>}
                    <StatusBadge
                      kind={row.list.status === "estimated" ? "quoted" : "newRequest"}
                    >
                      {row.list.status === "estimated" ? "Estimate sent" : "Awaiting estimate"}
                    </StatusBadge>
                    {row.batchNumber ?
                      <span className="font-mono">Batch {row.batchNumber}</span>
                    : null}
                    <span>
                      {row.lines.length} product{row.lines.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {active ?
          <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {active.customerFullName?.trim() ||
                    (isStarterBundleSourceKind(active.list.sourceKind)
                      ? "Starter Bundle"
                      : "Shopping list")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {active.customerEmail ?? "No email on file"}
                  {active.batchNumber ? ` · Batch ${active.batchNumber}` : ""}
                  {isStarterBundleSourceKind(active.list.sourceKind)
                    ? " · Source: Starter Bundle"
                    : " · Source: Shopping list"}
                </p>
              </div>
              {active.list.sourceImageUrl ?
                <button
                  type="button"
                  title="View larger shopping list photo"
                  className="overflow-hidden rounded-md border border-border"
                  onClick={() =>
                    setImagePreview({
                      src: active.list.sourceImageUrl!,
                      alt: isStarterBundleSourceKind(active.list.sourceKind)
                        ? "Starter bundle image"
                        : "Uploaded shopping list",
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={active.list.sourceImageUrl}
                    alt={
                      isStarterBundleSourceKind(active.list.sourceKind)
                        ? "Starter bundle image"
                        : "Uploaded shopping list"
                    }
                    className="h-20 w-28 cursor-zoom-in object-cover"
                  />
                </button>
              : null}
            </div>

            {isStarterBundleSourceKind(active.list.sourceKind) ?
              <StarterBundleSubmittedCopy
                snapshot={active.list.starterBundleSnapshot ?? null}
                customerNote={active.list.customerNote}
              />
            : null}

            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full min-w-[72rem] text-left text-sm">
                <thead className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">Qty</th>
                    <th className="px-2 py-2 font-medium">Size</th>
                    <th className="px-2 py-2 font-medium">Color</th>
                    <th className="px-2 py-2 font-medium">Note</th>
                    <th className="px-2 py-2 font-medium">Price</th>
                    <th className="px-2 py-2 font-medium">Service &amp; handling</th>
                    <th className="px-2 py-2 font-medium">Shipping</th>
                    <th className="px-2 py-2 font-medium">Sales tax</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLines.map((line) => (
                    <tr key={line.itemRequestId} className="border-b border-border/60 align-top">
                      <td className="px-2 py-2">
                        <div className="flex items-start gap-2">
                          {line.productImageUrl ?
                            <button
                              type="button"
                              title="View larger product photo"
                              className="shrink-0 overflow-hidden rounded border border-border"
                              onClick={() =>
                                setImagePreview({
                                  src: line.productImageUrl!,
                                  alt: line.productName.trim() || "Product photo",
                                })
                              }
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={line.productImageUrl}
                                alt=""
                                className="size-10 cursor-zoom-in object-cover"
                              />
                            </button>
                          : <label
                              title="Upload product photo"
                              className={cn(
                                "inline-flex size-10 shrink-0 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-border bg-muted text-[9px] font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground",
                                (pending || uploadingKey) &&
                                  "pointer-events-none opacity-50",
                              )}
                            >
                              {uploadingKey === line.itemRequestId ?
                                <Loader2Icon className="size-3.5 animate-spin" />
                              : <CameraIcon className="size-3.5" />}
                              <span className="sr-only">
                                Upload product photo for {line.productName || "this row"}
                              </span>
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="sr-only"
                                disabled={pending}
                                onChange={(e) => {
                                  onPickLinePhoto(
                                    active.list.id,
                                    line.itemRequestId,
                                    e.target.files,
                                  );
                                  e.currentTarget.value = "";
                                }}
                              />
                            </label>}
                          <LineCellInput
                            value={line.productName}
                            disabled={pending}
                            onEnlarge={() =>
                              setFieldEditor({
                                listId: active.list.id,
                                itemRequestId: line.itemRequestId,
                                field: "productName",
                              })
                            }
                            onChange={(e) =>
                              patchLine(active.list.id, line.itemRequestId, {
                                productName: e.target.value,
                              })
                            }
                          />
                        </div>
                      </td>
                      <td className="w-20 px-2 py-2">
                        <LineCellInput
                          type="number"
                          min={1}
                          className="tabular-nums"
                          value={line.quantity}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "quantity",
                            })
                          }
                          onChange={(e) =>
                            applyLineField(
                              active.list.id,
                              line,
                              "quantity",
                              e.target.value,
                            )
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <LineCellInput
                          value={line.productSize}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "productSize",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              productSize: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <LineCellInput
                          value={line.productColor}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "productColor",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              productColor: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <LineCellInput
                          value={line.note}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "note",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              note: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <LineCellInput
                          inputMode="decimal"
                          className="tabular-nums"
                          value={line.itemCost$}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "itemCost$",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              itemCost$: e.target.value,
                            })
                          }
                          onBlur={(e) =>
                            suggestFees(active.list.id, {
                              ...line,
                              itemCost$: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <LineCellInput
                          inputMode="decimal"
                          className="tabular-nums"
                          value={line.serviceFee$}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "serviceFee$",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              serviceFee$: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <LineCellInput
                          inputMode="decimal"
                          className="tabular-nums"
                          value={line.estimatedShipping$}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "estimatedShipping$",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              estimatedShipping$: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <LineCellInput
                          inputMode="decimal"
                          className="tabular-nums"
                          value={line.tax$}
                          disabled={pending}
                          onEnlarge={() =>
                            setFieldEditor({
                              listId: active.list.id,
                              itemRequestId: line.itemRequestId,
                              field: "tax$",
                            })
                          }
                          onChange={(e) =>
                            patchLine(active.list.id, line.itemRequestId, {
                              tax$: e.target.value,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="grid gap-2 rounded-lg border border-border/80 bg-muted p-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Merchandise total</dt>
                <dd className="tabular-nums font-medium">{formatUsd(totals.merchandise)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Shipping total</dt>
                <dd className="tabular-nums font-medium">{formatUsd(totals.shipping)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Sales tax total</dt>
                <dd className="tabular-nums font-medium">{formatUsd(totals.tax)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Service &amp; handling total</dt>
                <dd className="tabular-nums font-medium">{formatUsd(totals.service)}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2 border-t border-border/60 pt-2">
                <dt className="font-medium text-foreground">Estimate total</dt>
                <dd className="tabular-nums font-semibold">{formatUsd(totals.grand)}</dd>
              </div>
            </dl>

            <div className="space-y-1">
              <Label htmlFor={`list-note-${active.list.id}`}>Staff note (optional)</Label>
              <textarea
                id={`list-note-${active.list.id}`}
                className="min-h-[4.5rem] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                value={staffNotes[active.list.id] ?? ""}
                disabled={pending}
                onChange={(e) =>
                  setStaffNotes((current) => ({
                    ...current,
                    [active.list.id]: e.target.value,
                  }))
                }
              />
            </div>

            <div className="flex justify-end">
              <Button type="button" disabled={pending} onClick={() => save(active)}>
                {pending ?
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" />
                    Sending…
                  </>
                : active.list.status === "estimated" ?
                  "Update estimate"
                : "Send estimate"}
              </Button>
            </div>
          </div>
        : null}
      </div>

      <Dialog
        open={imagePreview != null}
        onOpenChange={(open) => {
          if (!open) setImagePreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-[min(96vw,56rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image preview</DialogTitle>
            <DialogDescription>{imagePreview?.alt ?? "Photo"}</DialogDescription>
          </DialogHeader>
          {imagePreview ?
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview.src}
                alt={imagePreview.alt}
                className="mx-auto max-h-[min(70vh,36rem)] w-full object-contain"
              />
            </div>
          : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={fieldEditor != null && fieldEditorLine != null}
        onOpenChange={(open) => {
          if (!open) closeFieldEditor();
        }}
      >
        {fieldEditor && fieldEditorLine ?
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{LINE_FIELD_LABELS[fieldEditor.field]}</DialogTitle>
              <DialogDescription>
                {fieldEditorLine.productName.trim() ?
                  `Editing this field for ${fieldEditorLine.productName.trim()}.`
                : "Type the value in a larger field, then done."}
              </DialogDescription>
            </DialogHeader>
            {MULTILINE_FIELDS.has(fieldEditor.field) ?
              <textarea
                autoFocus
                className={cn(inputFieldClassName, "min-h-36 py-2.5 text-base")}
                value={lineFieldValue(fieldEditorLine, fieldEditor.field)}
                disabled={pending}
                onChange={(e) =>
                  applyLineField(
                    fieldEditor.listId,
                    fieldEditorLine,
                    fieldEditor.field,
                    e.target.value,
                  )
                }
              />
            : <Input
                autoFocus
                type={fieldEditor.field === "quantity" ? "number" : "text"}
                min={fieldEditor.field === "quantity" ? 1 : undefined}
                inputMode={
                  fieldEditor.field === "quantity" ? "numeric"
                  : MONEY_FIELDS.has(fieldEditor.field) ? "decimal"
                  : undefined
                }
                className="h-11 text-base tabular-nums"
                value={lineFieldValue(fieldEditorLine, fieldEditor.field)}
                disabled={pending}
                onChange={(e) =>
                  applyLineField(
                    fieldEditor.listId,
                    fieldEditorLine,
                    fieldEditor.field,
                    e.target.value,
                  )
                }
                onBlur={
                  fieldEditor.field === "itemCost$" ?
                    (e) =>
                      suggestFees(fieldEditor.listId, {
                        ...fieldEditorLine,
                        itemCost$: e.target.value,
                      })
                  : undefined
                }
              />}
            <DialogFooter>
              <Button type="button" onClick={closeFieldEditor}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        : null}
      </Dialog>
    </div>
  );
}

function StarterBundleSubmittedCopy({
  snapshot,
  customerNote,
}: {
  snapshot: StarterBundleSnapshot | null;
  customerNote: string | null;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Submitted starter bundle
        </p>
        <p className="text-sm font-medium text-foreground">
          {snapshot?.name ?? "Starter Bundle"}
        </p>
        {snapshot ?
          <p className="text-xs text-muted-foreground">
            Estimated merchandise subtotal at submit:{" "}
            {formatUsd(snapshot.merchandiseSubtotalCents)}
          </p>
        : null}
      </div>
      {snapshot && snapshot.items.length > 0 ?
        <div className="overflow-x-auto rounded-md border border-border/70">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="border-b border-border bg-muted text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Product</th>
                <th className="px-2 py-1.5 font-medium">Qty</th>
                <th className="px-2 py-1.5 font-medium">Color / variant</th>
                <th className="px-2 py-1.5 font-medium">Size</th>
                <th className="px-2 py-1.5 font-medium">Unit</th>
                <th className="px-2 py-1.5 font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.items.map((item, index) => (
                <tr key={`${item.productName}-${index}`} className="border-b border-border/60">
                  <td className="px-2 py-1.5 text-foreground">{item.productName}</td>
                  <td className="px-2 py-1.5 tabular-nums">{item.quantity}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {item.productColor || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {item.productSize || "—"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {formatUsd(item.estimatedUnitPriceCents)}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {formatUsd(item.lineTotalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      : null}
      {customerNote?.trim() ?
        <p className="text-sm text-foreground">
          <span className="font-medium">Customer note: </span>
          {customerNote.trim()}
        </p>
      : <p className="text-xs text-muted-foreground">No customer note.</p>}
    </div>
  );
}
