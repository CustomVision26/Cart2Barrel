"use client";

import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon, Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { parseShoppingListImageAction } from "@/actions/parse-shopping-list-image";
import { submitShoppingListQuoteAction } from "@/actions/submit-shopping-list-quote";
import { uploadShoppingListLinePhotoAction } from "@/actions/upload-shopping-list-line-photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dashboardBatchQuotesActiveCreatedHref } from "@/lib/dashboard-add-item-routes";
import { SHOPPING_LIST_MAX_LINES } from "@/lib/shopping-list-quote";
import { cn } from "@/lib/utils";

type LineDraft = {
  clientKey: string;
  productName: string;
  quantity: number;
  productSize: string;
  productColor: string;
  note: string;
  productImageUrl: string;
};

function emptyLine(): LineDraft {
  return {
    clientKey: `row-${crypto.randomUUID()}`,
    productName: "",
    quantity: 1,
    productSize: "",
    productColor: "",
    note: "",
    productImageUrl: "",
  };
}

export function ShoppingListRequestWorkspace() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  function patchLine(clientKey: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((row) => (row.clientKey === clientKey ? { ...row, ...patch } : row)),
    );
  }

  function removeLine(clientKey: string) {
    setLines((current) => current.filter((item) => item.clientKey !== clientKey));
  }

  function onPickList(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || pending) return;
    if (fileRef.current) fileRef.current.value = "";
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await parseShoppingListImageAction(fd);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setSourceImageUrl(res.sourceImageUrl);
      setLines(res.lines);
      toast.success(`Found ${res.lines.length} product${res.lines.length === 1 ? "" : "s"}. Edit anything before submitting.`);
    });
  }

  function onPickLinePhoto(clientKey: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || pending) return;
    const fd = new FormData();
    fd.set("file", file);
    setUploadingKey(clientKey);
    startTransition(async () => {
      const res = await uploadShoppingListLinePhotoAction(fd);
      setUploadingKey(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      patchLine(clientKey, { productImageUrl: res.imageUrl });
    });
  }

  function submit() {
    if (!sourceImageUrl) {
      toast.error("Upload a list photo first.");
      return;
    }
    const ready = lines
      .map((row) => ({
        ...row,
        productName: row.productName.trim(),
      }))
      .filter((row) => row.productName.length > 0);
    if (ready.length === 0) {
      toast.error("Add at least one product name.");
      return;
    }
    startTransition(async () => {
      const res = await submitShoppingListQuoteAction({
        sourceImageUrl,
        lines: ready.map((row) => ({
          clientKey: row.clientKey,
          productName: row.productName,
          quantity: row.quantity,
          productSize: row.productSize.trim() || undefined,
          productColor: row.productColor.trim() || undefined,
          note: row.note.trim() || undefined,
          productImageUrl: row.productImageUrl.trim() || undefined,
        })),
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.push(dashboardBatchQuotesActiveCreatedHref(res.batchSessionId));
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm ring-1 ring-foreground/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">List photo</h2>
            <p className="text-sm text-muted-foreground">
              JPEG, PNG, WebP, or GIF. AI reads product name, quantity, size, color, and notes.
            </p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={pending}
              onChange={(e) => onPickList(e.target.files)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
            >
              {pending && !uploadingKey ?
                <Loader2Icon className="size-3.5 animate-spin" />
              : <CameraIcon className="size-3.5" />}
              {sourceImageUrl ? "Replace list photo" : "Upload list photo"}
            </Button>
          </div>
        </div>
        {sourceImageUrl ?
          <a
            href={sourceImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block overflow-hidden rounded-lg border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sourceImageUrl}
              alt="Uploaded shopping list"
              className="max-h-56 w-full object-contain bg-muted"
            />
          </a>
        : null}
      </div>

      {sourceImageUrl ?
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Products</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={pending || lines.length >= SHOPPING_LIST_MAX_LINES}
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              <Plus className="size-3.5" />
              Add row
            </Button>
          </div>
          {lines.length === 0 ?
            <p className="text-sm text-muted-foreground">
              No products in this list. Add a row or replace the list photo.
            </p>
          : (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[62rem] text-left text-sm">
              <thead className="border-b border-border bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Product name</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Size</th>
                  <th className="px-3 py-2 font-medium">Color</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                  <th className="px-3 py-2 font-medium">Photo</th>
                  <th className="sticky right-0 bg-muted px-3 py-2 font-medium">Delete</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((row) => (
                  <tr key={row.clientKey} className="border-b border-border/60 align-top">
                    <td className="px-3 py-2">
                      <Input
                        value={row.productName}
                        disabled={pending}
                        onChange={(e) =>
                          patchLine(row.clientKey, { productName: e.target.value })
                        }
                      />
                    </td>
                    <td className="w-20 px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        className="tabular-nums"
                        value={row.quantity}
                        disabled={pending}
                        onChange={(e) =>
                          patchLine(row.clientKey, {
                            quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.productSize}
                        disabled={pending}
                        onChange={(e) =>
                          patchLine(row.clientKey, { productSize: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.productColor}
                        disabled={pending}
                        onChange={(e) =>
                          patchLine(row.clientKey, { productColor: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.note}
                        disabled={pending}
                        onChange={(e) => patchLine(row.clientKey, { note: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {row.productImageUrl ?
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.productImageUrl}
                            alt=""
                            className="size-12 rounded-md border border-border object-cover"
                          />
                        : <span className="size-12 rounded-md border border-dashed border-border bg-muted" />}
                        <label
                          className={cn(
                            "inline-flex cursor-pointer items-center rounded-md border border-border px-2 py-1 text-xs font-medium",
                            pending && "pointer-events-none opacity-50",
                          )}
                        >
                          {uploadingKey === row.clientKey ? "…" : "Upload"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={pending}
                            onChange={(e) => {
                              onPickLinePhoto(row.clientKey, e.target.files);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </td>
                    <td className="sticky right-0 bg-card px-3 py-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={pending}
                        aria-label={`Delete ${row.productName.trim() || "row"}`}
                        onClick={() => removeLine(row.clientKey)}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {lines.length > 0 ?
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Submitting…" : "Submit list for quote"}
            </Button>
          </div>
          : null}
        </div>
      : (
        <p className="text-sm text-muted-foreground">
          Upload a list photo to generate the editable product table.
        </p>
      )}
    </div>
  );
}
