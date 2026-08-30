"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import {
  adminCreateContainerOfferingAction,
  adminDeleteContainerOfferingAction,
  adminDeleteContainerOfferingImageAction,
  adminMoveContainerOfferingImageAction,
  adminPublishSpecialFeatureContainerAction,
  adminSetContainerOfferingPublishedAction,
  adminUnpublishSpecialFeatureContainerAction,
  adminUpdateContainerOfferingAction,
  adminUploadContainerOfferingImagesAction,
} from "@/actions/admin-container-offerings";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatUsd } from "@/lib/admin-markup";
import type { SpecialFeatureContainerFormRef } from "@/lib/special-feature-window-label";
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

function centsToUsdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function isSpecialFeatureOffering(offering: AdminSerializableOffering): boolean {
  return (
    offering.kind === "suitcase" &&
    Boolean(offering.specialFeatureOfferId ?? offering.linkedSpecialFeatureOfferId)
  );
}

function catalogStatusLabel(offering: AdminSerializableOffering): string {
  if (isSpecialFeatureOffering(offering)) {
    if (!offering.isActive) return "Draft";
    if (offering.specialFeaturePublished) return "Published";
    return "Live SKU";
  }
  return offering.isActive ? "Published" : "Unpublished";
}

function catalogRowClassName(
  kind: ContainerOfferingKind,
  selected: boolean,
  published: boolean,
): string {
  return cn(
    "cursor-pointer select-none border-l-4 transition-colors",
    kind === "barrel" &&
      "border-l-amber-400 bg-amber-500/20 hover:bg-amber-500/35",
    kind === "bin" && "border-l-sky-400 bg-sky-500/20 hover:bg-sky-500/35",
    kind === "suitcase" &&
      "border-l-violet-400 bg-violet-500/20 hover:bg-violet-500/35",
    !published && "opacity-80",
    selected && "ring-2 ring-inset ring-foreground/55",
  );
}

function coverImage(
  images: AdminSerializableImage[],
): AdminSerializableImage | null {
  const sorted = [...images].sort((a, b) => a.sortIndex - b.sortIndex);
  return sorted[0] ?? null;
}

export function AdminBarrelsManager({
  offerings,
  specialFeatures,
}: AdminBarrelsManagerProps) {
  const router = useRouter();
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
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

  const editorRow =
    editorId ?
      offerings.find((row) => row.offering.id === editorId) ?? null
    : null;

  useEffect(() => {
    if (editorId && !offerings.some((row) => row.offering.id === editorId)) {
      setEditorId(null);
    }
  }, [editorId, offerings]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New container</CardTitle>
          <CardDescription>
            {specialFeatureOffer ?
              "Link suitcase SKU(s) to an existing special, pick sizes and price, then Publish from the catalog table."
            : "Add a name, type (barrel or bin), size label, and price. After create, double-click the row to edit, then Publish or Unpublish. Upload photos after the container is created."}
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
                    "Suitcase container(s) created. Double-click the row, then Publish to show shoppers."
                  : "Container created. Double-click the row to edit photos and publish settings.",
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
          <span className="min-w-0">
            <span className="block text-lg font-semibold text-foreground">Catalog</span>
            <span className="block text-xs font-normal text-muted-foreground">
              Double-click a row to open the container editor.
            </span>
          </span>
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
            {editorRow ?
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditorId(null)}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to catalog
                </Button>
                <AdminOfferingRow
                  offering={editorRow.offering}
                  images={editorRow.images}
                  specialFeatures={specialFeatures}
                  disabledAll={pending}
                  onRefresh={() => router.refresh()}
                  onDeleted={() => setEditorId(null)}
                />
              </div>
            : offerings.length === 0 ?
              <p className="text-sm text-muted-foreground">No containers yet.</p>
            : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-amber-400" aria-hidden />
                    Barrel
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-sky-400" aria-hidden />
                    Bin
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-violet-400" aria-hidden />
                    Suitcase
                  </span>
                </div>
                <FloatingHorizontalScroll className="rounded-lg border border-border">
                  <table className="w-full min-w-[48rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">Photo</th>
                        <th className="px-3 py-2.5 font-medium">Name</th>
                        <th className="px-3 py-2.5 font-medium">Type</th>
                        <th className="px-3 py-2.5 font-medium">Size</th>
                        <th className="px-3 py-2.5 font-medium">Price</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offerings.map(({ offering: o, images }) => {
                        const cover = coverImage(images);
                        const selected = selectedRowId === o.id;
                        return (
                          <tr
                            key={o.id}
                            className={catalogRowClassName(o.kind, selected, o.isActive)}
                            title="Double-click to edit this container"
                            onClick={() => setSelectedRowId(o.id)}
                            onDoubleClick={() => {
                              setSelectedRowId(o.id);
                              setEditorId(o.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                setSelectedRowId(o.id);
                                setEditorId(o.id);
                              }
                            }}
                            tabIndex={0}
                          >
                            <td className="px-3 py-2">
                              {cover ?
                                <div className="size-12 overflow-hidden rounded border border-border/60 bg-muted">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={cover.imageUrl}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                </div>
                              : (
                                <span className="text-xs text-muted-foreground">
                                  No photo
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-foreground">{o.name}</p>
                              {isSpecialFeatureOffering(o) ?
                                <p className="text-xs text-primary">Special feature</p>
                              : null}
                            </td>
                            <td className="px-3 py-2.5 text-foreground">
                              {containerOfferingKindLabel(o.kind)}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {o.sizeLabel}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-foreground">
                              {formatUsd(o.priceUsdCents)}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge
                                kind={o.isActive ? "fullyReceived" : "draft"}
                              >
                                {catalogStatusLabel(o)}
                              </StatusBadge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </FloatingHorizontalScroll>
              </div>
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
  onDeleted,
}: {
  offering: AdminSerializableOffering;
  images: AdminSerializableImage[];
  specialFeatures: SpecialFeatureContainerFormRef[];
  disabledAll: boolean;
  onRefresh: () => void;
  onDeleted?: () => void;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = disabledAll || pending;
  const isSpecialFeature =
    offering.kind === "suitcase" &&
    Boolean(offering.specialFeatureOfferId ?? offering.linkedSpecialFeatureOfferId);
  const isBarrelOrBin = offering.kind === "barrel" || offering.kind === "bin";
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

  const selectedSpecial =
    specialFeatures.find((special) => special.id === selectedSpecialId) ?? null;

  useEffect(() => {
    setName(offering.name);
    setSizeLabel(offering.sizeLabel);
    setKind(offering.kind);
    setPriceUsd(centsToUsdInput(offering.priceUsdCents));

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
                isPublished ?
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
              : isPublished ?
                "Published"
              : "Unpublished"}
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
                isActive: offering.isActive,
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
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Use Publish to show this {containerOfferingKindLabel(kind).toLowerCase()} on{" "}
              <span className="font-medium text-foreground">/dashboard/barrels</span>
              {isPublished ?
                ". Shoppers can see it now."
              : ". It is hidden from shoppers until you publish."}
            </p>
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
            {isBarrelOrBin && !isPublished ?
              <Button
                type="button"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  startTransition(async () => {
                    const res = await adminSetContainerOfferingPublishedAction({
                      offeringId: offering.id,
                      published: true,
                    });
                    if (!res.ok) {
                      toast.error(res.message);
                      return;
                    }
                    toast.success(
                      `Published — shoppers can see this ${containerOfferingKindLabel(offering.kind).toLowerCase()} now.`,
                    );
                    onRefresh();
                  });
                }}
              >
                {pending ? "Publishing…" : "Publish"}
              </Button>
            : null}
            {isBarrelOrBin && isPublished ?
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={() => setUnpublishOpen(true)}
              >
                Unpublish
              </Button>
            : null}
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
          title={
            isSpecialFeature ?
              "Remove this suitcase from live?"
            : `Unpublish this ${containerOfferingKindLabel(offering.kind).toLowerCase()}?`
          }
          description={
            isSpecialFeature ?
              "Shoppers will no longer see this special suitcase on /dashboard/barrels. The catalog entry and photos are kept — use Publish to show it again."
            : `Shoppers will no longer see this ${containerOfferingKindLabel(offering.kind).toLowerCase()} on /dashboard/barrels. The catalog entry and photos are kept — use Publish to show it again.`
          }
          confirmLabel={isSpecialFeature ? "Remove from live" : "Unpublish"}
          pending={pending}
          onConfirm={() => {
            startTransition(async () => {
              const res =
                isSpecialFeature ?
                  await adminUnpublishSpecialFeatureContainerAction({
                    offeringId: offering.id,
                  })
                : await adminSetContainerOfferingPublishedAction({
                    offeringId: offering.id,
                    published: false,
                  });
              if (!res.ok) {
                toast.error(res.message);
                return;
              }
              toast.success(
                isSpecialFeature ?
                  "Removed from live — hidden from shoppers."
                : `Unpublished — hidden from shoppers.`,
              );
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
              onDeleted?.();
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
