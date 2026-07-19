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
  adminPublishSpecialFeatureContainerAction,
  adminUnpublishSpecialFeatureContainerAction,
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
import type { SpecialFeatureContainerFormRef } from "@/data/special-feature-offers";
import {
  containerOfferingKindLabel,
  type ContainerOfferingKind,
  type SuitcaseSizeOption,
} from "@/lib/validations/container-offering";
import { cn } from "@/lib/utils";

const barrelsFieldSelectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
);

const SUITCASE_SIZE_OPTIONS: SuitcaseSizeOption[] = [
  'Small 20"',
  'Medium 24"',
  'Large 28"',
];

export type AdminSerializableOffering = {
  id: string;
  name: string;
  sizeLabel: string;
  kind: ContainerOfferingKind;
  priceUsdCents: number;
  isActive: boolean;
  specialFeatureOfferId?: string | null;
  linkedSpecialFeatureOfferId?: string | null;
  specialFeaturePublished?: boolean;
};

export type AdminSerializableImage = {
  id: string;
  imageUrl: string;
  sortIndex: number;
};

type AdminBarrelsManagerProps = {
  offerings: { offering: AdminSerializableOffering; images: AdminSerializableImage[] }[];
  specialFeatures: SpecialFeatureContainerFormRef[];
};

function specialFeatureStatusClassName(
  status: SpecialFeatureContainerFormRef["status"],
): string {
  if (status === "Live") {
    return "border-primary/40 bg-primary/15 text-primary";
  }
  if (status === "Draft") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
  if (status === "Ended") {
    return "border-border/80 bg-muted/60 text-muted-foreground";
  }
  return "border-border/80 bg-muted text-muted-foreground";
}

function centsToUsdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function AdminBarrelsManager({
  offerings,
  specialFeatures,
}: AdminBarrelsManagerProps) {
  const router = useRouter();
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [specialFeatureOffer, setSpecialFeatureOffer] = useState(false);
  const [suitcaseSizes, setSuitcaseSizes] = useState<
    Record<SuitcaseSizeOption, boolean>
  >({
    'Small 20"': true,
    'Medium 24"': true,
    'Large 28"': true,
  });
  const [selectedSpecialId, setSelectedSpecialId] = useState<string | null>(
    specialFeatures[0]?.id ?? null,
  );

  const selectedSpecial =
    specialFeatures.find((special) => special.id === selectedSpecialId) ??
    specialFeatures[0] ??
    null;

  useEffect(() => {
    if (!specialFeatureOffer) {
      setSelectedSpecialId(null);
      return;
    }
    if (specialFeatures.length === 0) {
      setSelectedSpecialId(null);
      return;
    }
    setSelectedSpecialId((current) => {
      if (current && specialFeatures.some((special) => special.id === current)) {
        return current;
      }
      return specialFeatures[0]?.id ?? null;
    });
  }, [specialFeatureOffer, specialFeatures]);

  function toggleSuitcaseSize(size: SuitcaseSizeOption) {
    setSuitcaseSizes((prev) => ({ ...prev, [size]: !prev[size] }));
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New container</CardTitle>
          <CardDescription>
            {specialFeatureOffer ?
              "Link suitcase SKU(s) to an existing special, pick sizes and price, then Publish from the catalog card."
            : "Add a name, type (barrel or bin), size label, and price. Upload one or more photos after the container is created."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={createFormRef}
            className="grid gap-4 sm:grid-cols-2"
            action={(fd) => {
              const wasSpecial = specialFeatureOffer;
              const selectedSizes = SUITCASE_SIZE_OPTIONS.filter(
                (s) => suitcaseSizes[s],
              );
              startTransition(async () => {
                const res = await adminCreateContainerOfferingAction({
                  name: String(fd.get("name") ?? ""),
                  sizeLabel: wasSpecial ?
                    selectedSizes[0] ?? 'Medium 24"'
                  : String(fd.get("sizeLabel") ?? ""),
                  kind: wasSpecial ? "suitcase" : String(fd.get("kind") ?? "barrel"),
                  priceUsd: String(fd.get("priceUsd") ?? ""),
                  specialFeatureOffer: wasSpecial,
                  specialFeatureOfferId: wasSpecial ? selectedSpecialId ?? undefined : undefined,
                  suitcaseSizes: wasSpecial ? selectedSizes : [],
                });
                if (!res.ok) {
                  toast.error(res.message);
                  return;
                }
                createFormRef.current?.reset();
                setSpecialFeatureOffer(false);
                setSuitcaseSizes({
                  'Small 20"': true,
                  'Medium 24"': true,
                  'Large 28"': true,
                });
                toast.success(
                  wasSpecial ?
                    "Suitcase container(s) created. Use Publish on the catalog card to show shoppers."
                  : "Container created.",
                );
                router.refresh();
              });
            }}
          >
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="new-special-feature"
                checked={specialFeatureOffer}
                onChange={(e) => setSpecialFeatureOffer(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              <Label
                htmlFor="new-special-feature"
                className="text-sm font-normal"
              >
                Special feature offer
              </Label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={specialFeatureOffer ? "new-special-name" : "new-name"}>
                Name
              </Label>
              {specialFeatureOffer ?
                specialFeatures.length === 0 ?
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    No draft or live special yet. Create one under{" "}
                    <a
                      href="/admin/overview?tab=special-features"
                      className="font-medium underline underline-offset-4"
                    >
                      Special features
                    </a>{" "}
                    first.
                  </p>
                : <>
                    <select
                      id="new-special-select"
                      value={selectedSpecialId ?? ""}
                      onChange={(e) => setSelectedSpecialId(e.target.value)}
                      className={barrelsFieldSelectClassName}
                    >
                      {specialFeatures.map((special) => (
                        <option key={special.id} value={special.id}>
                          {special.name} ({special.status})
                        </option>
                      ))}
                    </select>
                    <input
                      type="hidden"
                      name="name"
                      value={selectedSpecial?.name ?? ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      Uses the special from{" "}
                      <span className="font-medium text-foreground">
                        Special features
                      </span>
                      . Listed transportation fee:{" "}
                      {selectedSpecial ?
                        formatUsd(selectedSpecial.priceUsdCents)
                      : "—"}
                    </p>
                  </>
              : <Input
                  id="new-name"
                  name="name"
                  required
                  placeholder="e.g. Standard barrel"
                />
              }
            </div>
            {specialFeatureOffer ?
              <>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                    {SUITCASE_SIZE_OPTIONS.map((size) => (
                      <label
                        key={size}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={suitcaseSizes[size]}
                          onChange={() => toggleSuitcaseSize(size)}
                          className="size-4 rounded border-border accent-primary"
                        />
                        {size}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-kind">Type</Label>
                  <select
                    id="new-kind"
                    name="kind"
                    required
                    value="suitcase"
                    disabled
                    className={barrelsFieldSelectClassName}
                  >
                    <option value="suitcase">Suitcase</option>
                  </select>
                  <input type="hidden" name="kind" value="suitcase" />
                </div>
              </>
            : <>
                <div className="space-y-2">
                  <Label htmlFor="new-size">Size</Label>
                  <Input
                    id="new-size"
                    name="sizeLabel"
                    required
                    placeholder="e.g. 55 gal"
                  />
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
              </>
            }
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
              <Button
                type="submit"
                disabled={
                  pending ||
                  (specialFeatureOffer && specialFeatures.length === 0)
                }
              >
                {pending ?
                  "Saving…"
                : specialFeatureOffer ?
                  "Create suitcase container(s)"
                : "Create container"}
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
                      specialFeatures={specialFeatures}
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
  specialFeatures,
  disabledAll,
  onRefresh,
}: {
  offering: AdminSerializableOffering;
  images: AdminSerializableImage[];
  specialFeatures: SpecialFeatureContainerFormRef[];
  disabledAll: boolean;
  onRefresh: () => void;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = disabledAll || pending;
  const isSpecialFeature =
    offering.kind === "suitcase" &&
    Boolean(offering.specialFeatureOfferId ?? offering.linkedSpecialFeatureOfferId);
  const specialWindowLive = Boolean(offering.specialFeaturePublished);
  const isPublished = offering.isActive;
  const isShopperVisible = offering.isActive && specialWindowLive;

  const linkedSpecialId =
    offering.linkedSpecialFeatureOfferId ?? offering.specialFeatureOfferId ?? "";

  const [name, setName] = useState(offering.name);
  const [selectedSpecialId, setSelectedSpecialId] = useState(linkedSpecialId);
  const [sizeLabel, setSizeLabel] = useState(offering.sizeLabel);
  const [kind, setKind] = useState<ContainerOfferingKind>(offering.kind);
  const [priceUsd, setPriceUsd] = useState(centsToUsdInput(offering.priceUsdCents));
  const [isActive, setIsActive] = useState(offering.isActive);

  const selectedSpecial =
    specialFeatures.find((special) => special.id === selectedSpecialId) ?? null;

  useEffect(() => {
    setName(offering.name);
    setSizeLabel(offering.sizeLabel);
    setKind(offering.kind);
    setPriceUsd(centsToUsdInput(offering.priceUsdCents));
    setIsActive(offering.isActive);

    const linked =
      offering.linkedSpecialFeatureOfferId ?? offering.specialFeatureOfferId ?? "";
    if (linked && specialFeatures.some((special) => special.id === linked)) {
      setSelectedSpecialId(linked);
      return;
    }
    const byName = specialFeatures.find((special) => special.name === offering.name);
    setSelectedSpecialId(byName?.id ?? linked);
  }, [
    offering.id,
    offering.name,
    offering.sizeLabel,
    offering.kind,
    offering.priceUsdCents,
    offering.isActive,
    offering.linkedSpecialFeatureOfferId,
    offering.specialFeatureOfferId,
    specialFeatures,
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
            {isSpecialFeature ?
              <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                Special feature
              </span>
            : null}
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
                isPublished || (isActive && !isSpecialFeature) ?
                  "bg-emerald-500/15 text-emerald-200"
                : "bg-muted text-muted-foreground",
              )}
            >
              {isSpecialFeature ?
                isPublished ?
                  isShopperVisible ?
                    "Published"
                  : "Live SKU"
                : "Draft"
              : isActive ?
                "Active"
              : "Hidden"}
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
                ...(isSpecialFeature && selectedSpecialId ?
                  { specialFeatureOfferId: selectedSpecialId }
                : {}),
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
            {isSpecialFeature ?
              specialFeatures.length === 0 ?
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  No special feature offers yet. Create one under{" "}
                  <a
                    href="/admin/overview?tab=special-features"
                    className="font-medium underline underline-offset-4"
                  >
                    Special features
                  </a>
                  .
                </p>
              : <>
                  <select
                    id={`name-${offering.id}`}
                    required
                    value={selectedSpecialId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedSpecialId(id);
                      const special = specialFeatures.find((row) => row.id === id);
                      if (special) {
                        setName(special.name);
                      }
                    }}
                    className={barrelsFieldSelectClassName}
                    disabled={disabled}
                  >
                    {selectedSpecialId &&
                    !specialFeatures.some((special) => special.id === selectedSpecialId) ?
                      <option value={selectedSpecialId}>{name} (unlinked)</option>
                    : null}
                    {specialFeatures.map((special) => (
                      <option key={special.id} value={special.id}>
                        {special.name} ({special.status})
                      </option>
                    ))}
                  </select>
                  {selectedSpecial ?
                    <p className="text-xs text-muted-foreground">
                      Listed transportation fee:{" "}
                      {formatUsd(selectedSpecial.priceUsdCents)}
                    </p>
                  : null}
                </>
            : <Input
                id={`name-${offering.id}`}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            }
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
              disabled={isSpecialFeature}
              className={barrelsFieldSelectClassName}
            >
              {isSpecialFeature ?
                <option value="suitcase">Suitcase</option>
              : <>
                  <option value="barrel">Barrel</option>
                  <option value="bin">Bin</option>
                </>
              }
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
          {!isSpecialFeature ?
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
          : (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Each special suitcase SKU is published separately. Click Publish to show this size on{" "}
              <span className="font-medium text-foreground">/dashboard/barrels</span>.
              {isShopperVisible ?
                " This SKU is visible to shoppers."
              : isPublished && !specialWindowLive ?
                " This SKU is marked live; the promo window is not active yet."
              : isPublished ?
                " This SKU is live; shoppers will see it when the special promo is active."
              : specialWindowLive ?
                " The promo is live — click Publish to show this SKU."
              : null}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={disabled}>
              Save changes
            </Button>
            {isSpecialFeature && !offering.isActive ?
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  startTransition(async () => {
                    const res = await adminPublishSpecialFeatureContainerAction({
                      offeringId: offering.id,
                    });
                    if (!res.ok) {
                      toast.error(res.message);
                      return;
                    }
                    toast.success("Published — shoppers can see this suitcase now.");
                    onRefresh();
                  });
                }}
              >
                {pending ? "Publishing…" : "Publish"}
              </Button>
            : null}
            {isSpecialFeature && offering.isActive ?
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => setUnpublishOpen(true)}
              >
                Remove from live
              </Button>
            : null}
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
          open={unpublishOpen}
          onOpenChange={setUnpublishOpen}
          title="Remove this suitcase from live?"
          description="Shoppers will no longer see this special suitcase on /dashboard/barrels. The catalog entry and photos are kept — use Publish to show it again."
          confirmLabel="Remove from live"
          pending={pending}
          onConfirm={() => {
            startTransition(async () => {
              const res = await adminUnpublishSpecialFeatureContainerAction({
                offeringId: offering.id,
              });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success("Removed from live — hidden from shoppers.");
              setUnpublishOpen(false);
              onRefresh();
            });
          }}
        />

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
