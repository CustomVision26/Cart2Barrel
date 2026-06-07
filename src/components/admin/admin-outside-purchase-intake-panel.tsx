"use client";

import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useCallback, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import {
  deleteAdminOutsidePurchaseIntakeAction,
  recordOutsidePurchasePaymentPromptAction,
  publishOutsidePurchaseAction,
  saveAdminOutsidePurchaseIntakeAction,
  withdrawOutsidePurchaseFromCustomerAction,
} from "@/actions/admin-outside-purchase-intake";
import { AdminOutsidePurchaseEditDialog } from "@/components/admin/admin-outside-purchase-edit-dialog";
import {
  appendOutsidePurchaseConditionPhotosToFormData,
  displayPhotoPreviewUrl,
  OutsidePurchaseConditionPhotosField,
  type OutsidePurchaseConditionPhotoDraft,
} from "@/components/admin/outside-purchase-condition-photos-field";
import { AdminCustomerRecordLabel } from "@/components/admin/admin-customer-record-label";
import { ItemRequestLineAuditDialog } from "@/components/admin/item-request-line-audit-dialog";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { CartLinePriceBreakdown } from "@/components/dashboard/cart-line-price-breakdown";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CollapsibleFieldSection } from "@/components/ui/collapsible-field-section";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { ReceivedPhotosViewer } from "@/components/orders/received-photos-viewer";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { SectionTitleWithHelp } from "@/components/ui/section-title-with-help";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ItemRequestOrderContext } from "@/data/item-request-order-context";
import type { OutsidePurchaseIntakeAdminRow } from "@/data/outside-purchase-intake";
import type { AdminProfilePickerRow } from "@/data/customer-pricing-packages";
import type { ItemQuote, ItemRequestLineSnapshot } from "@/db/schema";
import { formatUsd, type MerchantServiceTierRow } from "@/lib/admin-markup";
import {
  computeOutsidePurchaseCustomerQuoteCents,
  outsidePurchaseQuoteSummaryRows,
} from "@/lib/outside-purchase-service-quote";
import {
  formatOutsidePurchaseReference,
  outsidePurchaseReferenceDisplay,
} from "@/lib/outside-purchase";
import { outsidePurchaseShowsPublishedWorkflowWhileLimited } from "@/lib/outside-purchase-display";
import { OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX } from "@/lib/outside-purchase-staff-note";
import {
  itemRequestStatusBadgeKindForDisplay,
  itemRequestStatusLabelForDisplay,
} from "@/lib/item-request-status-label";
import type { OutsidePurchaseReturnRequest } from "@/db/schema";
import { displayProductSiteName } from "@/lib/site-name";
import { outsidePurchaseConditionPhotosFromRequest } from "@/lib/outside-purchase-condition-images";
import {
  adminCustomerDisplayLabel,
  adminCustomerSortKey,
} from "@/lib/admin-customer-group";
import { compareLocale } from "@/lib/table-sort";
import {
  revokeBlobPreviewUrl,
  validateProductImageFile,
} from "@/lib/staged-product-image";
import {
  CONDITION_OPTIONS,
  receivingConditionSelectClassName,
} from "@/components/admin/receiving-row-actions";
import type {
  WarehouseMissingReason,
  WarehouseReceiveCondition,
} from "@/lib/warehouse-receive-condition";
import { WAREHOUSE_MISSING_REASON_OPTIONS } from "@/lib/warehouse-receive-condition";
import { cn } from "@/lib/utils";
import {
  appTableEmpty,
  appTableHead,
  appTableScroll,
  appTableShell,
} from "@/lib/app-table-surfaces";
import {
  adminOutsidePurchaseDeleteEligibility,
  isOutsidePurchaseAdminActionsLimited,
  isOutsidePurchaseAdminDraft,
  outsidePurchaseAllowsAdminIntakeEdit,
  outsidePurchaseAdminNeedsPublishToCustomer,
  outsidePurchaseAdminShowsWorkflowSection,
} from "@/lib/outside-purchase-published";
import { Separator } from "@/components/ui/separator";

const FORM_SELECT_CLASS = cn(
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "dark:bg-input/30",
);

const FORM_TEXTAREA_CLASS = cn(
  "border-input bg-background placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30",
  "flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm outline-none focus-visible:ring-3",
);

const SECTION_HEADING_CLASS =
  "border-b border-border/80 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const ACTION_GROUP_LABEL_CLASS =
  "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-background/50 p-4 ring-1 ring-foreground/5">
      <div>
        <h3 className={SECTION_HEADING_CLASS}>{title}</h3>
        {description ?
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        : null}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function parseDollarsToCents(raw: string): number {
  const t = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (t === "") return 0;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function parseQuantityInput(raw: string): number {
  const t = raw.trim();
  if (t === "") return 1;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 999);
}

function parseUnitsPerPackInput(raw: string): number {
  const t = raw.trim();
  if (t === "") return 1;
  const n = Number.parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 9999);
}

type OutsidePurchaseCustomerGroup = {
  clerkUserId: string;
  userFullName: string | null;
  userEmail: string | null;
  rows: OutsidePurchaseIntakeAdminRow[];
};

function groupOutsidePurchaseRowsByCustomer(
  rows: OutsidePurchaseIntakeAdminRow[],
): OutsidePurchaseCustomerGroup[] {
  const map = new Map<string, OutsidePurchaseCustomerGroup>();

  for (const row of rows) {
    const id = row.request.clerkUserId;
    let bucket = map.get(id);
    if (!bucket) {
      bucket = {
        clerkUserId: id,
        userFullName: row.userFullName,
        userEmail: row.userEmail,
        rows: [],
      };
      map.set(id, bucket);
    }
    bucket.rows.push(row);
  }

  return [...map.values()].sort((a, b) =>
    compareLocale(
      adminCustomerSortKey({
        clerkUserId: a.clerkUserId,
        fullName: a.userFullName,
        email: a.userEmail,
      }),
      adminCustomerSortKey({
        clerkUserId: b.clerkUserId,
        fullName: b.userFullName,
        email: b.userEmail,
      }),
      "asc",
    ),
  );
}

type OutsidePurchaseProductRowProps = {
  row: OutsidePurchaseIntakeAdminRow;
  quote?: ItemQuote;
  returnReq: OutsidePurchaseReturnRequest | null;
  orderContext?: ItemRequestOrderContext;
  snapshots: ItemRequestLineSnapshot[];
  outsidePurchaseServiceTiers: MerchantServiceTierRow[];
  saving: boolean;
  promptingId: string | null;
  publishingId: string | null;
  withdrawingId: string | null;
  deletingId: string | null;
  onRecordPrompt: (itemRequestId: string) => void;
  onPublish: (itemRequestId: string) => void;
  onWithdraw: (itemRequestId: string) => void;
  onDelete: (itemRequestId: string) => void;
};

function OutsidePurchaseProductRow({
  row: { request: r },
  quote,
  returnReq,
  orderContext,
  snapshots,
  outsidePurchaseServiceTiers,
  saving,
  promptingId,
  publishingId,
  withdrawingId,
  deletingId,
  onRecordPrompt,
  onPublish,
  onWithdraw,
  onDelete,
}: OutsidePurchaseProductRowProps) {
  const ref =
    outsidePurchaseReferenceDisplay(r) ?? r.outsidePurchaseReference ?? "—";
  const prompted = Boolean(r.outsidePurchasePaymentPromptedAt);
  const published = Boolean(r.outsidePurchasePublishedAt);
  const isDraft = isOutsidePurchaseAdminDraft(r);
  const limitedActions = isOutsidePurchaseAdminActionsLimited(r, orderContext);
  const showPublishedReturnEstimateWorkflow =
    outsidePurchaseShowsPublishedWorkflowWhileLimited(r, returnReq);
  const needsPublishToCustomer = outsidePurchaseAdminNeedsPublishToCustomer(r);
  const showWorkflowSection = outsidePurchaseAdminShowsWorkflowSection(
    r,
    limitedActions,
    { showPublishedReturnEstimateWorkflow },
  );
  const chargeLabel = limitedActions ? "Review charges" : "Preview charges";
  const conditionPhotos = outsidePurchaseConditionPhotosFromRequest(r);
  const deleteEligibility = adminOutsidePurchaseDeleteEligibility(r, orderContext);
  const isDeleting = saving && deletingId === r.id;
  const statusLabel = itemRequestStatusLabelForDisplay(
    r,
    returnReq,
    orderContext,
    "admin",
    snapshots,
  );
  const actionsDescription =
    needsPublishToCustomer && limitedActions ?
      "Unpublished — publish so the customer sees this on Active."
    : isDraft ?
      "Draft — not visible to the customer until published."
    : showPublishedReturnEstimateWorkflow ?
      "Published — customer can view this line in Active products."
    : limitedActions ?
      "Checkout in progress — limited actions available."
    : published ?
      "Published — customer can view this line in Active products."
    : "Ready for review and publication.";

  return (
    <tr className="align-top transition-colors hover:bg-muted/40">
      <td className="whitespace-nowrap px-3 py-3.5">
        <span className="inline-flex rounded-md border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[11px] font-medium text-primary">
          {ref}
        </span>
      </td>
      <td className="max-w-[14rem] px-3 py-3.5">
        <div className="flex gap-3">
          <ProductRequestThumbnail
            variant="admin"
            imageUrl={r.productImageUrl}
            productLabel={r.productName}
            className="size-14 shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
              {r.productName?.trim() || "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {displayProductSiteName(r)}
            </p>
            {(r.outsidePurchaseReceiptImageUrl || conditionPhotos.length > 0) ?
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {r.outsidePurchaseReceiptImageUrl ?
                  <a
                    href={r.outsidePurchaseReceiptImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-muted/60"
                  >
                    Receipt
                  </a>
                : null}
                {conditionPhotos.length > 0 ?
                  <ReceivedPhotosViewer
                    photos={conditionPhotos}
                    triggerLabel="Condition"
                    triggerClassName="inline-flex h-auto items-center rounded-md border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-primary shadow-none hover:bg-muted/60"
                  />
                : null}
              </div>
            : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5 tabular-nums">
        <span className="text-sm font-medium text-foreground">
          {quote ? formatUsd(quote.totalPrice) : "—"}
        </span>
        {quote ?
          <p className="mt-0.5 text-[10px] text-muted-foreground">Service due</p>
        : null}
      </td>
      <td className="px-3 py-3.5">
        <StatusBadge
          kind={itemRequestStatusBadgeKindForDisplay(
            r,
            returnReq,
            orderContext,
            "admin",
            snapshots,
          )}
          title={statusLabel}
        >
          {statusLabel}
        </StatusBadge>
        {isDraft ?
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            Not visible to customer
          </p>
        : prompted ?
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            Payment prompt recorded
          </p>
        : null}
      </td>
      <td className="min-w-[13rem] px-3 py-3.5">
        <CollapsibleFieldSection
          compact
          title="Actions"
          description={actionsDescription}
          defaultOpen={
            isDraft ||
            showPublishedReturnEstimateWorkflow ||
            needsPublishToCustomer ||
            (!limitedActions && !published)
          }
          className="bg-background"
        >
          <div className="space-y-3">
            {showWorkflowSection ?
              <div className="space-y-2">
                <p className={ACTION_GROUP_LABEL_CLASS}>Workflow</p>
                <div className="flex flex-col gap-1.5">
                  {showPublishedReturnEstimateWorkflow ?
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center"
                      disabled
                      aria-label="Published to customer"
                    >
                      Published
                    </Button>
                  : published ?
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full justify-center"
                      disabled={saving && withdrawingId === r.id}
                      onClick={() => onWithdraw(r.id)}
                    >
                      {saving && withdrawingId === r.id ?
                        <Loader2Icon className="size-3.5 animate-spin" />
                      : "Withdraw from customer"}
                    </Button>
                  : <Button
                      type="button"
                      size="sm"
                      variant="default"
                      className="w-full justify-center"
                      disabled={saving && publishingId === r.id}
                      onClick={() => onPublish(r.id)}
                    >
                      {saving && publishingId === r.id ?
                        <Loader2Icon className="size-3.5 animate-spin" />
                      : "Publish to customer"}
                    </Button>
                  }
                  {published && !showPublishedReturnEstimateWorkflow ?
                    <Button
                      type="button"
                      size="sm"
                      variant={prompted ? "outline" : "secondary"}
                      className="w-full justify-center"
                      disabled={saving && promptingId === r.id}
                      onClick={() => onRecordPrompt(r.id)}
                    >
                      {saving && promptingId === r.id ?
                        <Loader2Icon className="size-3.5 animate-spin" />
                      : "Record payment prompt"}
                    </Button>
                  : null}
                </div>
              </div>
            : null}

            <div className="space-y-2">
              <p className={ACTION_GROUP_LABEL_CLASS}>Review &amp; edit</p>
              <div className="flex flex-col gap-1.5">
                {!limitedActions && outsidePurchaseAllowsAdminIntakeEdit(r) ?
                  <AdminOutsidePurchaseEditDialog
                    request={r}
                    quote={quote ?? null}
                    outsidePurchaseServiceTiers={outsidePurchaseServiceTiers}
                    returnRequest={returnReq}
                  />
                : null}
                <ItemRequestLineAuditDialog
                  itemRequestId={r.id}
                  productLabel={r.productName?.trim() || ""}
                  snapshots={snapshots}
                  triggerLabel="Status records"
                  isOutsidePurchase
                  conditionPhotos={outsidePurchaseConditionPhotosFromRequest(r)}
                  receiptPhotoUrl={r.outsidePurchaseReceiptImageUrl}
                  productImageUrl={r.productImageUrl}
                  quotes={quote ? [quote] : []}
                  estimateQuote={quote ?? null}
                />
                {quote ?
                  <QuoteEstimatePreviewDialog
                    itemRequestId={r.id}
                    label={chargeLabel}
                  />
                : null}
              </div>
            </div>

            {outsidePurchaseAllowsAdminIntakeEdit(r) ?
              <>
                <Separator className="bg-border/80" />
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!deleteEligibility.allowed || isDeleting}
                        title={
                          deleteEligibility.allowed ?
                            "Permanently remove this intake record"
                          : deleteEligibility.reason
                        }
                        className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      />
                    }
                  >
                    {isDeleting ?
                      <>
                        <Loader2Icon className="size-3.5 animate-spin" aria-hidden />
                        Removing…
                      </>
                    : "Delete record"}
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this outside purchase?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes{" "}
                        <span className="font-medium text-foreground">{ref}</span>{" "}
                        from the intake pool. The line is archived in Product history
                        and cannot be restored from this screen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        render={<Button type="button" variant="outline" />}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        render={<Button type="button" variant="destructive" />}
                        onClick={() => onDelete(r.id)}
                      >
                        Delete record
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            : null}
          </div>
        </CollapsibleFieldSection>
      </td>
    </tr>
  );
}

type AdminOutsidePurchaseIntakePanelProps = {
  customers: AdminProfilePickerRow[];
  recentRows: OutsidePurchaseIntakeAdminRow[];
  latestQuotesByRequestId: Record<string, ItemQuote>;
  returnRequestsByItemRequestId: Record<string, OutsidePurchaseReturnRequest>;
  snapshotsByRequestId?: Record<string, ItemRequestLineSnapshot[]>;
  orderContextByRequestId?: Record<string, ItemRequestOrderContext>;
  outsidePurchaseServiceTiers: MerchantServiceTierRow[];
};

export function AdminOutsidePurchaseIntakePanel({
  customers,
  recentRows,
  latestQuotesByRequestId,
  returnRequestsByItemRequestId,
  snapshotsByRequestId = {},
  orderContextByRequestId = {},
  outsidePurchaseServiceTiers,
}: AdminOutsidePurchaseIntakePanelProps) {
  const router = useRouter();
  const recentGroupsPanelId = useId();
  const [saving, startSave] = useTransition();
  const [promptingId, setPromptingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openClerkUserId, setOpenClerkUserId] = useState<string | null>(null);

  const customerGroups = useMemo(
    () => groupOutsidePurchaseRowsByCustomer(recentRows),
    [recentRows],
  );
  const draftCount = useMemo(
    () =>
      recentRows.filter((row) => isOutsidePurchaseAdminDraft(row.request)).length,
    [recentRows],
  );

  const [clerkUserId, setClerkUserId] = useState("");
  const [reference, setReference] = useState(() => formatOutsidePurchaseReference());
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [isPackLine, setIsPackLine] = useState(false);
  const [unitsPerPack, setUnitsPerPack] = useState("1");
  const [unitPriceDollars, setUnitPriceDollars] = useState("0.00");
  const [productSize, setProductSize] = useState("");
  const [productColor, setProductColor] = useState("");
  const [receivedCondition, setReceivedCondition] =
    useState<WarehouseReceiveCondition>("good");
  const [receivedMissingReason, setReceivedMissingReason] =
    useState<WarehouseMissingReason>("package_empty");
  const [receivedShelfLocation, setReceivedShelfLocation] = useState("");
  const [receiptNote, setReceiptNote] = useState("");
  const [staffNote, setStaffNote] = useState(OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX);
  const [receiptImageFile, setReceiptImageFile] = useState<File | null>(null);
  const [receiptImagePreview, setReceiptImagePreview] = useState<string | null>(
    null,
  );
  const [conditionPhotos, setConditionPhotos] = useState<
    OutsidePurchaseConditionPhotoDraft[]
  >([]);
  const [displayPhotoId, setDisplayPhotoId] = useState<string | null>(null);
  const displayImagePreview = displayPhotoPreviewUrl(
    conditionPhotos,
    displayPhotoId,
  );

  const pricingPreview = useMemo(() => {
    return computeOutsidePurchaseCustomerQuoteCents({
      unitPriceCents: parseDollarsToCents(unitPriceDollars),
      quantity: parseQuantityInput(quantity),
      unitsPerPack: isPackLine ? parseUnitsPerPackInput(unitsPerPack) : 1,
      serviceTiers: outsidePurchaseServiceTiers,
    });
  }, [unitPriceDollars, quantity, isPackLine, unitsPerPack, outsidePurchaseServiceTiers]);

  const previewRows = useMemo(
    () =>
      outsidePurchaseQuoteSummaryRows(
        {
          serviceFee: pricingPreview.serviceFeeCents,
          requestQuantity: pricingPreview.quantity,
          totalPrice: pricingPreview.totalPriceCents,
          staffNote: null,
        },
        pricingPreview,
      ),
    [pricingPreview],
  );

  const resetForm = useCallback(() => {
    setReference(formatOutsidePurchaseReference());
    setProductName("");
    setQuantity("1");
    setIsPackLine(false);
    setUnitsPerPack("1");
    setUnitPriceDollars("0.00");
    setProductSize("");
    setProductColor("");
    setReceivedCondition("good");
    setReceivedMissingReason("package_empty");
    setReceivedShelfLocation("");
    setReceiptNote("");
    setStaffNote(OUTSIDE_PURCHASE_STAFF_NOTE_PREFIX);
    setReceiptImageFile(null);
    revokeBlobPreviewUrl(receiptImagePreview);
    setReceiptImagePreview(null);
    for (const photo of conditionPhotos) {
      if (photo.file) revokeBlobPreviewUrl(photo.previewUrl);
    }
    setConditionPhotos([]);
    setDisplayPhotoId(null);
  }, [conditionPhotos, receiptImagePreview]);

  const onPickReceiptImage = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      const err = validateProductImageFile(file);
      if (err) {
        toast.error(err);
        return;
      }
      setReceiptImageFile(file);
      revokeBlobPreviewUrl(receiptImagePreview);
      setReceiptImagePreview(URL.createObjectURL(file));
    },
    [receiptImagePreview],
  );

  const onSubmit = () => {
    if (!clerkUserId.trim()) {
      toast.error("Select a customer account.");
      return;
    }
    if (!productName.trim()) {
      toast.error("Enter a product name.");
      return;
    }

    const fd = new FormData();
    fd.set("clerkUserId", clerkUserId.trim());
    fd.set("outsidePurchaseReference", reference.trim());
    fd.set("productName", productName.trim());
    fd.set("quantity", String(parseQuantityInput(quantity)));
    fd.set(
      "unitsPerPack",
      String(isPackLine ? parseUnitsPerPackInput(unitsPerPack) : 1),
    );
    fd.set("unitPriceCents", String(parseDollarsToCents(unitPriceDollars)));
    if (productSize.trim()) fd.set("productSize", productSize.trim());
    if (productColor.trim()) fd.set("productColor", productColor.trim());
    fd.set("receivedCondition", receivedCondition);
    if (receivedCondition === "missing") {
      fd.set("receivedMissingReason", receivedMissingReason);
    }
    fd.set("receivedShelfLocation", receivedShelfLocation.trim());
    if (receiptNote.trim()) fd.set("note", receiptNote.trim());
    if (staffNote.trim()) fd.set("staffNote", staffNote.trim());
    if (receiptImageFile) fd.set("receiptImage", receiptImageFile);
    appendOutsidePurchaseConditionPhotosToFormData(
      fd,
      conditionPhotos,
      displayPhotoId,
    );

    startSave(async () => {
      const res = await saveAdminOutsidePurchaseIntakeAction(fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved.");
        resetForm();
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not save.");
      }
    });
  };

  const onRecordPrompt = (itemRequestId: string) => {
    setPromptingId(itemRequestId);
    startSave(async () => {
      const res = await recordOutsidePurchasePaymentPromptAction({ itemRequestId });
      setPromptingId(null);
      if (res.ok) {
        toast.success(res.message ?? "Recorded.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not record.");
      }
    });
  };

  const onPublish = (itemRequestId: string) => {
    setPublishingId(itemRequestId);
    startSave(async () => {
      const res = await publishOutsidePurchaseAction({ itemRequestId });
      setPublishingId(null);
      if (res.ok) {
        toast.success(res.message ?? "Published.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not publish.");
      }
    });
  };

  const onWithdraw = (itemRequestId: string) => {
    setWithdrawingId(itemRequestId);
    startSave(async () => {
      const res = await withdrawOutsidePurchaseFromCustomerAction({ itemRequestId });
      setWithdrawingId(null);
      if (res.ok) {
        toast.success(res.message ?? "Withdrawn.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not withdraw.");
      }
    });
  };

  const onDelete = (itemRequestId: string) => {
    setDeletingId(itemRequestId);
    startSave(async () => {
      const res = await deleteAdminOutsidePurchaseIntakeAction({ itemRequestId });
      setDeletingId(null);
      if (res.ok) {
        toast.success(res.message ?? "Deleted.");
        router.refresh();
      } else {
        toast.error(res.message ?? "Could not delete.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <section className={cn(appTableShell, "overflow-hidden")}>
        <div className="border-b border-border bg-muted/60 px-4 py-5 sm:px-6">
          <SectionTitleWithHelp
            title="Outside purchase intake"
            titleClassName="text-lg font-semibold tracking-tight text-foreground"
            help={
              <>
                Record products the customer bought elsewhere and shipped to your
                address. Each line receives a unique{" "}
                <span className="font-mono text-xs">OP-YYYYMMDD-XXXX</span>{" "}
                reference. The customer pays{" "}
                <span className="font-medium text-foreground">
                  outside purchase service &amp; handling only
                </span>
                , calculated from your outside-purchase fee tiers and the listed
                unit price × quantity. Merchandise, shipping, and tax from their
                receipt are not billed here.
              </>
            }
            helpLabel="About outside purchase intake"
            tooltipClassName="w-[28rem]"
          />
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Complete the form below to create a draft product line. Publish the
            record when the customer should see it under Active products.
          </p>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:gap-8">
          <div className="space-y-5">
            <FormSection
              title="Customer & reference"
              description="Assign the line to the correct account and confirm the intake reference."
            >
              <Field>
                <FieldLabelWithHelp
                  htmlFor="op-customer"
                  label="Customer account"
                  help="The shopper who bought this item elsewhere and shipped it to you. The line and its service charge are billed to this account."
                  helpLabel="About customer account"
                />
                <FieldContent>
                  <select
                    id="op-customer"
                    value={clerkUserId}
                    onChange={(e) => setClerkUserId(e.target.value)}
                    className={FORM_SELECT_CLASS}
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c.clerkUserId} value={c.clerkUserId}>
                        {c.displayName}
                        {c.email ? ` · ${c.email}` : ""}
                      </option>
                    ))}
                  </select>
                </FieldContent>
              </Field>

              {clerkUserId.trim() ?
                <p className="rounded-md border border-border/70 bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  Service &amp; handling uses the global outside-purchase tiers
                  from Fees &amp; rates (not in-app tiers or customer package
                  overrides).
                </p>
              : null}

              <div className="flex flex-wrap items-end gap-2">
                <Field className="min-w-[14rem] flex-1">
                  <FieldLabelWithHelp
                    htmlFor="op-ref"
                    label="Reference number"
                    help="Unique staff-facing tracking id (OP-YYYYMMDD-XXXX) for this outside purchase. Used on the customer's product line and in status records."
                    helpLabel="About reference number"
                  />
                  <FieldContent>
                    <Input
                      id="op-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value.toUpperCase())}
                      className="font-mono"
                      autoComplete="off"
                    />
                  </FieldContent>
                </Field>
                <div className="flex items-center gap-1.5 pb-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setReference(formatOutsidePurchaseReference())}
                  >
                    <RefreshCwIcon className="mr-1.5 size-3.5" aria-hidden />
                    New ID
                  </Button>
                  <HelpBalloon label="About New ID">
                    Generates a fresh unique reference number. Use it if the
                    current id is already taken or you want a new one for this
                    intake.
                  </HelpBalloon>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Product details"
              description="Describe the item as received and enter pricing used to determine the service tier."
            >
              <Field>
                <FieldLabelWithHelp
                  htmlFor="op-name"
                  label="Product name"
                  help="Name shown to the customer on their product line and order. Use the retailer's product title so the shopper recognizes the item."
                  helpLabel="About product name"
                />
                <FieldContent>
                  <Input
                    id="op-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </FieldContent>
              </Field>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={isPackLine}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsPackLine(checked);
                    if (!checked) {
                      setUnitsPerPack("1");
                    } else if (parseUnitsPerPackInput(unitsPerPack) < 2) {
                      setUnitsPerPack("2");
                    }
                  }}
                  className="mt-0.5 size-4 rounded border-input"
                />
                <span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    Pack / bundle / case
                    <HelpBalloon label="About pack pricing">
                      Charge outside-purchase service &amp; handling per consumer
                      unit: units in each pack × per-unit fee × number of packs.
                    </HelpBalloon>
                  </span>
                </span>
              </label>

              <div
                className={cn(
                  "grid gap-4",
                  isPackLine ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3",
                )}
              >
                <Field>
                  <FieldLabelWithHelp
                    htmlFor="op-qty"
                    label={isPackLine ? "Received Qty (packs)" : "Received Qty"}
                    help={
                      isPackLine ?
                        "Number of packs/cases/bundles received. Service & handling is charged per consumer unit (units per pack × this count)."
                      : "Number of individual items received. Service & handling is charged per unit."
                    }
                    helpLabel="About received quantity"
                  />
                  <FieldContent>
                    <Input
                      id="op-qty"
                      type="number"
                      min={1}
                      max={999}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                {isPackLine ?
                  <Field>
                    <FieldLabelWithHelp
                      htmlFor="op-units-per-pack"
                      label="Units per pack"
                      help="Consumer units in one pack (e.g. 12 for a case, 2 for a twin-pack)."
                      helpLabel="About units per pack"
                    />
                    <FieldContent>
                      <Input
                        id="op-units-per-pack"
                        type="number"
                        min={2}
                        max={9999}
                        value={unitsPerPack}
                        onChange={(e) => setUnitsPerPack(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                : null}
                <Field className={isPackLine ? undefined : "sm:col-span-2"}>
                  <FieldLabelWithHelp
                    htmlFor="op-unit-price"
                    label="Listed unit price (USD, for tier only)"
                    help={`Single-item price used to pick the outside-purchase service & handling tier${isPackLine ? " (not pack price)." : "."}`}
                    helpLabel="About listed unit price"
                  />
                  <FieldContent>
                    <Input
                      id="op-unit-price"
                      inputMode="decimal"
                      value={unitPriceDollars}
                      onChange={(e) => setUnitPriceDollars(e.target.value)}
                      className="tabular-nums"
                      placeholder="0.00"
                    />
                  </FieldContent>
                </Field>
              </div>

              {isPackLine && pricingPreview.consumerUnits > 0 ?
                <p className="text-xs text-muted-foreground">
                  Total consumer units:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {pricingPreview.consumerUnits}
                  </span>{" "}
                  ({pricingPreview.unitsPerPack} × {pricingPreview.quantity} pack
                  {pricingPreview.quantity === 1 ? "" : "s"})
                </p>
              : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabelWithHelp
                    htmlFor="op-size"
                    label="Received size"
                    help="Size/variant of the item as it actually arrived (optional). Shown to the customer for confirmation."
                    helpLabel="About received size"
                  />
                  <FieldContent>
                    <Input
                      id="op-size"
                      value={productSize}
                      onChange={(e) => setProductSize(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabelWithHelp
                    htmlFor="op-color"
                    label="Received color"
                    help="Color/variant of the item as it actually arrived (optional). Shown to the customer for confirmation."
                    helpLabel="About received color"
                  />
                  <FieldContent>
                    <Input
                      id="op-color"
                      value={productColor}
                      onChange={(e) => setProductColor(e.target.value)}
                    />
                  </FieldContent>
                </Field>
              </div>
            </FormSection>

            <FormSection
              title="Warehouse intake"
              description="Record physical condition, storage location, and photographic evidence."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabelWithHelp
                    htmlFor="op-condition"
                    label="Condition received"
                    help="Physical state of the item when it arrived at your warehouse (e.g. good, damaged, wrong item). Drives the customer status and any return-to-retailer flow."
                    helpLabel="About received condition"
                  />
                  <FieldContent>
                    <select
                      id="op-condition"
                      value={receivedCondition}
                      onChange={(e) =>
                        setReceivedCondition(e.target.value as WarehouseReceiveCondition)
                      }
                      className={receivingConditionSelectClassName}
                    >
                      {CONDITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {receivedCondition === "missing" ?
                      <div className="mt-2 space-y-1.5">
                        <label
                          htmlFor="op-missing-reason"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Missing details
                        </label>
                        <select
                          id="op-missing-reason"
                          value={receivedMissingReason}
                          onChange={(e) =>
                            setReceivedMissingReason(
                              e.target.value as WarehouseMissingReason,
                            )
                          }
                          className={receivingConditionSelectClassName}
                        >
                          {WAREHOUSE_MISSING_REASON_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    : null}
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabelWithHelp
                    htmlFor="op-shelf"
                    label="Shelf location"
                    help="Where the item is stored in your warehouse (aisle, shelf, or bin). Internal only — helps staff find it when packing the barrel."
                    helpLabel="About shelf location"
                  />
                  <FieldContent>
                    <Input
                      id="op-shelf"
                      value={receivedShelfLocation}
                      onChange={(e) => setReceivedShelfLocation(e.target.value)}
                      placeholder="Aisle, shelf, bin…"
                      autoComplete="off"
                    />
                  </FieldContent>
                </Field>
              </div>

              <Field>
                <FieldLabelWithHelp
                  htmlFor="op-condition-images"
                  label="Received condition photos"
                  help="Upload one or more photos of the received product. Mark one as the customer-facing display image."
                  helpLabel="About received condition photos"
                />
                <FieldContent>
                  <OutsidePurchaseConditionPhotosField
                    inputId="op-condition-images"
                    photos={conditionPhotos}
                    displayPhotoId={displayPhotoId}
                    onPhotosChange={setConditionPhotos}
                    onDisplayPhotoIdChange={setDisplayPhotoId}
                  />
                </FieldContent>
              </Field>
            </FormSection>

            <CollapsibleFieldSection
              title="Receipt details"
              description="Optional inbound note and proof-of-purchase image"
              defaultOpen={false}
            >
              <Field>
                <FieldLabelWithHelp
                  htmlFor="op-receipt-note"
                  label="Receipt / inbound note"
                  help="Internal note about the inbound package — retailer, order number, or handling details. Not shown to the customer."
                  helpLabel="About receipt / inbound note"
                />
                <FieldContent>
                  <textarea
                    id="op-receipt-note"
                    rows={2}
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
                    placeholder="Retailer, order number, or handling notes…"
                    className={FORM_TEXTAREA_CLASS}
                  />
                </FieldContent>
              </Field>
              <Field>
                <FieldLabelWithHelp
                  htmlFor="op-receipt-image"
                  label="Receipt image"
                  help="Photo of the retailer receipt or proof of purchase. Internal record of what the customer paid the store."
                  helpLabel="About receipt image"
                />
                <FieldContent>
                  <p className="mb-2 text-xs text-muted-foreground">
                    JPEG, PNG, WebP, or GIF.
                  </p>
                  <Input
                    id="op-receipt-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => onPickReceiptImage(e.target.files)}
                  />
                  {receiptImagePreview ?
                    <div className="mt-3 flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-3">
                      <ProductRequestThumbnail
                        variant="admin"
                        imageUrl={receiptImagePreview}
                        productLabel="Receipt"
                        className="size-24 shrink-0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReceiptImageFile(null);
                          revokeBlobPreviewUrl(receiptImagePreview);
                          setReceiptImagePreview(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  : null}
                </FieldContent>
              </Field>
            </CollapsibleFieldSection>

            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 p-4 ring-1 ring-foreground/5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer charge preview
                <HelpBalloon label="About customer charge preview">
                  Outside purchase service &amp; handling only — in-app merchandise,
                  shipping, tax, and in-app service fees are not included.
                </HelpBalloon>
              </p>
              <CartLinePriceBreakdown rows={previewRows} />
            </div>

            <CollapsibleFieldSection
              title="Staff note"
              description="Optional message shown to the customer on this product line"
              defaultOpen={false}
            >
              <Field>
                <FieldLabelWithHelp
                  htmlFor="op-staff-note"
                  label="Staff note"
                  help="Short message shown to the customer on this product line — e.g. a note about substitutions or condition. Leave blank if none."
                  helpLabel="About staff note"
                />
                <FieldContent>
                  <textarea
                    id="op-staff-note"
                    rows={3}
                    value={staffNote}
                    onChange={(e) => setStaffNote(e.target.value)}
                    className={FORM_TEXTAREA_CLASS}
                  />
                </FieldContent>
              </Field>
            </CollapsibleFieldSection>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/80 pt-4">
              <Button
                type="button"
                disabled={saving}
                onClick={onSubmit}
                className="w-full sm:w-auto"
              >
                {saving ?
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden />
                    Saving intake…
                  </>
                : "Save draft & estimate"}
              </Button>
              <HelpBalloon label="About save draft & estimate">
                Creates the product line as an unpublished draft, uploads any
                photos, and calculates the outside-purchase service &amp; handling
                estimate. Publish the record when the customer should see it.
              </HelpBalloon>
            </div>
          </div>

          <aside className="lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4 ring-1 ring-foreground/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Intake preview
              </p>
              <div className="mt-4 flex flex-col items-center gap-4">
                <ProductRequestThumbnail
                  variant="admin"
                  imageUrl={displayImagePreview}
                  productLabel={productName || "Product"}
                  className="size-40"
                />
                {displayImagePreview ?
                  <p className="text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Customer display image
                  </p>
                : <p className="text-center text-xs text-muted-foreground">
                    Display image appears when condition photos are uploaded
                  </p>
                }
                {receiptImagePreview ?
                  <div className="flex w-full flex-col items-center gap-2 border-t border-border/80 pt-4">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Receipt preview
                    </p>
                    <ProductRequestThumbnail
                      variant="admin"
                      imageUrl={receiptImagePreview}
                      productLabel="Receipt"
                      className="size-20"
                    />
                  </div>
                : null}
                <div className="w-full border-t border-border/80 pt-4 text-center">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Reference
                  </p>
                  <p className="mt-1 font-mono text-sm font-medium text-primary">
                    {reference}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <SectionTitleWithHelp
              as="h3"
              title="Recent outside purchases"
              titleClassName="text-base font-semibold tracking-tight text-foreground"
              help="Grouped by customer account. Expand a row to review each product, its service charge, and available actions."
              helpLabel="About recent outside purchases"
              tooltipClassName="w-80"
            />
            <p className="text-sm text-muted-foreground">
              Manage published and draft intake records from this queue.
            </p>
          </div>
          {recentRows.length > 0 ?
            <p className="rounded-md border border-border/70 bg-muted/50 px-3 py-1.5 text-xs tabular-nums text-muted-foreground">
              {recentRows.length} record{recentRows.length === 1 ? "" : "s"}
              {draftCount > 0 ?
                ` · ${draftCount} draft${draftCount === 1 ? "" : "s"}`
              : ""}
            </p>
          : null}
        </div>
        {recentRows.length === 0 ?
          <p className={appTableEmpty}>
            No outside-purchase intake records yet. Save a product above to begin.
          </p>
        : <FloatingHorizontalScroll
            viewportClassName={cn(appTableScroll, "overflow-hidden")}
          >
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className={appTableHead}>
                <tr>
                  <th className="w-10 px-2 py-3" aria-hidden />
                  <th className="px-3 py-3 font-medium">Customer account</th>
                  <th className="px-3 py-3 font-medium text-right">Products</th>
                </tr>
              </thead>
              {customerGroups.map((group) => {
                const expanded = openClerkUserId === group.clerkUserId;
                const panelId = `${recentGroupsPanelId}-${group.clerkUserId}`;
                const customerLabel = adminCustomerDisplayLabel({
                  clerkUserId: group.clerkUserId,
                  fullName: group.userFullName,
                  email: group.userEmail,
                });

                return (
                  <tbody
                    key={group.clerkUserId}
                    className="border-b border-border last:border-b-0"
                  >
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-border/80 bg-background transition-colors hover:bg-muted/50",
                        expanded && "bg-muted/40",
                      )}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() =>
                        setOpenClerkUserId((current) =>
                          current === group.clerkUserId ? null : group.clerkUserId,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenClerkUserId((current) =>
                            current === group.clerkUserId ? null : group.clerkUserId,
                          );
                        }
                      }}
                    >
                      <td className="px-2 py-2.5 align-middle text-muted-foreground">
                        {expanded ?
                          <ChevronDownIcon className="size-4" aria-hidden />
                        : <ChevronRightIcon className="size-4" aria-hidden />}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <AdminCustomerRecordLabel
                          clerkUserId={group.clerkUserId}
                          fullName={group.userFullName}
                          email={group.userEmail}
                          primaryClassName="text-sm font-medium"
                        />
                      </td>
                      <td className="px-3 py-3 align-middle tabular-nums text-right text-muted-foreground">
                        {group.rows.length}
                      </td>
                    </tr>
                    {expanded ?
                      <tr>
                        <td colSpan={3} className="bg-muted/20 p-0">
                          <div
                            id={panelId}
                            className="border-t border-border px-4 py-4"
                            role="region"
                            aria-label={`Outside purchases for ${customerLabel}`}
                          >
                            <table className="w-full min-w-[44rem] overflow-hidden rounded-lg border border-border/80 bg-card text-left text-sm ring-1 ring-foreground/5">
                              <thead className={cn(appTableHead, "text-[11px]")}>
                                <tr>
                                  <th className="px-3 py-2.5 font-medium">Reference</th>
                                  <th className="px-3 py-2.5 font-medium">Product</th>
                                  <th className="px-3 py-2.5 font-medium">Service due</th>
                                  <th className="px-3 py-2.5 font-medium">Status</th>
                                  <th className="px-3 py-2.5 font-medium">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/80">
                                {group.rows.map((row) => (
                                  <OutsidePurchaseProductRow
                                    key={row.request.id}
                                    row={row}
                                    quote={latestQuotesByRequestId[row.request.id]}
                                    returnReq={
                                      returnRequestsByItemRequestId[row.request.id] ??
                                      null
                                    }
                                    orderContext={
                                      orderContextByRequestId[row.request.id]
                                    }
                                    snapshots={
                                      snapshotsByRequestId[row.request.id] ?? []
                                    }
                                    outsidePurchaseServiceTiers={
                                      outsidePurchaseServiceTiers
                                    }
                                    saving={saving}
                                    promptingId={promptingId}
                                    publishingId={publishingId}
                                    withdrawingId={withdrawingId}
                                    deletingId={deletingId}
                                    onRecordPrompt={onRecordPrompt}
                                    onPublish={onPublish}
                                    onWithdraw={onWithdraw}
                                    onDelete={onDelete}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    : null}
                  </tbody>
                );
              })}
            </table>
          </FloatingHorizontalScroll>
        }
      </section>
    </div>
  );
}
