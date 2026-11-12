"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  buildBudgetBarrelAction,
  submitBudgetBarrelAction,
} from "@/actions/budget-barrel";
import { CategoryAttributePanels, type AttributeDraft } from "@/components/dashboard/budget-barrel-attribute-panels";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatUsd } from "@/lib/admin-markup";
import {
  BUDGET_BARREL_CATEGORIES,
  BUDGET_BARREL_CATEGORY_LABELS,
  BUDGET_BARREL_LIST_SIZE,
  BUDGET_BARREL_RETAILERS,
  ESTIMATED_PRICES_LABEL,
  MERCHANDISE_ONLY_LABEL,
  TO_BE_CONFIRMED_LABEL,
  type BudgetBarrelCategory,
  type BudgetBarrelRetailerKey,
} from "@/lib/budget-barrel/constants";
import { centsToDollarInput, dollarsInputToCents, productPriceInputToCents } from "@/lib/budget-barrel/money";
import { offerCanFillRequirement, priceSelection } from "@/lib/budget-barrel/select-list";
import type {
  BudgetBarrelClientView,
  BudgetBarrelLineSelection,
  BudgetBarrelListPlan,
  BudgetBarrelOffer,
  PricedBudgetLine,
} from "@/lib/budget-barrel/types";
import {
  DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE,
  DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE,
} from "@/lib/dashboard-items-routes";
import { dashboardBatchQuotesActiveCreatedHref } from "@/lib/dashboard-add-item-routes";
import { cn } from "@/lib/utils";
import Link from "next/link";

type ListKind = "one_store" | "multi_store";

export type BudgetBarrelPickedProduct = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  productSize: string;
  productColor: string;
  retailerUrl: string;
  imageUrl: string;
};

const EMPTY_ATTRIBUTE: AttributeDraft = { size: "", color: "", packSize: "", brand: "" };
const LIST_PAGE_SIZE = 4;

type ProductEditorDraft = {
  offerId: string;
  productName: string;
  size: string;
  color: string;
  price: string;
  quantity: string;
  productUrl: string;
  retailer: string;
};

function toggleValue<T extends string>(current: T[], value: T): T[] {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

function ChoiceButton({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50",
      )}
    >
      {label}
    </button>
  );
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function listTitle(plan: BudgetBarrelListPlan, offers: BudgetBarrelOffer[]): string {
  const names = plan.retailerKeys.map(
    (key) => offers.find((offer) => offer.retailerKey === key)?.retailer ?? key,
  );
  const prefix = plan.kind === "one_store" ? "One-store list" : "Multi-store list";
  return names.length > 0 ? `${prefix} · ${names.join(" and ")}` : prefix;
}

export function BudgetBarrelWorkspace({
  onPickHeld,
}: {
  /** When set, held products are returned here instead of being submitted as a shopper quote. */
  onPickHeld?: (products: BudgetBarrelPickedProduct[]) => void;
} = {}) {
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [budgetDollars, setBudgetDollars] = useState("100");
  const [categories, setCategories] = useState<BudgetBarrelCategory[]>(["food", "clothing"]);
  const [retailers, setRetailers] = useState<BudgetBarrelRetailerKey[]>(["walmart", "target"]);
  const [attributes, setAttributes] = useState<Partial<Record<BudgetBarrelCategory, AttributeDraft>>>({});
  const [held, setHeld] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState("1");
  const [mustHaves, setMustHaves] = useState("");
  const [instructions, setInstructions] = useState("");
  const [view, setView] = useState<BudgetBarrelClientView | null>(null);
  const [emptyNotes, setEmptyNotes] = useState<string[]>([]);
  const [activeKind, setActiveKind] = useState<ListKind>("one_store");
  const [listPage, setListPage] = useState(1);
  const [oneLines, setOneLines] = useState<BudgetBarrelLineSelection[]>([]);
  const [multiLines, setMultiLines] = useState<BudgetBarrelLineSelection[]>([]);
  const [editor, setEditor] = useState<ProductEditorDraft | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const budgetCents = dollarsInputToCents(budgetDollars);
  const activeLines = activeKind === "multi_store" ? multiLines : oneLines;
  const setActiveLines = activeKind === "multi_store" ? setMultiLines : setOneLines;
  const activePlan = activeKind === "multi_store" ? view?.multiStore : view?.oneStore;

  const priced = useMemo(() => {
    if (!view || budgetCents == null) return null;
    return priceSelection(view.offers, activeLines, budgetCents);
  }, [view, activeLines, budgetCents]);
  const listPageCount = Math.max(1, Math.ceil((priced?.lines.length ?? 0) / LIST_PAGE_SIZE));
  const visiblePage = Math.min(listPage, listPageCount);
  const visibleLines =
    priced?.lines.slice((visiblePage - 1) * LIST_PAGE_SIZE, visiblePage * LIST_PAGE_SIZE) ?? [];

  function attributeDraft(category: BudgetBarrelCategory): AttributeDraft {
    return attributes[category] ?? EMPTY_ATTRIBUTE;
  }

  function applyView(next: BudgetBarrelClientView) {
    setView(next);
    setHeld((current) => {
      const kept: Record<string, number> = {};
      for (const [offerId, heldQuantity] of Object.entries(current)) {
        if (next.offers.some((offer) => offer.id === offerId)) kept[offerId] = heldQuantity;
      }
      return kept;
    });
    setEmptyNotes([]);
    setListPage(1);
    setOneLines(next.oneStore?.lines ?? []);
    setMultiLines(next.multiStore?.lines ?? []);
    setConfirmSubmit(false);
    setActiveKind(
      next.multiStore && retailers.length > 1
        ? "multi_store"
        : next.oneStore
          ? "one_store"
          : "multi_store",
    );
    idempotencyKey.current = null;
  }

  function build() {
    const qty = Number(quantity);
    const clothing = attributeDraft("clothing");
    const food = attributeDraft("food");
    const heldLines = view
      ? Object.entries(held)
          .filter(([offerId]) => view.offers.some((offer) => offer.id === offerId))
          .map(([offerId, heldQuantity]) => ({ offerId, quantity: heldQuantity }))
      : [];
    startTransition(async () => {
      const result = await buildBudgetBarrelAction({
        budgetDollars,
        categories,
        retailers,
        preferences: {
          clothingSize: clothing.size,
          color: clothing.color,
          packSize: food.packSize || clothing.packSize,
          preferredBrands: clothing.brand || food.brand,
          quantity: Number.isInteger(qty) && qty >= 1 ? Math.min(20, qty) : 1,
          mustHaveItems: mustHaves,
          attributes: Object.fromEntries(
            categories.map((category) => {
              const row = attributeDraft(category);
              return [
                category,
                {
                  size: row.size || undefined,
                  color: row.color || undefined,
                  packSize: row.packSize || undefined,
                  brand: row.brand || undefined,
                },
              ];
            }),
          ),
        },
        instructions,
        previousDraftId: heldLines.length > 0 ? view?.draftId : undefined,
        heldLines,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (!result.view) {
        setView(null);
        setEmptyNotes(result.providerNotes);
        toast.message("No priced offers matched that search.");
        return;
      }
      applyView(result.view);
    });
  }

  function submit() {
    if (!view || budgetCents == null || !priced) return;
    const linesToSend = priced.lines.filter(
      (line) => held[line.offer.id] != null && line.offer.priceCents != null,
    );
    if (linesToSend.length === 0) return;
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    const key = idempotencyKey.current;
    startTransition(async () => {
      const result = await submitBudgetBarrelAction({
        draftId: view.draftId,
        idempotencyKey: key,
        budgetDollars,
        listKind: activeKind,
        lines: linesToSend.map((line) => ({
          offerId: line.offer.id,
          quantity: line.quantity,
          productName: line.offer.productName,
          size: line.offer.size ?? "",
          color: line.offer.color ?? "",
          priceCents: line.offer.priceCents ?? 0,
        })),
      });
      if (!result.ok) {
        if (result.offers && result.priceCheckedAt) {
          setView((current) =>
            current
              ? { ...current, offers: result.offers ?? current.offers, priceCheckedAt: result.priceCheckedAt ?? current.priceCheckedAt }
              : current,
          );
        }
        setConfirmSubmit(false);
        toast.error(result.message);
        return;
      }
      setConfirmSubmit(false);
      toast.success(result.message);
      router.push(dashboardBatchQuotesActiveCreatedHref(result.batchSessionId));
    });
  }

  function openEditor(line: PricedBudgetLine) {
    setEditorError(null);
    setEditor({
      offerId: line.offer.id,
      productName: line.offer.productName,
      size: line.offer.size ?? "",
      color: line.offer.color ?? "",
      price: centsToDollarInput(line.offer.priceCents),
      quantity: String(line.quantity),
      productUrl: line.offer.productUrl,
      retailer: line.offer.retailer,
    });
  }

  function saveEditor() {
    if (!editor) return;
    const productName = editor.productName.trim();
    const priceCents = productPriceInputToCents(editor.price);
    const quantity = Number(editor.quantity);
    if (!productName) {
      setEditorError("Enter a product name.");
      return;
    }
    if (priceCents == null) {
      setEditorError("Enter a USD price, such as 4.75.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      setEditorError("Enter a quantity from 1 to 20.");
      return;
    }
    const offerId = editor.offerId;
    setView((current) =>
      current
        ? {
            ...current,
            offers: current.offers.map((offer) =>
              offer.id === offerId
                ? {
                    ...offer,
                    productName,
                    size: editor.size.trim() || null,
                    color: editor.color.trim() || null,
                    priceCents,
                    currency: "USD",
                  }
                : offer,
            ),
          }
        : current,
    );
    setActiveLines((current) =>
      current.map((row) => (row.offerId === offerId ? { ...row, quantity } : row)),
    );
    setHeld((current) => (current[offerId] == null ? current : { ...current, [offerId]: quantity }));
    setEditor(null);
  }

  const overBudget = (priced?.overBudgetCents ?? 0) > 0;
  const heldEstimateLines = priced?.lines.filter((line) => held[line.offer.id] != null) ?? [];
  const heldMerchandiseCents = heldEstimateLines.reduce(
    (sum, line) => sum + (line.lineTotalCents ?? 0),
    0,
  );
  const heldMissingPrice = heldEstimateLines.some((line) => line.lineTotalCents == null);
  const heldOverBudget = budgetCents != null && heldMerchandiseCents > budgetCents;
  const canSubmitHeld =
    !pending &&
    budgetCents != null &&
    heldEstimateLines.length > 0 &&
    !heldMissingPrice &&
    !heldOverBudget;

  return (
    <div className="space-y-8">
      <form
        className="space-y-6 rounded-xl border border-border/80 bg-card p-5 shadow-sm ring-1 ring-foreground/5"
        onSubmit={(event) => {
          event.preventDefault();
          build();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget-dollars">Merchandise budget (USD)</Label>
            <Input
              id="budget-dollars"
              inputMode="decimal"
              value={budgetDollars}
              onChange={(event) => setBudgetDollars(event.target.value)}
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">{MERCHANDISE_ONLY_LABEL}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default-quantity">Quantity</Label>
            <Input
              id="default-quantity"
              type="number"
              min={1}
              max={20}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={pending}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Categories</p>
          <div className="flex flex-wrap gap-2">
            {BUDGET_BARREL_CATEGORIES.map((category) => (
              <ChoiceButton
                key={category}
                label={BUDGET_BARREL_CATEGORY_LABELS[category]}
                pressed={categories.includes(category)}
                onClick={() => setCategories((current) => toggleValue(current, category))}
              />
            ))}
          </div>
        </div>

        <CategoryAttributePanels
          categories={categories}
          values={attributes}
          disabled={pending}
          onChange={(category, key, value) =>
            setAttributes((current) => ({
              ...current,
              [category]: { ...EMPTY_ATTRIBUTE, ...current[category], [key]: value },
            }))
          }
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Retailers</p>
          <div className="flex flex-wrap gap-2">
            {BUDGET_BARREL_RETAILERS.map((retailer) => (
              <ChoiceButton
                key={retailer.key}
                label={retailer.label}
                pressed={retailers.includes(retailer.key)}
                onClick={() =>
                  setRetailers((current) => toggleValue(current, retailer.key))
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="must-haves">Must-have items</Label>
          <textarea
            id="must-haves"
            rows={3}
            value={mustHaves}
            disabled={pending}
            onChange={(event) => setMustHaves(event.target.value)}
            placeholder="One item per line"
            className={cn(inputFieldClassName, "min-h-20 py-2 text-sm")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instructions">Shopping instructions</Label>
          <textarea
            id="instructions"
            rows={3}
            value={instructions}
            disabled={pending}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="I have $100. I want pantry staples and men's size-large shirts. Prioritize food."
            className={cn(inputFieldClassName, "min-h-20 py-2 text-sm")}
          />
        </div>

        <Button type="submit" disabled={pending || budgetCents == null || categories.length === 0 || retailers.length === 0}>
          {pending && !view ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Build my list
        </Button>
      </form>

      {!view && emptyNotes.length > 0 ? <EmptySearch notes={emptyNotes} /> : null}

      {view && priced ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{ESTIMATED_PRICES_LABEL}</p>
              <p className="text-xs text-muted-foreground">
                Prices checked{" "}
                {new Date(view.priceCheckedAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {view.oneStore ? (
                <ChoiceButton
                  label="One-store list"
                  pressed={activeKind === "one_store"}
                  onClick={() => {
                    setActiveKind("one_store");
                    setListPage(1);
                  }}
                />
              ) : null}
              {view.multiStore ? (
                <ChoiceButton
                  label="Multi-store list"
                  pressed={activeKind === "multi_store"}
                  onClick={() => {
                    setActiveKind("multi_store");
                    setListPage(1);
                  }}
                />
              ) : null}
            </div>
          </div>

          {view.providerNotes.map((note) => (
            <p key={note} className="text-sm text-muted-foreground">
              {note}
            </p>
          ))}

          {(activePlan?.unsatisfied ?? view.unsatisfied).map((item) => (
            <p key={item} className="text-sm text-amber-200">
              {item}
            </p>
          ))}

          {(activePlan?.unsatisfied.length ?? view.unsatisfied.length) > 0 ? (
            <p className="text-sm text-muted-foreground">
              {(activePlan?.unsatisfied ?? view.unsatisfied).some((item) =>
                item.includes("merchandise budget"),
              )
                ? "This is a partial list. Some requested items were not found within the merchandise budget."
                : "This is a partial list. Some requested items were not found at the selected retailers."}
            </p>
          ) : null}

          {priced.deliveryIncomplete ? (
            <p className="text-sm text-muted-foreground">
              Delivery costs are incomplete, so the one-store and multi-store comparison is based on merchandise only.
            </p>
          ) : null}

          {activePlan ? (
            <p className="text-sm font-medium text-foreground">{listTitle(activePlan, view.offers)}</p>
          ) : (
            <EmptySearch notes={view.providerNotes.length > 0 ? view.providerNotes : view.unsatisfied} />
          )}

          <ul className="space-y-3">
            {visibleLines.map((line) => (
              <li
                key={line.offer.id}
                className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 sm:grid-cols-[4.5rem_minmax(0,1fr)]"
              >
                <button
                  type="button"
                  className="size-16 overflow-hidden rounded-md border border-border"
                  aria-label={`Edit ${line.offer.productName}`}
                  onClick={() => openEditor(line)}
                >
                  {line.offer.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.offer.imageUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="block size-full border border-dashed border-border bg-muted" />
                  )}
                </button>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        className="text-left font-medium text-foreground underline-offset-2 hover:underline"
                        onClick={() => openEditor(line)}
                      >
                        {line.offer.productName}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {line.offer.retailer}
                        {line.offer.sellerName ? ` · Sold by ${line.offer.sellerName}` : ""}
                        {line.offer.size ? ` · ${line.offer.size}` : ""}
                        {line.offer.color ? ` · ${line.offer.color}` : ""}
                        {line.offer.packSize ? ` · ${line.offer.packSize}` : ""}
                      </p>
                      {line.offer.needsStaffReview && line.offer.reviewReason ? (
                        <p className="text-xs text-amber-200">{line.offer.reviewReason}</p>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium tabular-nums text-foreground">
                      {line.lineTotalCents == null ? "Price unavailable" : formatUsd(line.lineTotalCents)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={`qty-${line.offer.id}`} className="sr-only">
                      Quantity for {line.offer.productName}
                    </Label>
                    <Input
                      id={`qty-${line.offer.id}`}
                      type="number"
                      min={1}
                      max={20}
                      className="w-20"
                      value={line.quantity}
                      disabled={pending}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isInteger(next) || next < 1) return;
                        const quantity = Math.min(20, next);
                        setActiveLines((current) =>
                          current.map((row) =>
                            row.offerId === line.offer.id ? { ...row, quantity } : row,
                          ),
                        );
                        setHeld((current) =>
                          current[line.offer.id] == null ? current : { ...current, [line.offer.id]: quantity },
                        );
                      }}
                    />
                    <Label htmlFor={`swap-${line.offer.id}`} className="sr-only">
                      Swap {line.offer.productName}
                    </Label>
                    <select
                      id={`swap-${line.offer.id}`}
                      className={cn(inputFieldClassName, "h-8 max-w-full py-1 text-sm sm:max-w-sm")}
                      value={line.offer.id}
                      disabled={pending}
                      onChange={(event) => {
                        const offerId = event.target.value;
                        setActiveLines((current) =>
                          current.map((row) =>
                            row.offerId === line.offer.id ? { ...row, offerId } : row,
                          ),
                        );
                      }}
                    >
                      <option value={line.offer.id}>Keep this offer</option>
                      {view.offers
                        .filter(
                          (offer) =>
                            offer.id !== line.offer.id &&
                            offer.category === line.offer.category &&
                            offerCanFillRequirement(offer) &&
                            !activeLines.some((row) => row.offerId === offer.id),
                        )
                        .slice(0, 20)
                        .map((offer) => (
                          <option key={offer.id} value={offer.id}>
                            {offer.retailer} · {offer.productName}
                            {offer.priceCents != null ? ` · ${formatUsd(offer.priceCents)}` : ""}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant={held[line.offer.id] == null ? "outline" : "default"}
                      size="sm"
                      aria-pressed={held[line.offer.id] != null}
                      disabled={pending}
                      onClick={() =>
                        setHeld((current) => {
                          if (current[line.offer.id] != null) {
                            const next = { ...current };
                            delete next[line.offer.id];
                            return next;
                          }
                          if (Object.keys(current).length >= BUDGET_BARREL_LIST_SIZE) return current;
                          return { ...current, [line.offer.id]: line.quantity };
                        })
                      }
                    >
                      {held[line.offer.id] == null ? "Hold" : "Held"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setActiveLines((current) => current.filter((row) => row.offerId !== line.offer.id));
                        setHeld((current) => {
                          if (current[line.offer.id] == null) return current;
                          const next = { ...current };
                          delete next[line.offer.id];
                          return next;
                        });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <ListPagination
            currentPage={visiblePage}
            totalPages={listPageCount}
            pageStart={priced.lines.length === 0 ? 0 : (visiblePage - 1) * LIST_PAGE_SIZE + 1}
            pageEnd={Math.min(priced.lines.length, visiblePage * LIST_PAGE_SIZE)}
            totalResults={priced.lines.length}
            onPageChange={setListPage}
          />

          <div className="space-y-2 rounded-xl border border-border/80 bg-card p-4">
            <CostRow label="Merchandise subtotal" value={formatUsd(priced.merchandiseSubtotalCents)} />
            <CostRow
              label="Remaining merchandise budget"
              value={formatUsd(priced.remainingCents)}
            />
            {overBudget ? (
              <p className="text-sm font-medium text-destructive">
                This list is {formatUsd(priced.overBudgetCents)} over the merchandise budget. Remove
                items, lower quantities, or increase the budget before submitting.
              </p>
            ) : null}
            <CostRow
              label="Retailer delivery to the U.S. hub"
              value={priced.deliveryCents == null ? TO_BE_CONFIRMED_LABEL : formatUsd(priced.deliveryCents)}
            />
            <CostRow label="Applicable taxes" value={TO_BE_CONFIRMED_LABEL} />
            <CostRow label="Cart2Barrel fees" value={TO_BE_CONFIRMED_LABEL} />
            <CostRow label="Container cost" value={TO_BE_CONFIRMED_LABEL} />
            <CostRow label="Freight" value={TO_BE_CONFIRMED_LABEL} />
          </div>

          {heldEstimateLines.length > 0 ? (
            onPickHeld ? (
              <Button
                type="button"
                disabled={pending || heldMissingPrice}
                onClick={() => onPickHeld(pickedProducts(heldEstimateLines))}
              >
                Add products
              </Button>
            ) : (
              <Button type="button" disabled={!canSubmitHeld} onClick={() => setConfirmSubmit(true)}>
                Submit for an Estimate
              </Button>
            )
          ) : null}
          {heldEstimateLines.length > 0 && heldMissingPrice ? (
            <p className="text-sm text-muted-foreground">
              {onPickHeld
                ? "A held product needs a USD price before it can be added."
                : "A held product needs a USD price before it can be sent for an estimate."}
            </p>
          ) : null}
          {!onPickHeld && heldEstimateLines.length > 0 && heldOverBudget && budgetCents != null ? (
            <p className="text-sm font-medium text-destructive">
              The held products are {formatUsd(heldMerchandiseCents - budgetCents)} over the merchandise
              budget. Remove a held product, lower a quantity, or increase the budget.
            </p>
          ) : null}

          <ProductDetailsDialog
            editor={editor}
            error={editorError}
            onChange={(next) => {
              setEditorError(null);
              setEditor(next);
            }}
            onOpenChange={(open) => {
              if (!open) {
                setEditor(null);
                setEditorError(null);
              }
            }}
            onSave={saveEditor}
          />
          <SubmitReviewDialog
            open={confirmSubmit}
            lines={heldEstimateLines}
            merchandiseSubtotalCents={heldMerchandiseCents}
            pending={pending}
            onOpenChange={(open) => {
              if (!pending) setConfirmSubmit(open);
            }}
            onConfirm={submit}
          />
        </section>
      ) : null}
    </div>
  );
}

function pickedProducts(lines: PricedBudgetLine[]): BudgetBarrelPickedProduct[] {
  return lines.flatMap((line) => {
    if (line.offer.priceCents == null || line.offer.priceCents < 1) return [];
    return [
      {
        productName: line.offer.productName,
        quantity: line.quantity,
        unitPriceCents: line.offer.priceCents,
        productSize: line.offer.size ?? line.offer.packSize ?? "",
        productColor: line.offer.color ?? "",
        retailerUrl: line.offer.productUrl,
        imageUrl: line.offer.imageUrl ?? "",
      },
    ];
  });
}

function SubmitReviewDialog({
  open,
  lines,
  merchandiseSubtotalCents,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  lines: PricedBudgetLine[];
  merchandiseSubtotalCents: number;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review this quote request</DialogTitle>
          <DialogDescription>
            {lines.length === 1
              ? "This held product will be sent to staff."
              : `These ${lines.length} held products will be sent to staff.`}{" "}
            Delivery, taxes, and fees stay to be confirmed.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {lines.map((line) => (
            <li key={line.offer.id} className="flex items-start gap-3 text-sm">
              {line.offer.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.offer.imageUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-md border border-border object-cover"
                />
              ) : (
                <div className="size-12 shrink-0 rounded-md border border-dashed border-border bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{line.offer.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {line.offer.retailer}
                  {line.offer.size ? ` · ${line.offer.size}` : ""}
                  {line.offer.color ? ` · ${line.offer.color}` : ""}
                  {` · Qty ${line.quantity}`}
                </p>
              </div>
              <p className="shrink-0 font-medium tabular-nums text-foreground">
                {line.lineTotalCents == null ? "Price unavailable" : formatUsd(line.lineTotalCents)}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">Merchandise total</span>
          <span className="font-medium tabular-nums text-foreground">
            {formatUsd(merchandiseSubtotalCents)}
          </span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button type="button" disabled={pending || lines.length === 0} onClick={onConfirm}>
            {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            Send to staff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDetailsDialog({
  editor,
  error,
  onChange,
  onOpenChange,
  onSave,
}: {
  editor: ProductEditorDraft | null;
  error: string | null;
  onChange: (next: ProductEditorDraft) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}) {
  const retailerUrl = editor && /^https:\/\//i.test(editor.productUrl) ? editor.productUrl : null;

  return (
    <Dialog open={editor != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Product details</DialogTitle>
          <DialogDescription>
            Edit the name, size, color, price, or quantity. Open the retailer page to check the listing.
          </DialogDescription>
        </DialogHeader>
        {editor ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="product-detail-name">Product name</Label>
              <Input
                id="product-detail-name"
                value={editor.productName}
                onChange={(event) => onChange({ ...editor, productName: event.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-detail-size">Size</Label>
                <Input
                  id="product-detail-size"
                  value={editor.size}
                  onChange={(event) => onChange({ ...editor, size: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-detail-color">Color</Label>
                <Input
                  id="product-detail-color"
                  value={editor.color}
                  onChange={(event) => onChange({ ...editor, color: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-detail-price">Price (USD)</Label>
                <Input
                  id="product-detail-price"
                  inputMode="decimal"
                  value={editor.price}
                  onChange={(event) => onChange({ ...editor, price: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-detail-quantity">Quantity</Label>
                <Input
                  id="product-detail-quantity"
                  type="number"
                  min={1}
                  max={20}
                  value={editor.quantity}
                  onChange={(event) => onChange({ ...editor, quantity: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-detail-url">Product URL</Label>
              <Input id="product-detail-url" readOnly value={editor.productUrl} />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <DialogFooter className="sm:justify-between">
              {retailerUrl ? (
                <a
                  href={retailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline" })}
                >
                  <ExternalLinkIcon />
                  View on {editor.retailer}
                </a>
              ) : (
                <span />
              )}
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ListPagination({
  currentPage,
  totalPages,
  pageStart,
  pageEnd,
  totalResults,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}) {
  if (totalResults <= LIST_PAGE_SIZE) return null;
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  const visiblePages = Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index);

  return (
    <nav
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      aria-label="Shopping list pages"
    >
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground">{pageStart}-{pageEnd}</span> of{" "}
        <span className="font-medium text-foreground">{totalResults}</span> products
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={currentPage <= 1}>
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          Prev
        </Button>
        {visiblePages.map((pageNumber) => (
          <Button
            key={pageNumber}
            type="button"
            variant={pageNumber === currentPage ? "default" : "outline"}
            size="sm"
            className="min-w-8"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === currentPage ? "page" : undefined}
          >
            {pageNumber}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
        >
          Last
        </Button>
      </div>
    </nav>
  );
}

function EmptySearch({ notes }: { notes: string[] }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/80 bg-card p-5">
      <p className="text-sm text-foreground">
        No usable offers came back for that search. Adjust the budget, categories, or retailers, or
        send a product link or a list photo instead.
      </p>
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">
          {note}
        </p>
      ))}
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={DASHBOARD_AI_ASSISTED_ITEM_REQUEST_ROUTE} className="font-medium text-primary underline-offset-2 hover:underline">
          Product link
        </Link>
        <Link href={DASHBOARD_SHOPPING_LIST_REQUEST_ROUTE} className="font-medium text-primary underline-offset-2 hover:underline">
          Upload Shopping List
        </Link>
      </div>
    </div>
  );
}
