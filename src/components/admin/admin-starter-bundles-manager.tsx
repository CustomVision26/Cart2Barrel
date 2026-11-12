"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2Icon, Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminArchiveStarterBundleAction,
  adminPublishStarterBundleAction,
  adminSaveStarterBundleDraftAction,
} from "@/actions/admin-starter-bundles";
import { uploadStarterBundleImageAction } from "@/actions/upload-starter-bundle-image";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import {
  BudgetBarrelWorkspace,
  type BudgetBarrelPickedProduct,
} from "@/components/dashboard/budget-barrel-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatUsd } from "@/lib/admin-markup";
import { centsToUsdInput, parseUsdToCents } from "@/lib/admin-pricing-form-utils";
import {
  STARTER_BUNDLE_MAX_ITEMS,
  STARTER_BUNDLES_ROUTES,
  starterBundleLineTotalCents,
  starterBundleMerchandiseSubtotalCents,
  type StarterBundleStatus,
} from "@/lib/starter-bundles";
import { cn } from "@/lib/utils";

export type AdminStarterBundleListItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  barrelSize: string | null;
  barrelFillLevel: string | null;
  status: StarterBundleStatus;
  updatedAt: string;
  merchandiseSubtotalCents: number;
  items: {
    clientKey: string;
    productName: string;
    quantity: number;
    estimatedUnitPriceCents: number;
    productSize: string;
    productColor: string;
    retailerUrl: string;
  }[];
};

type ItemDraft = {
  clientKey: string;
  productName: string;
  quantity: number;
  unitPrice$: string;
  productSize: string;
  productColor: string;
  retailerUrl: string;
};

type FormState = {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  barrelSize: string;
  barrelFillLevel: string;
  items: ItemDraft[];
};

function isBlankItem(item: ItemDraft): boolean {
  return (
    item.productName.trim() === "" &&
    item.productSize.trim() === "" &&
    item.productColor.trim() === "" &&
    item.retailerUrl.trim() === "" &&
    parseUsdToCents(item.unitPrice$) === 0
  );
}

function emptyItem(): ItemDraft {
  return {
    clientKey: `row-${crypto.randomUUID()}`,
    productName: "",
    quantity: 1,
    unitPrice$: "0.00",
    productSize: "",
    productColor: "",
    retailerUrl: "",
  };
}

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    imageUrl: "",
    barrelSize: "",
    barrelFillLevel: "",
    items: [emptyItem()],
  };
}

function formFromBundle(row: AdminStarterBundleListItem): FormState {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl ?? "",
    barrelSize: row.barrelSize ?? "",
    barrelFillLevel: row.barrelFillLevel ?? "",
    items:
      row.items.length > 0
        ? row.items.map((item) => ({
            clientKey: item.clientKey,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice$: centsToUsdInput(item.estimatedUnitPriceCents),
            productSize: item.productSize,
            productColor: item.productColor,
            retailerUrl: item.retailerUrl,
          }))
        : [emptyItem()],
  };
}

function payloadFromForm(form: FormState) {
  const items = form.items
    .map((item) => ({
      clientKey: item.clientKey,
      productName: item.productName.trim(),
      quantity: item.quantity,
      estimatedUnitPriceCents: parseUsdToCents(item.unitPrice$),
      productSize: item.productSize.trim() || undefined,
      productColor: item.productColor.trim() || undefined,
      retailerUrl: item.retailerUrl.trim() || undefined,
    }))
    .filter((item) => item.productName.length > 0);
  return {
    ...(form.id ? { id: form.id } : {}),
    name: form.name.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim() || undefined,
    barrelSize: form.barrelSize.trim() || undefined,
    barrelFillLevel: form.barrelFillLevel.trim() || undefined,
    items,
  };
}

function statusBadgeKind(status: StarterBundleStatus) {
  if (status === "published") return "quoted" as const;
  if (status === "archived") return "neutral" as const;
  return "draft" as const;
}

export function AdminStarterBundlesManager({
  bundles,
}: {
  bundles: AdminStarterBundleListItem[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const merchandiseSubtotalCents = form
    ? starterBundleMerchandiseSubtotalCents(
        form.items.map((item) => ({
          quantity: item.quantity,
          estimatedUnitPriceCents: parseUsdToCents(item.unitPrice$),
        })),
      )
    : 0;

  function addPickedProducts(products: BudgetBarrelPickedProduct[]) {
    if (!form || products.length === 0) return;
    const kept = form.items.filter((item) => !isBlankItem(item));
    const room = Math.max(0, STARTER_BUNDLE_MAX_ITEMS - kept.length);
    const accepted = products.slice(0, room);
    if (accepted.length === 0) {
      toast.error(`A bundle can hold ${STARTER_BUNDLE_MAX_ITEMS} products.`);
      return;
    }
    const rows: ItemDraft[] = accepted.map((product) => ({
      clientKey: `row-${crypto.randomUUID()}`,
      productName: product.productName,
      quantity: product.quantity,
      unitPrice$: centsToUsdInput(product.unitPriceCents),
      productSize: product.productSize,
      productColor: product.productColor,
      retailerUrl: /^https:\/\//i.test(product.retailerUrl) ? product.retailerUrl : "",
    }));
    setForm({ ...form, items: [...kept, ...rows] });
    setPickerOpen(false);
    toast.success(
      accepted.length === products.length
        ? accepted.length === 1
          ? "Added 1 product to this bundle."
          : `Added ${accepted.length} products to this bundle.`
        : `Added ${accepted.length} of ${products.length} products. A bundle can hold ${STARTER_BUNDLE_MAX_ITEMS}.`,
    );
  }

  function patchItem(clientKey: string, patch: Partial<ItemDraft>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item) =>
          item.clientKey === clientKey ? { ...item, ...patch } : item,
        ),
      };
    });
  }

  function moveItem(clientKey: string, direction: -1 | 1) {
    setForm((current) => {
      if (!current) return current;
      const index = current.items.findIndex((item) => item.clientKey === clientKey);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.items.length) {
        return current;
      }
      const items = [...current.items];
      const [moved] = items.splice(index, 1);
      if (!moved) return current;
      items.splice(nextIndex, 0, moved);
      return { ...current, items };
    });
  }

  function onPickImage(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || pending) return;
    const fd = new FormData();
    fd.set("file", file);
    setUploading(true);
    startTransition(async () => {
      const res = await uploadStarterBundleImageAction(fd);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setForm((current) => (current ? { ...current, imageUrl: res.imageUrl } : current));
    });
  }

  function saveDraft() {
    if (!form) return;
    const payload = payloadFromForm(form);
    if (!payload.name || !payload.description) {
      toast.error("Enter a bundle name and description.");
      return;
    }
    startTransition(async () => {
      const res = await adminSaveStarterBundleDraftAction(payload);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Draft saved.");
      setForm((current) => (current ? { ...current, id: res.id } : current));
      router.refresh();
    });
  }

  function publish() {
    if (!form) return;
    const payload = payloadFromForm(form);
    if (!payload.name || !payload.description) {
      toast.error("Enter a bundle name and description.");
      return;
    }
    if (payload.items.length === 0) {
      toast.error("Add at least one product before publishing.");
      return;
    }
    startTransition(async () => {
      const res = await adminPublishStarterBundleAction(payload);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Bundle published.");
      setForm(null);
      router.refresh();
    });
  }

  function preview() {
    if (!form?.id) {
      toast.error("Save the bundle before previewing.");
      return;
    }
    window.open(
      `${STARTER_BUNDLES_ROUTES.detail(form.id)}?preview=1`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function archive() {
    if (!archiveId) return;
    startTransition(async () => {
      const res = await adminArchiveStarterBundleAction({ id: archiveId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Bundle archived.");
      setArchiveId(null);
      if (form?.id === archiveId) setForm(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Draft, publish, or archive fixed shopping lists. Shoppers see published bundles only.
        </p>
        <Button type="button" onClick={() => setForm(emptyForm())}>
          Create bundle
        </Button>
      </div>

      {bundles.length === 0 && !form ?
        <p className="rounded-lg border border-border/80 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No starter bundles yet. Create a bundle, add products and prices, then publish it.
        </p>
      : <ul className="space-y-2">
          {bundles.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-card px-3 py-2.5"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{row.name}</span>
                  <StatusBadge kind={statusBadgeKind(row.status)}>
                    {row.status}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.items.length} product{row.items.length === 1 ? "" : "s"} ·{" "}
                  {formatUsd(row.merchandiseSubtotalCents)} estimated merchandise
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setForm(formFromBundle(row))}
                >
                  Edit
                </Button>
                {row.status !== "archived" ?
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setArchiveId(row.id)}
                  >
                    Archive
                  </Button>
                : null}
              </div>
            </li>
          ))}
        </ul>}

      {form ?
        <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {form.id ? "Edit bundle" : "New bundle"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Product prices set the estimated merchandise subtotal.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPickerOpen(false);
                setForm(null);
              }}
            >
              Close
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="starter-bundle-name">Bundle name</Label>
              <Input
                id="starter-bundle-name"
                value={form.name}
                disabled={pending}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="starter-bundle-description">Short description</Label>
              <textarea
                id="starter-bundle-description"
                value={form.description}
                disabled={pending}
                rows={3}
                className={cn(inputFieldClassName, "min-h-20 py-2")}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="starter-bundle-barrel-size">Barrel size (optional)</Label>
              <Input
                id="starter-bundle-barrel-size"
                value={form.barrelSize}
                disabled={pending}
                onChange={(e) => setForm({ ...form, barrelSize: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="starter-bundle-fill">Approximate fill level (optional)</Label>
              <Input
                id="starter-bundle-fill"
                value={form.barrelFillLevel}
                disabled={pending}
                onChange={(e) =>
                  setForm({ ...form, barrelFillLevel: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Optional image</Label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => onPickImage(e.target.files)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ?
                    <Loader2Icon className="size-3.5 animate-spin" />
                  : null}
                  {form.imageUrl ? "Replace image" : "Upload image"}
                </Button>
                {form.imageUrl ?
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setForm({ ...form, imageUrl: "" })}
                  >
                    Remove
                  </Button>
                : null}
              </div>
              {form.imageUrl ?
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.imageUrl}
                  alt=""
                  className="mt-2 h-28 w-full max-w-xs rounded-md border border-border object-cover"
                />
              : null}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-foreground">Products</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || form.items.filter((item) => !isBlankItem(item)).length >= STARTER_BUNDLE_MAX_ITEMS}
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-3.5" />
                Add product
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border/80">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-border bg-muted text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Product</th>
                    <th className="px-2 py-2 font-medium">Qty</th>
                    <th className="px-2 py-2 font-medium">Size</th>
                    <th className="px-2 py-2 font-medium">Color / variant</th>
                    <th className="px-2 py-2 font-medium">Unit price</th>
                    <th className="px-2 py-2 font-medium">Line total</th>
                    <th className="px-2 py-2 font-medium">Retailer link</th>
                    <th className="px-2 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={item.clientKey} className="border-b border-border/60 align-top">
                      <td className="px-2 py-2">
                        <Input
                          value={item.productName}
                          disabled={pending}
                          onChange={(e) =>
                            patchItem(item.clientKey, { productName: e.target.value })
                          }
                        />
                      </td>
                      <td className="w-20 px-2 py-2">
                        <Input
                          type="number"
                          min={1}
                          className="tabular-nums"
                          value={item.quantity}
                          disabled={pending}
                          onChange={(e) =>
                            patchItem(item.clientKey, {
                              quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={item.productSize}
                          disabled={pending}
                          onChange={(e) =>
                            patchItem(item.clientKey, { productSize: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={item.productColor}
                          disabled={pending}
                          onChange={(e) =>
                            patchItem(item.clientKey, { productColor: e.target.value })
                          }
                        />
                      </td>
                      <td className="w-28 px-2 py-2">
                        <Input
                          className="tabular-nums"
                          value={item.unitPrice$}
                          disabled={pending}
                          onChange={(e) =>
                            patchItem(item.clientKey, { unitPrice$: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2 tabular-nums text-muted-foreground">
                        {formatUsd(
                          starterBundleLineTotalCents(
                            item.quantity,
                            parseUsdToCents(item.unitPrice$),
                          ),
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <Input
                          value={item.retailerUrl}
                          disabled={pending}
                          placeholder="https://"
                          onChange={(e) =>
                            patchItem(item.clientKey, { retailerUrl: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || index === 0}
                            onClick={() => moveItem(item.clientKey, -1)}
                          >
                            <ArrowUp className="size-3.5" />
                            <span className="sr-only">Move up</span>
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || index === form.items.length - 1}
                            onClick={() => moveItem(item.clientKey, 1)}
                          >
                            <ArrowDown className="size-3.5" />
                            <span className="sr-only">Move down</span>
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={pending || form.items.length <= 1}
                            onClick={() =>
                              setForm({
                                ...form,
                                items: form.items.filter(
                                  (row) => row.clientKey !== item.clientKey,
                                ),
                              })
                            }
                          >
                            <Trash2 className="size-3.5" />
                            <span className="sr-only">Remove</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm font-medium text-foreground">
              Estimated merchandise subtotal: {formatUsd(merchandiseSubtotalCents)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={saveDraft}>
              {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              Save draft
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={preview}>
              Preview
            </Button>
            <Button type="button" disabled={pending} onClick={publish}>
              Publish
            </Button>
            {form.id ?
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setArchiveId(form.id ?? null)}
              >
                Archive
              </Button>
            : null}
          </div>
        </div>
      : null}

      <Dialog open={pickerOpen && form != null} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[min(92vh,56rem)] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add products</DialogTitle>
            <DialogDescription>
              Build a list, hold the products to include, then add them to this bundle.
            </DialogDescription>
          </DialogHeader>
          {pickerOpen ? (
            <BudgetBarrelWorkspace onPickHeld={addPickedProducts} />
          ) : null}
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={archiveId != null}
        onOpenChange={(open) => {
          if (!open) setArchiveId(null);
        }}
        title="Archive this bundle?"
        description="Shoppers will no longer see it. Existing quote requests stay intact."
        confirmLabel="Archive"
        pending={pending}
        destructive
        onConfirm={archive}
      />
    </div>
  );
}
