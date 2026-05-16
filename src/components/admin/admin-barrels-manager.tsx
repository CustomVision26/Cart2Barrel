"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import {
  adminCreateContainerOfferingAction,
  adminDeleteContainerOfferingImageAction,
  adminMoveContainerOfferingImageAction,
  adminUpdateContainerOfferingAction,
  adminUploadContainerOfferingImagesAction,
} from "@/actions/admin-container-offerings";
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
import { cn } from "@/lib/utils";

export type AdminSerializableOffering = {
  id: string;
  name: string;
  sizeLabel: string;
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
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const createFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New container</CardTitle>
          <CardDescription>
            Add a name, size label, and price. Upload one or more photos after the container
            is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={createFormRef}
            className="grid gap-4 sm:grid-cols-2"
            action={(fd) => {
              setCreateMsg(null);
              startTransition(async () => {
                const res = await adminCreateContainerOfferingAction({
                  name: String(fd.get("name") ?? ""),
                  sizeLabel: String(fd.get("sizeLabel") ?? ""),
                  priceUsd: String(fd.get("priceUsd") ?? ""),
                });
                if (!res.ok) {
                  setCreateMsg(res.message);
                  return;
                }
                createFormRef.current?.reset();
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
          {createMsg ?
            <p className="mt-3 text-sm text-destructive">{createMsg}</p>
          : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Catalog</h2>
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
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const disabled = disabledAll || pending;

  const [name, setName] = useState(offering.name);
  const [sizeLabel, setSizeLabel] = useState(offering.sizeLabel);
  const [priceUsd, setPriceUsd] = useState(centsToUsdInput(offering.priceUsdCents));
  const [isActive, setIsActive] = useState(offering.isActive);

  useEffect(() => {
    setName(offering.name);
    setSizeLabel(offering.sizeLabel);
    setPriceUsd(centsToUsdInput(offering.priceUsdCents));
    setIsActive(offering.isActive);
  }, [
    offering.id,
    offering.name,
    offering.sizeLabel,
    offering.priceUsdCents,
    offering.isActive,
  ]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{offering.name}</CardTitle>
            <CardDescription className="font-mono text-[11px]">
              {offering.id}
            </CardDescription>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              offering.isActive ?
                "bg-emerald-500/15 text-emerald-200"
              : "bg-muted text-muted-foreground",
            )}
          >
            {offering.isActive ? "Active" : "Hidden"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            startTransition(async () => {
              const res = await adminUpdateContainerOfferingAction({
                id: offering.id,
                name,
                sizeLabel,
                priceUsd,
                isActive,
              });
              if (!res.ok) {
                setMsg(res.message);
                return;
              }
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
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" disabled={disabled}>
              Save changes
            </Button>
          </div>
        </form>

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
                  onMessage={setMsg}
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
                  setMsg("Choose one or more images first.");
                  return;
                }
                setMsg(null);
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("offeringId", offering.id);
                  for (const f of Array.from(el.files ?? [])) {
                    fd.append("file", f);
                  }
                  const res = await adminUploadContainerOfferingImagesAction(fd);
                  if (!res.ok) {
                    setMsg(res.message);
                    return;
                  }
                  el.value = "";
                  onRefresh();
                });
              }}
            >
              Upload
            </Button>
          </div>
        </div>
        {msg ?
          <p className="text-sm text-destructive">{msg}</p>
        : null}
      </CardContent>
    </Card>
  );
}

function AdminOfferingImageThumb({
  offeringId,
  image,
  disabled,
  onMessage,
  onRefresh,
}: {
  offeringId: string;
  image: AdminSerializableImage;
  disabled: boolean;
  onMessage: (m: string | null) => void;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const busy = disabled || pending;

  return (
    <div className="flex items-stretch gap-1">
      <div className="relative size-20 shrink-0 overflow-hidden rounded border border-border/60 bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.imageUrl} alt="" className="size-full object-cover" />
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="absolute right-0.5 top-0.5 h-6 min-w-0 px-1.5 text-[10px]"
          disabled={busy}
          onClick={() => {
            onMessage(null);
            startTransition(async () => {
              const res = await adminDeleteContainerOfferingImageAction({
                imageId: image.id,
              });
              if (!res.ok) {
                onMessage(res.message);
                return;
              }
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
            onMessage(null);
            startTransition(async () => {
              const res = await adminMoveContainerOfferingImageAction({
                offeringId,
                imageId: image.id,
                direction: "up",
              });
              if (!res.ok) {
                onMessage(res.message);
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
            onMessage(null);
            startTransition(async () => {
              const res = await adminMoveContainerOfferingImageAction({
                offeringId,
                imageId: image.id,
                direction: "down",
              });
              if (!res.ok) {
                onMessage(res.message);
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
