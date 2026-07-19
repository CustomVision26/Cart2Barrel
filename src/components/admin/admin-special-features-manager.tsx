"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  adminCreateSpecialFeatureOfferAction,
  adminDeleteSpecialFeatureOfferAction,
  adminEstimateAirlineBagFeesAction,
  adminPublishSpecialFeatureOfferAction,
  adminUnpublishSpecialFeatureOfferAction,
  adminUpdateSpecialFeatureOfferAction,
} from "@/actions/admin-special-feature-offers";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input, inputFieldClassName } from "@/components/ui/input";
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
  resolveSpecialFeatureNotes,
  SPECIAL_FEATURE_AUTO_NOTES,
} from "@/lib/special-feature-notes";
import { US_OPERATING_AIRLINES } from "@/lib/us-airlines";
import { cn } from "@/lib/utils";
import { getSpecialFeatureWindowStatus } from "@/data/special-feature-offers";
import {
  datetimeLocalValueToIso,
  isoToDatetimeLocalValue,
  specialFeaturePackagingModeLabel,
  type SpecialFeaturePackagingMode,
} from "@/lib/validations/special-feature-offer";

const fieldSelectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
);

const notesTextareaClassName = cn(
  inputFieldClassName,
  "min-h-24 resize-y py-2 text-base md:text-sm",
);

export type AdminSerializableSpecialFeature = {
  id: string;
  name: string;
  sizeLabel: string;
  destinationLocation: string;
  packagingMode: SpecialFeaturePackagingMode;
  priceUsdCents: number;
  airlineName: string;
  travelAt: string | null;
  airlineSecondBagUsdCents: number;
  airlineThirdBagUsdCents: number;
  airlineFourthBagUsdCents: number;
  airlineBagFeeExtraNote: string;
  notes: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  containerOfferingId: string | null;
};

type AdminSpecialFeaturesManagerProps = {
  offers: AdminSerializableSpecialFeature[];
};

function centsToUsdInput(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

function serverActionErrorMessage(error: unknown): string {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Could not reach the server. Wait for the page to finish loading, then try again.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

async function invokeAdminSpecialFeatureAction<
  T extends { ok: boolean; message?: string },
>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    toast.error(serverActionErrorMessage(error));
    return null;
  }
}

function safeRefresh(router: ReturnType<typeof useRouter>) {
  try {
    router.refresh();
  } catch (error) {
    toast.error(serverActionErrorMessage(error));
  }
}

function AirlineOptions({ extra }: { extra?: string }) {
  const extraTrim = extra?.trim() ?? "";
  const showExtra =
    extraTrim.length > 0 &&
    !(US_OPERATING_AIRLINES as readonly string[]).includes(extraTrim);

  return (
    <>
      <option value="">Select airline…</option>
      {showExtra ?
        <option value={extraTrim}>{extraTrim} (current)</option>
      : null}
      {US_OPERATING_AIRLINES.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </>
  );
}

function OutsideBagFeeSummary({
  secondUsd,
  thirdUsd,
  pending,
}: {
  secondUsd: string;
  thirdUsd: string;
  pending: boolean;
}) {
  if (pending) {
    return (
      <p className="text-xs text-muted-foreground">
        Looking up 2nd and 3rd checked-bag fees for the travel day…
      </p>
    );
  }
  if (!secondUsd && !thirdUsd) {
    return (
      <p className="text-xs text-muted-foreground">
        Select an airline and courier travel day to load the 2nd and 3rd checked-bag
        fees the traveler pays at the airport (not the special end date).
      </p>
    );
  }
  return (
    <ul className="space-y-0.5 text-xs text-muted-foreground">
      {secondUsd ?
        <li>2nd checked bag (~50 lb): {formatUsd(Math.round(Number(secondUsd) * 100))}</li>
      : null}
      {thirdUsd ?
        <li>3rd checked bag (~50 lb): {formatUsd(Math.round(Number(thirdUsd) * 100))}</li>
      : null}
    </ul>
  );
}

async function lookupOutsideBagFees(input: {
  airlineName: string;
  travelAt: string;
}): Promise<{
  secondUsd: string;
  thirdUsd: string;
  extraNote: string;
} | null> {
  if (!input.airlineName.trim() || !input.travelAt.trim()) return null;
  const res = await invokeAdminSpecialFeatureAction(() =>
    adminEstimateAirlineBagFeesAction({
      airlineName: input.airlineName,
      travelDate: input.travelAt,
    }),
  );
  if (!res) return null;
  if (!res.ok) {
    toast.error(res.message);
    return null;
  }
  const secondUsd =
    res.secondBagUsd != null ? res.secondBagUsd.toFixed(2) : "";
  const thirdUsd = res.thirdBagUsd != null ? res.thirdBagUsd.toFixed(2) : "";
  const parts = [
    secondUsd ? `2nd $${secondUsd}` : null,
    thirdUsd ? `3rd $${thirdUsd}` : null,
  ].filter(Boolean);
  toast.success(
    parts.length > 0 ?
      `Travel-day checked bags — ${parts.join(" · ")}`
    : "Bag fees updated.",
  );
  if (res.extraNote) toast.message(res.extraNote);
  return {
    secondUsd,
    thirdUsd,
    extraNote: res.extraNote?.trim() ?? "",
  };
}

export function AdminSpecialFeaturesManager({
  offers,
}: AdminSpecialFeaturesManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [packagingMode, setPackagingMode] =
    useState<SpecialFeaturePackagingMode>("in_app");
  const [airlineName, setAirlineName] = useState("");
  const [travelAt, setTravelAt] = useState("");
  const [secondBagUsd, setSecondBagUsd] = useState("");
  const [thirdBagUsd, setThirdBagUsd] = useState("");
  const [fourthBagUsd, setFourthBagUsd] = useState("");
  const [airlineBagFeeExtraNote, setAirlineBagFeeExtraNote] = useState("");
  const [lookupPending, setLookupPending] = useState(false);
  const [notes, setNotes] = useState(SPECIAL_FEATURE_AUTO_NOTES);

  function runBagFeeLookup(nextAirline: string, nextTravelAt: string) {
    if (!nextAirline.trim()) return;
    if (!nextTravelAt.trim()) {
      toast.message(
        "Set the courier travel day to load 2nd and 3rd checked-bag fees for that flight.",
      );
      return;
    }
    setLookupPending(true);
    startTransition(async () => {
      try {
        const fees = await lookupOutsideBagFees({
          airlineName: nextAirline,
          travelAt: nextTravelAt,
        });
        if (!fees) return;
        setSecondBagUsd(fees.secondUsd);
        setThirdBagUsd(fees.thirdUsd);
        setFourthBagUsd("");
        if (fees.extraNote) setAirlineBagFeeExtraNote(fees.extraNote);
      } finally {
        setLookupPending(false);
      }
    });
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New special feature</CardTitle>
          <CardDescription>
          Timed suitcase offer. While live, a promo appears on user pages. Link suitcase
          SKU(s) under{" "}
          <span className="font-medium text-foreground">Shipping containers</span> to show them on{" "}
          <span className="font-medium text-foreground">/dashboard/barrels</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            ref={createFormRef}
            className="grid gap-4 sm:grid-cols-2"
            action={(fd) => {
              startTransition(async () => {
                const res = await invokeAdminSpecialFeatureAction(() =>
                  adminCreateSpecialFeatureOfferAction({
                    name: String(fd.get("name") ?? ""),
                    packagingMode: String(fd.get("packagingMode") ?? "in_app"),
                    priceUsd: String(fd.get("priceUsd") ?? ""),
                    airlineName,
                    travelAt: datetimeLocalValueToIso(travelAt),
                    airlineSecondBagUsd: secondBagUsd,
                    airlineThirdBagUsd: thirdBagUsd,
                    airlineFourthBagUsd: fourthBagUsd,
                    airlineBagFeeExtraNote,
                    notes,
                    startsAt: datetimeLocalValueToIso(String(fd.get("startsAt") ?? "")),
                    endsAt: datetimeLocalValueToIso(String(fd.get("endsAt") ?? "")),
                  }),
                );
                if (!res?.ok) {
                  if (res) toast.error(res.message);
                  return;
                }
                createFormRef.current?.reset();
                setPackagingMode("in_app");
                setAirlineName("");
                setTravelAt("");
                setSecondBagUsd("");
                setThirdBagUsd("");
                setFourthBagUsd("");
                setAirlineBagFeeExtraNote("");
                setNotes(SPECIAL_FEATURE_AUTO_NOTES);
                toast.success("Draft created. Publish when ready to show the banner.");
                safeRefresh(router);
              });
            }}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sf-name">Name</Label>
              <Input
                id="sf-name"
                name="name"
                required
                placeholder="e.g. Holiday suitcase special"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sf-packaging">Packaging</Label>
              <select
                id="sf-packaging"
                name="packagingMode"
                required
                value={packagingMode}
                onChange={(e) =>
                  setPackagingMode(e.target.value as SpecialFeaturePackagingMode)
                }
                className={fieldSelectClassName}
              >
                <option value="in_app">In-app packaging</option>
                <option value="outside">Outside packaging</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-starts">Starts</Label>
              <Input
                id="sf-starts"
                name="startsAt"
                type="datetime-local"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-ends">Ends</Label>
              <Input id="sf-ends" name="endsAt" type="datetime-local" required />
              <p className="text-xs text-muted-foreground">
                Suitcases must be sent before this end time.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sf-price">
                Transportation fee (USD)
                {packagingMode === "outside" ? " — optional" : ""}
              </Label>
              <Input
                id="sf-price"
                name="priceUsd"
                inputMode="decimal"
                required={packagingMode === "in_app"}
                placeholder={packagingMode === "in_app" ? "49.99" : "0.00"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-travel">Travel day (courier flight)</Label>
              <Input
                id="sf-travel"
                type="datetime-local"
                required
                value={travelAt}
                onChange={(e) => {
                  const next = e.target.value;
                  setTravelAt(next);
                  if (airlineName) runBagFeeLookup(airlineName, next);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Day the courier traveler flies — must be after the special end date.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sf-airline">Airline</Label>
              <select
                id="sf-airline"
                required
                value={airlineName}
                onChange={(e) => {
                  const next = e.target.value;
                  setAirlineName(next);
                  if (next && travelAt) runBagFeeLookup(next, travelAt);
                }}
                className={fieldSelectClassName}
              >
                <AirlineOptions />
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">
                Airline bag fees (travel day)
              </p>
              <OutsideBagFeeSummary
                secondUsd={secondBagUsd}
                thirdUsd={thirdBagUsd}
                pending={lookupPending}
              />
              <div className="space-y-2 pt-2">
                <Label htmlFor="sf-bag-extra">Extra note (airline bag policy)</Label>
                <textarea
                  id="sf-bag-extra"
                  value={airlineBagFeeExtraNote}
                  onChange={(e) => setAirlineBagFeeExtraNote(e.target.value)}
                  className={notesTextareaClassName}
                  rows={3}
                  placeholder="Filled automatically when you select an airline and travel day."
                />
                <p className="text-xs text-muted-foreground">
                  AI lookup for 2nd and 3rd checked-bag fees on the travel day. Shown to
                  shoppers with the bag fees. You may edit before saving.
                </p>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="sf-notes">Notes</Label>
              <textarea
                id="sf-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={notesTextareaClassName}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Auto-filled for shoppers. Leave as-is to keep the default note on the
                banner; edit to overwrite.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <p className="text-xs text-muted-foreground">
                Saves as a draft. Use Publish on the catalog card to show the special
                banner to users.
              </p>
              <Button type="submit" disabled={pending} className="w-fit">
                {pending ? "Saving…" : "Create draft"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Catalog</h3>
        {offers.length === 0 ?
          <p className="text-sm text-muted-foreground">No special features yet.</p>
        : (
          <ul className="space-y-6">
            {offers.map((offer) => (
              <li key={offer.id}>
                <AdminSpecialFeatureRow
                  offer={offer}
                  disabledAll={pending}
                  onRefresh={() => safeRefresh(router)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AdminSpecialFeatureRow({
  offer,
  disabledAll,
  onRefresh,
}: {
  offer: AdminSerializableSpecialFeature;
  disabledAll: boolean;
  onRefresh: () => void;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [lookupPending, setLookupPending] = useState(false);
  const disabled = disabledAll || pending;
  const status = getSpecialFeatureWindowStatus(
    offer.startsAt,
    offer.endsAt,
    offer.isActive,
  );
  const isDraft = status === "Draft";
  const formDisabled = disabled;

  const [name, setName] = useState(offer.name);
  const [packagingMode, setPackagingMode] = useState(offer.packagingMode);
  const [startsAt, setStartsAt] = useState(isoToDatetimeLocalValue(offer.startsAt));
  const [endsAt, setEndsAt] = useState(isoToDatetimeLocalValue(offer.endsAt));
  const [travelAt, setTravelAt] = useState(
    offer.travelAt ? isoToDatetimeLocalValue(offer.travelAt) : "",
  );
  const [priceUsd, setPriceUsd] = useState(centsToUsdInput(offer.priceUsdCents) || "0.00");
  const [airlineName, setAirlineName] = useState(offer.airlineName);
  const [secondBagUsd, setSecondBagUsd] = useState(
    centsToUsdInput(offer.airlineSecondBagUsdCents),
  );
  const [thirdBagUsd, setThirdBagUsd] = useState(
    centsToUsdInput(offer.airlineThirdBagUsdCents),
  );
  const [fourthBagUsd, setFourthBagUsd] = useState(
    centsToUsdInput(offer.airlineFourthBagUsdCents),
  );
  const [airlineBagFeeExtraNote, setAirlineBagFeeExtraNote] = useState(
    offer.airlineBagFeeExtraNote,
  );
  const [notes, setNotes] = useState(resolveSpecialFeatureNotes(offer.notes));

  useEffect(() => {
    setName(offer.name);
    setPackagingMode(offer.packagingMode);
    setStartsAt(isoToDatetimeLocalValue(offer.startsAt));
    setEndsAt(isoToDatetimeLocalValue(offer.endsAt));
    setTravelAt(offer.travelAt ? isoToDatetimeLocalValue(offer.travelAt) : "");
    setPriceUsd(centsToUsdInput(offer.priceUsdCents) || "0.00");
    setAirlineName(offer.airlineName);
    setSecondBagUsd(centsToUsdInput(offer.airlineSecondBagUsdCents));
    setThirdBagUsd(centsToUsdInput(offer.airlineThirdBagUsdCents));
    setFourthBagUsd(centsToUsdInput(offer.airlineFourthBagUsdCents));
    setAirlineBagFeeExtraNote(offer.airlineBagFeeExtraNote);
    setNotes(resolveSpecialFeatureNotes(offer.notes));
  }, [
    offer.id,
    offer.isActive,
    offer.name,
    offer.packagingMode,
    offer.startsAt,
    offer.endsAt,
    offer.travelAt,
    offer.priceUsdCents,
    offer.airlineName,
    offer.airlineSecondBagUsdCents,
    offer.airlineThirdBagUsdCents,
    offer.airlineFourthBagUsdCents,
    offer.airlineBagFeeExtraNote,
    offer.notes,
  ]);

  function runBagFeeLookup(nextAirline: string, nextTravelAt: string) {
    if (!nextAirline.trim()) return;
    if (!nextTravelAt.trim()) {
      toast.message(
        "Set the courier travel day to load 2nd and 3rd checked-bag fees for that flight.",
      );
      return;
    }
    setLookupPending(true);
    startTransition(async () => {
      try {
        const fees = await lookupOutsideBagFees({
          airlineName: nextAirline,
          travelAt: nextTravelAt,
        });
        if (!fees) return;
        setSecondBagUsd(fees.secondUsd);
        setThirdBagUsd(fees.thirdUsd);
        setFourthBagUsd("");
        if (fees.extraNote) setAirlineBagFeeExtraNote(fees.extraNote);
      } finally {
        setLookupPending(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{name}</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-border/80 bg-muted px-2.5 py-0.5 text-xs font-medium">
              Suitcase
            </span>
            <span className="rounded-full border border-border/80 bg-muted px-2.5 py-0.5 text-xs font-medium">
              {specialFeaturePackagingModeLabel(packagingMode)}
            </span>
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                status === "Live" ?
                  "border-primary/40 bg-primary/15 text-primary"
                : status === "Draft" ?
                  "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "border-border/80 bg-muted text-muted-foreground",
              )}
            >
              {status}
            </span>
          </div>
        </div>
        <CardDescription className="font-mono text-xs">{offer.id}</CardDescription>
        {isDraft ?
          <p className="text-xs text-muted-foreground">
            Draft — edit fields below, then Save changes. Publish when ready for shoppers.
          </p>
        : status === "Scheduled" ?
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Banner is hidden until the start time. Use Go live now to show it
            immediately.
          </p>
        : null}
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await invokeAdminSpecialFeatureAction(() =>
                adminUpdateSpecialFeatureOfferAction({
                  id: offer.id,
                  name,
                  packagingMode,
                  priceUsd,
                  airlineName,
                  travelAt: datetimeLocalValueToIso(travelAt),
                  airlineSecondBagUsd: secondBagUsd,
                  airlineThirdBagUsd: thirdBagUsd,
                  airlineFourthBagUsd: fourthBagUsd,
                  airlineBagFeeExtraNote,
                  notes,
                  startsAt: datetimeLocalValueToIso(startsAt),
                  endsAt: datetimeLocalValueToIso(endsAt),
                  isActive: offer.isActive,
                }),
              );
              if (!res?.ok) {
                if (res) toast.error(res.message);
                return;
              }
              toast.success("Special feature updated.");
              onRefresh();
            });
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`sf-name-${offer.id}`}>Name</Label>
            <Input
              id={`sf-name-${offer.id}`}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={formDisabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`sf-packaging-${offer.id}`}>Packaging</Label>
            <select
              id={`sf-packaging-${offer.id}`}
              required
              value={packagingMode}
              onChange={(e) =>
                setPackagingMode(e.target.value as SpecialFeaturePackagingMode)
              }
              disabled={formDisabled}
              className={fieldSelectClassName}
            >
              <option value="in_app">In-app packaging</option>
              <option value="outside">Outside packaging</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sf-starts-${offer.id}`}>Starts</Label>
            <Input
              id={`sf-starts-${offer.id}`}
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              disabled={formDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sf-ends-${offer.id}`}>Ends</Label>
            <Input
              id={`sf-ends-${offer.id}`}
              type="datetime-local"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              disabled={formDisabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`sf-price-${offer.id}`}>Transportation fee (USD)</Label>
            <Input
              id={`sf-price-${offer.id}`}
              inputMode="decimal"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              disabled={formDisabled}
            />
            <p className="text-xs text-muted-foreground">
              Listed: {formatUsd(offer.priceUsdCents)}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sf-travel-${offer.id}`}>Travel day (courier flight)</Label>
            <Input
              id={`sf-travel-${offer.id}`}
              type="datetime-local"
              required
              value={travelAt}
              onChange={(e) => {
                const next = e.target.value;
                setTravelAt(next);
                if (airlineName) runBagFeeLookup(airlineName, next);
              }}
              disabled={formDisabled}
            />
            <p className="text-xs text-muted-foreground">
              Must be after the special end date.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sf-airline-${offer.id}`}>Airline</Label>
            <select
              id={`sf-airline-${offer.id}`}
              required
              value={airlineName}
              onChange={(e) => {
                const next = e.target.value;
                setAirlineName(next);
                if (next && travelAt) runBagFeeLookup(next, travelAt);
              }}
              disabled={formDisabled}
              className={fieldSelectClassName}
            >
              <AirlineOptions extra={offer.airlineName} />
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5">
            <p className="text-sm font-medium text-foreground">
              Airline bag fees (travel day)
            </p>
            <OutsideBagFeeSummary
              secondUsd={secondBagUsd}
              thirdUsd={thirdBagUsd}
              pending={lookupPending}
            />
            <div className="space-y-2 pt-2">
              <Label htmlFor={`sf-bag-extra-${offer.id}`}>
                Extra note (airline bag policy)
              </Label>
              <textarea
                id={`sf-bag-extra-${offer.id}`}
                value={airlineBagFeeExtraNote}
                onChange={(e) => setAirlineBagFeeExtraNote(e.target.value)}
                disabled={formDisabled}
                className={notesTextareaClassName}
                rows={3}
                placeholder="Filled automatically when you select an airline and travel day."
              />
              <p className="text-xs text-muted-foreground">
                Returned by the AI bag-fee server action. Shown to shoppers with the bag
                fees. You may edit before saving.
              </p>
            </div>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`sf-notes-${offer.id}`}>Notes</Label>
            <textarea
              id={`sf-notes-${offer.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={formDisabled}
              className={notesTextareaClassName}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {offer.notes.trim() ?
                "Custom note saved — shown on the banner."
              : "Using auto note on the banner until you overwrite and save."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={disabled}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
            {!offer.isActive || status === "Scheduled" ?
              <Button
                type="button"
                disabled={disabled}
                onClick={() => {
                  startTransition(async () => {
                    const res = await invokeAdminSpecialFeatureAction(() =>
                      adminPublishSpecialFeatureOfferAction({
                        id: offer.id,
                      }),
                    );
                    if (!res?.ok) {
                      if (res) toast.error(res.message);
                      return;
                    }
                    toast.success(
                      status === "Scheduled" ?
                        "Live now — shoppers can see this special on the banner."
                      : "Published — shoppers can see this special on the banner.",
                    );
                    onRefresh();
                  });
                }}
              >
                {pending ?
                  "Publishing…"
                : status === "Scheduled" ?
                  "Go live now"
                : "Publish"}
              </Button>
            : null}
            {offer.isActive ?
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  startTransition(async () => {
                    const res = await invokeAdminSpecialFeatureAction(() =>
                      adminUnpublishSpecialFeatureOfferAction({
                        id: offer.id,
                      }),
                    );
                    if (!res?.ok) {
                      if (res) toast.error(res.message);
                      return;
                    }
                    toast.success("Unpublished — banner hidden from shoppers.");
                    onRefresh();
                  });
                }}
              >
                {pending ? "Updating…" : "Unpublish"}
              </Button>
            : null}
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setRemoveOpen(true)}
            >
              Delete
            </Button>
          </div>
        </form>
      </CardContent>
      <AdminConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Delete special feature?"
        description="This removes the timed offer and its suitcase catalog SKU (if any)."
        confirmLabel="Delete"
        pending={pending}
        destructive
        onConfirm={() => {
          startTransition(async () => {
            const res = await invokeAdminSpecialFeatureAction(() =>
              adminDeleteSpecialFeatureOfferAction({ id: offer.id }),
            );
            if (!res?.ok) {
              if (res) toast.error(res.message);
              return;
            }
            toast.success("Special feature deleted.");
            setRemoveOpen(false);
            onRefresh();
          });
        }}
      />
    </Card>
  );
}
