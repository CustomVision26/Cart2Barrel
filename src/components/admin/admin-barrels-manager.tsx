"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import {
  adminCreateContainerOfferingAction,
  adminDeleteContainerOfferingAction,
  adminDeleteContainerOfferingImageAction,
  adminMoveContainerOfferingImageAction,
  adminUpdateContainerOfferingAction,
  adminUploadContainerOfferingImagesAction,
} from "@/actions/admin-container-offerings";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import {
  containerOfferingKindLabel,
  type ContainerOfferingKind,
} from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

const barrelsFieldSelectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
);

export type AdminSerializableOffering = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: ContainerOfferingKind;
  priceUsdCents: number;
  isActive: boolean;
};

export type AdminSerializableImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

type AdminBarrelsManagerProps = {
  offerings: { offering: AdminSerializableOffering; images: AdminSerializableImage[] }[];
};

function centsToUsdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function AdminBarrelsManager({ offerings }: AdminBarrelsManagerProps) {
  const router = useRouter();
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const createFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New container</CardTitle>
          <CardDescription>
            Add a name, type (barrel or bin), size label, and price. Upload one or more photos
            after the container is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={createFormRef}
            className="grid gap-4 sm:grid-cols-2"
            action={(fd) => {
              startTransition(async () => {
                const res = await adminCreateContainerOfferingAction({
                  name: String(fd.get("name") ?? ""),
                  sizeLabel: String(fd.get("sizeLabel") ?? ""),
                  kind: String(fd.get("kind") ?? "barrel"),
                  priceUsd: String(fd.get("priceUsd") ?? ""),
                });
                if (!res.ok) {
                  toast.error(res.message);
                  return;
                }
                createFormRef.current?.reset();
                toast.success("Container created.");
                router.refresh();
              });
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" name="name" required placeholder="e.g. Standard barrel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-size">Size</Label>
              <Input id="new-size" name="sizeLabel" required placeholder='e.g. 55 gal' />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-kind">Type</Label>
              <select
                id="new-kind"
                name="kind"
                required
                defaultValue="barrel"
                className={barrelsFieldSelectClassName}
              >
                <option value="barrel">Barrel</option>
                <option value="bin">Bin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-price">Price (USD)</Label>
              <Input
                id="new-price"
                name="priceUsd"
                required
                inputMode="decimal"
                placeholder="29.99"
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Create container"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <button
          type="button"
          id="admin-barrels-catalog-heading"
          onClick={() => setCatalogOpen((open) => !open)}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-md border border-border bg-card/40 px-3 py-2.5 text-left transition-colors",
            "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          aria-expanded={catalogOpen}
          aria-controls="admin-barrels-catalog-panel"
        >
          <span className="text-lg font-semibold text-foreground">Catalog</span>
          {catalogOpen ?
            <ChevronUp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          : <ChevronDown className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
        </button>
        {catalogOpen ?
          <div
            id="admin-barrels-catalog-panel"
            role="region"
            aria-labelledby="admin-barrels-catalog-heading"
            className="space-y-4"
          >
            {offerings.length === 0 ?
              <p className="text-sm text-muted-foreground">No containers yet.</p>
            : (
              <ul className="space-y-6">
                {offerings.map(({ offering: o, images }) => (
                  <li key={o.id}>
                    <AdminOfferingRow
                      offering={o}
                      images={images}
                      disabledAll={pending}
                      onRefresh={() => router.refresh()}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        : null}
      </div>
    </div>
  );
}

function AdminOfferingRow({
  offering,
  images,
  disabledAll,
  onRefresh,
}: {
  offering: AdminSerializableOffering;
  images: AdminSerializableImage[];
  disabledAll: boolean;
  onRefresh: () => void;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = disabledAll || pending;

  const [name, setName] = useState(offering.name);
  const [sizeLabel, setSizeLabel] = useState(offering.sizeLabel);
  const [kind, setKind] = useState<ContainerOfferingKind>(offering.kind);
  const [priceUsd, setPriceUsd] = useState(centsToUsdInput(offering.priceUsdCents));
  const [isActive, setIsActive] = useState(offering.isActive);

  useEffect(() => {
    setName(offering.name);
    setSizeLabel(offering.sizeLabel);
    setKind(offering.kind);
    setPriceUsd(centsToUsdInput(offering.priceUsdCents));
    setIsActive(offering.isActive);
  }, [
    offering.id,
    offering.name,
    offering.sizeLabel,
    offering.kind,
    offering.priceUsdCents,
    offering.isActive,
  ]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{name}</CardTitle>
            <CardDescription className="font-mono text-[11px]">
              {offering.id}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={cn(
                "rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground",
              )}
            >
              {containerOfferingKindLabel(kind)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                isActive ?
                  "bg-emerald-500/15 text-emerald-200"
                : "bg-muted text-muted-foreground",
              )}
            >
              {isActive ? "Active" : "Hidden"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await adminUpdateContainerOfferingAction({
                id: offering.id,
                name,
                sizeLabel,
                kind,
                priceUsd,
                isActive,
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success("Container updated.");
              onRefresh();
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`name-${offering.id}`}>Name</Label>
            <Input
              id={`name-${offering.id}`}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`size-${offering.id}`}>Size</Label>
            <Input
              id={`size-${offering.id}`}
              required
              value={sizeLabel}
              onChange={(e) => setSizeLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`kind-${offering.id}`}>Type</Label>
            <select
              id={`kind-${offering.id}`}
              required
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as ContainerOfferingKind)
              }
              className={barrelsFieldSelectClassName}
            >
              <option value="barrel">Barrel</option>
              <option value="bin">Bin</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`price-${offering.id}`}>Price (USD)</Label>
            <Input
              id={`price-${offering.id}`}
              required
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id={`active-${offering.id}`}
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            <Label htmlFor={`active-${offering.id}`} className="text-sm font-normal">
              Visible on shopper catalog
            </Label>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={disabled}>
              Save changes
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              disabled={disabled}
              onClick={() => setRemoveOpen(true)}
            >
              Remove container
            </Button>
          </div>
        </form>

        <AdminConfirmDialog
          open={removeOpen}
          onOpenChange={setRemoveOpen}
          title="Remove this container?"
          description="This deletes the catalog entry, its photos, and any shopper cart lines for this container. Past orders keep their line snapshots."
          confirmLabel="Remove"
          pending={pending}
          destructive
          onConfirm={() => {
            startTransition(async () => {
              const res = await adminDeleteContainerOfferingAction({ id: offering.id });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              setRemoveOpen(false);
              toast.success("Container removed.");
              onRefresh();
            });
          }}
        />

        <div className="space-y-2 border-t border-border/50 pt-4">
          <Label>Photos ({images.length})</Label>
          <p className="text-xs text-muted-foreground">
            Listing uses {formatUsd(offering.priceUsdCents)} · multiple images show as a carousel
            for shoppers.
          </p>
          <div className="flex flex-wrap gap-2">
            {[...images]
              .sort((a, b) => a.sortIndex - b.sortIndex)
              .map((im) => (
                <AdminOfferingImageThumb
                  key={im.id}
                  offeringId={offering.id}
                  image={im}
                  disabled={disabled}
                  onRefresh={onRefresh}
                />
              ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="max-w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1"
              disabled={disabled}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                const el = fileRef.current;
                if (!el?.files?.length) {
                  toast.error("Choose one or more images first.");
                  return;
                }
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("offeringId", offering.id);
                  for (const f of Array.from(el.files ?? [])) {
                    fd.append("file", f);
                  }
                  const res = await adminUploadContainerOfferingImagesAction(fd);
                  if (!res.ok) {
                    toast.error(res.message);
                    return;
                  }
                  el.value = "";
                  toast.success(
                    res.uploaded === 1 ?
                      "1 image uploaded."
                    : `${res.uploaded} images uploaded.`,
                  );
                  onRefresh();
                });
              }}
            >
              Upload
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminOfferingImageThumb({
  offeringId,
  image,
  disabled,
  onRefresh,
}: {
  offeringId: string;
  image: AdminSerializableImage;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const busy = disabled || pending;

  return (
    <div className="flex items-stretch gap-1">
      <div className="relative size-20 shrink-0 overflow-hidden rounded border border-border/60 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.imageUrl} alt="" className="size-full object-cover" />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="absolute right-0.5 top-0.5 h-6 min-w-0 px-1.5 text-[10px]"
          disabled={busy}
          onClick={() => {
            startTransition(async () => {
              const res = await adminDeleteContainerOfferingImageAction({
                imageId: image.id,
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success("Image removed.");
              onRefresh();
            });
          }}
        >
          ×
        </Button>
      </div>
      <div className="flex flex-col justify-center gap-0.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-7 shrink-0"
          disabled={busy}
          title="Move earlier in carousel"
          onClick={() => {
            startTransition(async () => {
              const res = await adminMoveContainerOfferingImageAction({
                offeringId,
                imageId: image.id,
                direction: "up",
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              onRefresh();
            });
          }}
        >
          <ChevronUp className="size-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="size-7 shrink-0"
          disabled={busy}
          title="Move later in carousel"
          onClick={() => {
            startTransition(async () => {
              const res = await adminMoveContainerOfferingImageAction({
                offeringId,
                imageId: image.id,
                direction: "down",
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              onRefresh();
            });
          }}
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
