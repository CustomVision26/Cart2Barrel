"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  ChevronDownIcon,
  CreditCard,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { adminReplySupportTicketAction } from "@/actions/admin-support-tickets";
import {
  cancelMerchandiseReconciliationWithRefundAction,
  getMerchandiseReconciliationAction,
  markMerchandiseTopupPaidAction,
  notifyMerchandisePriceChangeAction,
  recordMerchandiseReconciliationAction,
  requestMerchandiseTopupAction,
  revokeMerchandiseTopupAction,
} from "@/actions/admin-merchandise-reconciliation";
import { AdminBatchReconciliationMessageDialog } from "@/components/admin/admin-batch-reconciliation-message-dialog";
import { AdminSingleReconciliationMessageDialog } from "@/components/admin/admin-single-reconciliation-message-dialog";
import {
  MerchandiseTopupMessageTemplateSelect,
  type MerchandiseTopupMessageTemplateId,
} from "@/components/admin/merchandise-topup-message-template-select";
import { MerchandiseTopupAmountBreakdownToggle } from "@/components/merchandise-topup-amount-breakdown-toggle";
import {
  SupportTicketComposeForm,
  type SupportTicketComposePayload,
} from "@/components/support/support-ticket-compose-form";
import { SupportTicketThread } from "@/components/support/support-ticket-thread";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SupportTicketMessageRow } from "@/data/support-tickets";
import { formatUsd } from "@/lib/admin-markup";
import {
  centsToUsdInput,
  parseUsdToCents,
} from "@/lib/admin-pricing-form-utils";
import type { MerchantServiceTierRow } from "@/lib/admin-markup";
import {
  actualRetailerVariableCents,
  availableReconciliationChargeRows,
  buildBatchReconciliationCustomerMessage,
  buildSingleReconciliationCustomerMessage,
  checkoutRetailerVariableCents,
  computeAdjustedServiceHandlingCents,
  defaultMerchandiseAdditionalTopupMessage,
  defaultMerchandiseTopupMessage,
  defaultMerchandiseTopupPaidMessage,
  formatMerchandisePriceDecisionPromptLines,
  formatMerchandiseTopupNumber,
  latestMerchandisePriceDecisionFromMessages,
  MERCHANDISE_TOPUP_DEFAULT_EXPIRY_HOURS,
  merchandiseReconciliationAllowsPurchase,
  merchandiseTopupPaidNetCents,
  messageBodyHasMerchandisePriceDecisionPrompt,
  remainingMerchandiseTopupCents,
  resolveReconciliationUnitsPerPack,
  retailerVariableDeltaCents,
  type MerchandiseReconciliationView,
  type ReconciliationProductLineInput,
} from "@/lib/merchandise-reconciliation";
import type { MerchandiseTopupChargeBreakdownView } from "@/data/merchandise-topup-charge-breakdowns";
import { serviceHandlingFeePerUnitCents } from "@/lib/admin-markup";
import { cn } from "@/lib/utils";

function statusLabel(status: MerchandiseReconciliationView["status"]): string {
  switch (status) {
    case "recorded":
      return "Cost recorded";
    case "customer_notified":
      return "Awaiting customer decision";
    case "topup_pending":
      return "Top-up unpaid";
    case "topup_paid":
      return "Top-up paid — purchase allowed";
    case "matched":
      return "Charges match — purchase allowed";
    case "cancelled":
      return "Cancelled after price change";
    default:
      return status;
  }
}

export function AdminMerchandiseReconciliationPanel({
  orderItemId,
  productName,
  checkoutMerchandiseCents,
  checkoutShippingCents,
  checkoutTaxCents,
  checkoutServiceCents,
  linePriceCents,
  refundedCents,
  dialogOpen,
  compact = false,
  relatedOrderItemIds,
  customerCheckoutTotalCents,
  quantity,
  products,
  productLines,
  onAllowsPurchaseChange,
}: {
  orderItemId: string;
  productName: string;
  checkoutMerchandiseCents: number;
  checkoutShippingCents: number;
  checkoutTaxCents: number;
  checkoutServiceCents: number;
  linePriceCents: number;
  refundedCents: number;
  dialogOpen: boolean;
  compact?: boolean;
  relatedOrderItemIds?: string[];
  customerCheckoutTotalCents?: number;
  /**
   * Consumer units for tier-based service adjustment (single line qty, or sum of
   * batch line quantities). Required for correct band lookup vs ratio scaling.
   */
  quantity?: number;
  /** Structured products for a neat Message customer prefill. */
  products?: ReconciliationProductLineInput[];
  /** Legacy preformatted product lines. Prefer `products`. */
  productLines?: string[];
  onAllowsPurchaseChange?: (allows: boolean) => void;
}) {
  const isBatchScope =
    (relatedOrderItemIds?.length ?? 0) > 0 || (products?.length ?? 0) > 1;
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [row, setRow] = useState<MerchandiseReconciliationView | null>(null);
  const [actualMerchUsd, setActualMerchUsd] = useState("");
  const [actualShipUsd, setActualShipUsd] = useState("");
  const [actualTaxUsd, setActualTaxUsd] = useState("");
  /** Single-product only — admin-adjustable S&H. */
  const [actualServiceUsd, setActualServiceUsd] = useState("");
  const [serviceManual, setServiceManual] = useState(false);
  /** Consumer units per pack (e.g. 12). Editable beside S&H fee. */
  const [unitsPerPackInput, setUnitsPerPackInput] = useState("");
  const [unitsPerPackManual, setUnitsPerPackManual] = useState(false);
  const [message, setMessage] = useState("");
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [refundUsd, setRefundUsd] = useState("");
  const [serviceTiers, setServiceTiers] = useState<MerchantServiceTierRow[]>([]);
  const [customerDisplayName, setCustomerDisplayName] = useState<string | null>(
    null,
  );
  const [ticketMessages, setTicketMessages] = useState<
    SupportTicketMessageRow[]
  >([]);
  /** Resolved live dialogue ticket (may prefer the thread with customer decision). */
  const [dialogueTicketId, setDialogueTicketId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  /** Original merchandise order id (Completed checkout template). */
  const [merchandiseOrderId, setMerchandiseOrderId] = useState<string | null>(
    null,
  );
  /** Batch-only: expand checkout S&H into per-product shares. */
  const [checkoutServiceOpen, setCheckoutServiceOpen] = useState(false);
  const [revokeTopupConfirmOpen, setRevokeTopupConfirmOpen] = useState(false);
  /** Collapse the Message customer thread / compose block. */
  const [messageCustomerOpen, setMessageCustomerOpen] = useState(true);
  /**
   * Admin override: open cancel/refund UI even when the customer chose top-up
   * (or before they decide).
   */
  const [adminForceCancelRefund, setAdminForceCancelRefund] = useState(false);
  /** Frozen per-installment breakdowns (each new top-up keeps its own copy). */
  const [topupBreakdowns, setTopupBreakdowns] = useState<
    MerchandiseTopupChargeBreakdownView[]
  >([]);

  const refundableCents = Math.max(0, linePriceCents - refundedCents);
  const gate = merchandiseReconciliationAllowsPurchase(row);
  const checkoutVariableCents = checkoutRetailerVariableCents({
    checkoutMerchandiseCents,
    checkoutShippingCents,
    checkoutTaxCents,
    checkoutServiceCents,
  });

  const notifyAllowsPurchaseChange = useEffectEvent((allows: boolean) => {
    onAllowsPurchaseChange?.(allows);
  });

  useEffect(() => {
    notifyAllowsPurchaseChange(gate.ok);
  }, [gate.ok]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMerchandiseReconciliationAction({
        orderItemId,
        relatedOrderItemIds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setServiceTiers(res.serviceTiers);
      setRow(res.reconciliation);
      setCustomerDisplayName(res.customerDisplayName);
      setTicketMessages(res.ticketMessages);
      setDialogueTicketId(res.supportTicketId);
      setMerchandiseOrderId(res.merchandiseOrderId);
      setTopupBreakdowns(res.topupBreakdowns ?? []);
      setServiceManual(false);
      setUnitsPerPackManual(false);
      if (res.reconciliation) {
        setActualMerchUsd(
          centsToUsdInput(res.reconciliation.actualMerchandiseCents),
        );
        setActualShipUsd(
          centsToUsdInput(res.reconciliation.actualShippingCents),
        );
        setActualTaxUsd(centsToUsdInput(res.reconciliation.actualTaxCents));
        setActualServiceUsd(
          centsToUsdInput(res.reconciliation.actualServiceCents),
        );
        setServiceManual(true);
        if (res.reconciliation.customerMessage) {
          setMessage(res.reconciliation.customerMessage);
        }
      } else {
        setActualMerchUsd("");
        setActualShipUsd("");
        setActualTaxUsd("");
        setActualServiceUsd("");
        setMessage("");
        setTicketMessages([]);
        setDialogueTicketId(null);
        setMerchandiseOrderId(null);
        setTopupBreakdowns([]);
      }
      setRefundUsd(centsToUsdInput(refundableCents));
    } finally {
      setLoading(false);
    }
  }, [orderItemId, relatedOrderItemIds, refundableCents]);

  const paidTopupBreakdowns = useMemo(
    () => topupBreakdowns.filter((b) => b.status === "paid"),
    [topupBreakdowns],
  );

  /**
   * Messages-only refresh — does not reset Actual cost inputs or other UI state.
   */
  const refreshMessages = useCallback(async () => {
    const res = await getMerchandiseReconciliationAction({
      orderItemId,
      relatedOrderItemIds,
    });
    if (!res.ok) return;
    setTicketMessages(res.ticketMessages);
    setDialogueTicketId(res.supportTicketId);
  }, [orderItemId, relatedOrderItemIds]);

  const onHardRefresh = () => {
    startTransition(async () => {
      await load();
      toast.message("Conversation and costs refreshed.");
    });
  };

  useEffect(() => {
    if (!dialogOpen) return;
    void load();
  }, [dialogOpen, load]);

  /** Auto-refresh only the Message customer thread (not costs / rest of UI). */
  useEffect(() => {
    if (!dialogOpen || !messageCustomerOpen) return;
    const id = window.setInterval(() => {
      void refreshMessages();
    }, 12_000);
    return () => window.clearInterval(id);
  }, [dialogOpen, messageCustomerOpen, refreshMessages]);

  const previewActualMerch = parseUsdToCents(actualMerchUsd);
  const previewActualShip = parseUsdToCents(actualShipUsd);
  const previewActualTax = parseUsdToCents(actualTaxUsd);
  /**
   * True when actual charges are meaningfully entered. "0" / "0.00" after a
   * revoke does not count — otherwise batch checkout S&H alone drives a fake
   * actual subtotal / price-down delta.
   */
  const hasPreviewInput =
    previewActualMerch > 0 ||
    previewActualShip > 0 ||
    previewActualTax > 0;

  const packCount = Math.max(0, Math.floor(quantity ?? 0));
  const inferredUnitsPerPack = useMemo(
    () =>
      resolveReconciliationUnitsPerPack({
        unitsPerPack: products?.[0]?.unitsPerPack,
        productName: products?.[0]?.productName ?? productName,
        packCount: packCount > 0 ? packCount : 1,
        checkoutMerchandiseCents,
        checkoutServiceCents,
        serviceTiers,
      }),
    [
      products,
      productName,
      packCount,
      checkoutMerchandiseCents,
      checkoutServiceCents,
      serviceTiers,
    ],
  );

  /** Seed pack # from inference until admin edits it. */
  useEffect(() => {
    if (unitsPerPackManual) return;
    setUnitsPerPackInput(
      inferredUnitsPerPack > 1 ? String(inferredUnitsPerPack) : "1",
    );
  }, [inferredUnitsPerPack, unitsPerPackManual]);

  const unitsPerPack = useMemo(() => {
    const parsed = Number.parseInt(unitsPerPackInput.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(9999, Math.floor(parsed));
    }
    return Math.max(1, inferredUnitsPerPack);
  }, [unitsPerPackInput, inferredUnitsPerPack]);

  const consumerUnits =
    (packCount > 0 ? packCount : 1) * Math.max(1, unitsPerPack);

  /**
   * Batch: Actual column has no S&H UI. Checkout S&H is still used under the
   * hood so S&H cancels out of the top-up delta (not re-tiered on batch).
   * Single: suggest from fee tiers (admin can edit).
   */
  const suggestedServiceCents = useMemo(() => {
    if (isBatchScope) {
      if (products && products.length > 0) {
        const fromProducts = products.reduce(
          (sum, p) => sum + Math.max(0, Math.round(p.checkoutServiceCents ?? 0)),
          0,
        );
        if (fromProducts > 0) return fromProducts;
      }
      return Math.max(0, Math.round(checkoutServiceCents));
    }
    return computeAdjustedServiceHandlingCents({
      checkoutMerchandiseCents,
      checkoutServiceCents,
      actualMerchandiseCents: previewActualMerch,
      quantity: packCount > 0 ? packCount : undefined,
      unitsPerPack,
      serviceTiers,
    });
  }, [
    isBatchScope,
    products,
    previewActualMerch,
    serviceTiers,
    checkoutMerchandiseCents,
    checkoutServiceCents,
    packCount,
    unitsPerPack,
  ]);

  const suggestedPerUnitFeeCents = useMemo(() => {
    if (previewActualMerch <= 0 || consumerUnits <= 0) return 0;
    const packs = packCount > 0 ? packCount : 1;
    const packPriceCents = Math.round(previewActualMerch / packs);
    return serviceHandlingFeePerUnitCents(packPriceCents, serviceTiers);
  }, [previewActualMerch, consumerUnits, packCount, serviceTiers]);

  /** Keep single-product S&H in sync with tier suggestion until admin edits it. */
  useEffect(() => {
    if (isBatchScope || serviceManual) return;
    setActualServiceUsd(
      suggestedServiceCents > 0 || previewActualMerch > 0 ?
        centsToUsdInput(suggestedServiceCents)
      : "",
    );
  }, [
    isBatchScope,
    serviceManual,
    suggestedServiceCents,
    previewActualMerch,
  ]);

  /**
   * Correct saved rows that used pack price × 1 instead of × units-per-pack
   * (e.g. $1.50 for a 12-pack that should be $18).
   */
  useEffect(() => {
    if (isBatchScope || !row || unitsPerPack <= 1) return;
    if (previewActualMerch <= 0 || suggestedServiceCents <= 0) return;
    const packs = packCount > 0 ? packCount : 1;
    const packPriceCents = Math.round(row.actualMerchandiseCents / packs);
    const legacyPackFee =
      serviceHandlingFeePerUnitCents(packPriceCents, serviceTiers) * packs;
    if (
      row.actualServiceCents === legacyPackFee &&
      suggestedServiceCents !== legacyPackFee
    ) {
      setServiceManual(false);
      setActualServiceUsd(centsToUsdInput(suggestedServiceCents));
    }
  }, [
    isBatchScope,
    row,
    unitsPerPack,
    packCount,
    previewActualMerch,
    suggestedServiceCents,
    serviceTiers,
  ]);

  /**
   * Batch: mirror checkout S&H for delta/persistence only (hidden from Actual
   * UI / subtotal). Single: use the admin-editable field.
   */
  const previewActualService =
    isBatchScope ?
      suggestedServiceCents
    : hasPreviewInput ? parseUsdToCents(actualServiceUsd)
    : 0;

  const previewActual = useMemo(
    () => ({
      actualMerchandiseCents: previewActualMerch,
      actualShippingCents: previewActualShip,
      actualTaxCents: previewActualTax,
      actualServiceCents: previewActualService,
    }),
    [
      previewActualMerch,
      previewActualShip,
      previewActualTax,
      previewActualService,
    ],
  );

  const previewGrossDelta = useMemo(
    () =>
      retailerVariableDeltaCents({
        checkoutMerchandiseCents,
        checkoutShippingCents,
        checkoutTaxCents,
        checkoutServiceCents,
        ...previewActual,
      }),
    [
      checkoutMerchandiseCents,
      checkoutShippingCents,
      checkoutTaxCents,
      checkoutServiceCents,
      previewActual,
    ],
  );

  const paidTopupNetCents = useMemo(
    () => (row ? merchandiseTopupPaidNetCents(row) : 0),
    [row],
  );

  /** Remaining due after any paid top-up(s); drives delta / message / top-up. */
  const previewDelta = useMemo(
    () =>
      remainingMerchandiseTopupCents({
        grossDeltaCents: previewGrossDelta,
        paidNetCents: paidTopupNetCents,
      }),
    [previewGrossDelta, paidTopupNetCents],
  );

  /**
   * Top-up amount for Request top-up actions. When actual inputs are cleared
   * (e.g. after revoke), fall back to the saved reconciliation delta so the
   * admin can still act after the customer chooses “pay the difference”.
   */
  const actionTopupDueCents = useMemo(() => {
    if (hasPreviewInput) return Math.max(0, previewDelta);
    if (!row) return 0;
    return remainingMerchandiseTopupCents({
      grossDeltaCents: row.deltaCents,
      paidNetCents: paidTopupNetCents,
    });
  }, [hasPreviewInput, previewDelta, row, paidTopupNetCents]);

  /**
   * Latest customer choice that answers the most recent Informing prompt.
   * A new Informing message clears this until they decide again.
   */
  const customerPriceDecision = useMemo(
    () => latestMerchandisePriceDecisionFromMessages(ticketMessages),
    [ticketMessages],
  );

  useEffect(() => {
    // New customer choice replaces any admin override.
    setAdminForceCancelRefund(false);
  }, [customerPriceDecision]);

  const decisionSectionLabel = paidTopupNetCents > 0 ? "3" : "2";
  const canActOnCustomerDecision =
    !!row &&
    row.status !== "cancelled" &&
    row.status !== "topup_paid" &&
    row.status !== "matched";

  const showCancelRefundUi =
    canActOnCustomerDecision &&
    row?.status !== "topup_pending" &&
    (adminForceCancelRefund || customerPriceDecision === "cancel");

  const showTopupRequestUi =
    canActOnCustomerDecision &&
    customerPriceDecision === "topup" &&
    row?.status !== "topup_pending" &&
    !adminForceCancelRefund;

  const customerDecisionHeader = (
    <div className="flex items-center justify-between gap-2">
      <p className="min-w-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {decisionSectionLabel}. Customer decision
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending || loading}
        onClick={onHardRefresh}
        className="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
        title="Reload conversation and reconciliation from the server"
      >
        <RefreshCw
          className={cn("size-3", loading && "animate-spin")}
          aria-hidden
        />
        Hard refresh
      </Button>
    </div>
  );

  /** Batch Actual subtotal is merch + ship + tax only (no S&H row). */
  const previewActualTotal =
    isBatchScope ?
      previewActual.actualMerchandiseCents +
      previewActual.actualShippingCents +
      previewActual.actualTaxCents
    : actualRetailerVariableCents(previewActual);
  const checkoutTotalForSummary =
    customerCheckoutTotalCents ?? linePriceCents;
  const newTotalAfterPaidTopup =
    checkoutTotalForSummary + paidTopupNetCents;
  /**
   * Last requested/collected installment (topupAmountCents stays on the row after
   * mark-paid). Prior payments = paid total − that installment.
   */
  const priorPaidInstallmentCents = useMemo(() => {
    if (!row || paidTopupNetCents <= 0) return 0;
    const latest = Math.max(0, row.topupAmountCents ?? 0);
    if (latest <= 0 || latest >= paidTopupNetCents) return 0;
    return paidTopupNetCents - latest;
  }, [row, paidTopupNetCents]);

  const checkoutBreakdown = {
    merchandiseCents: checkoutMerchandiseCents,
    shippingCents: checkoutShippingCents,
    taxCents: checkoutTaxCents,
    serviceCents: checkoutServiceCents,
  };
  const actualBreakdown = {
    merchandiseCents: previewActual.actualMerchandiseCents,
    shippingCents: previewActual.actualShippingCents,
    taxCents: previewActual.actualTaxCents,
    serviceCents: previewActual.actualServiceCents,
  };
  const visibleChargeRows = availableReconciliationChargeRows(
    checkoutBreakdown,
    actualBreakdown,
  );

  const relatedPayload = relatedOrderItemIds?.length
    ? { relatedOrderItemIds }
    : {};

  const messageProducts = useMemo(
    (): ReconciliationProductLineInput[] =>
      products && products.length > 0 ?
        products
      : [
          {
            productName,
            productNumber: orderItemId,
            quantity,
            checkoutMerchandiseCents,
            checkoutShippingCents,
            checkoutTaxCents,
            checkoutServiceCents,
          },
        ],
    [
      products,
      productName,
      orderItemId,
      quantity,
      checkoutMerchandiseCents,
      checkoutShippingCents,
      checkoutTaxCents,
      checkoutServiceCents,
    ],
  );

  const populatedMessage = useMemo(() => {
    const checkout = {
      merchandiseCents: checkoutMerchandiseCents,
      shippingCents: checkoutShippingCents,
      taxCents: checkoutTaxCents,
      serviceCents: checkoutServiceCents,
    };
    const actual = {
      merchandiseCents: previewActual.actualMerchandiseCents,
      shippingCents: previewActual.actualShippingCents,
      taxCents: previewActual.actualTaxCents,
      serviceCents: previewActual.actualServiceCents,
    };
    if (isBatchScope) {
      return buildBatchReconciliationCustomerMessage({
        productName,
        customerName: customerDisplayName,
        products: messageProducts,
        checkout,
        actual,
        paidTopupCents: paidTopupNetCents,
      });
    }
    return buildSingleReconciliationCustomerMessage({
      productName,
      customerName: customerDisplayName,
      products: messageProducts.slice(0, 1),
      productLines,
      paidTopupCents: paidTopupNetCents,
      checkout,
      actual,
    });
  }, [
    productName,
    isBatchScope,
    customerDisplayName,
    messageProducts,
    productLines,
    checkoutMerchandiseCents,
    checkoutShippingCents,
    checkoutTaxCents,
    checkoutServiceCents,
    previewActual,
    paidTopupNetCents,
  ]);

  /** Seed first-message draft once when name arrives (avoid HMR/render churn). */
  useEffect(() => {
    if (dialogueTicketId) return;
    if (row?.customerMessage) return;
    if (!customerDisplayName?.trim()) return;
    setMessage((prev) => (prev.trim() ? prev : populatedMessage));
    // Only re-seed when the customer name becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: don't re-run on every draft/cost change
  }, [customerDisplayName, dialogueTicketId, row?.customerMessage]);

  const recordPayload = () => ({
    orderItemId,
    checkoutMerchandiseCents,
    checkoutShippingCents,
    checkoutTaxCents,
    checkoutServiceCents,
    ...previewActual,
    ...relatedPayload,
  });

  const onSaveCost = () => {
    startTransition(async () => {
      const res = await recordMerchandiseReconciliationAction(recordPayload());
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRow(res.reconciliation);
      setMessage(populatedMessage);
      toast.success(res.message);
    });
  };

  const openMessageDialog = () => {
    setMessage(populatedMessage);
    setMessageDialogOpen(true);
  };

  const sendInitialCustomerMessage = async (
    payload: SupportTicketComposePayload,
  ) => {
    const body = payload.body.trim() || message.trim();
    if (!body) {
      toast.error("Enter a message.");
      throw new Error("Empty message");
    }
    const saved = await recordMerchandiseReconciliationAction(recordPayload());
    if (!saved.ok) {
      toast.error(saved.message);
      throw new Error(saved.message);
    }
    setRow(saved.reconciliation);
    const res = await notifyMerchandisePriceChangeAction({
      orderItemId,
      message: body,
      imageUrls: payload.imageUrls,
      ...relatedPayload,
    });
    if (!res.ok) {
      toast.error(res.message);
      throw new Error(res.message);
    }
    setRow(res.reconciliation);
    setMessage(body);
    await load();
    toast.success(res.message);
  };

  const onNotifyCompose = async (payload: SupportTicketComposePayload) => {
    await sendInitialCustomerMessage(payload);
  };

  const onAdminThreadReply = async (payload: SupportTicketComposePayload) => {
    const ticketId = dialogueTicketId ?? row?.supportTicketId;
    if (!ticketId) {
      toast.error("No support conversation yet.");
      throw new Error("No ticket");
    }
    const res = await adminReplySupportTicketAction({
      ticketId,
      body: payload.body,
      imageUrls: payload.imageUrls,
      productLinks: payload.productLinks,
    });
    if (!res.ok) {
      toast.error(res.message);
      throw new Error(res.message);
    }
    setReplyDraft("");
    toast.success(res.message);
    await load();
  };

  const buildAgreeToPayTemplate = useCallback(
    (opts?: {
      topupAmountCents?: number;
      expiresAtIso?: string | null;
      priorPaidCents?: number;
    }) => {
      const amount =
        opts?.topupAmountCents ??
        Math.max(
          0,
          remainingMerchandiseTopupCents({
            grossDeltaCents: previewDelta,
            paidNetCents: paidTopupNetCents,
          }),
        );
      const priorPaid = opts?.priorPaidCents ?? paidTopupNetCents;
      const expiresAtIso =
        opts?.expiresAtIso ??
        row?.topupExpiresAt ??
        new Date(
          Date.now() + MERCHANDISE_TOPUP_DEFAULT_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString();
      const productLabel =
        isBatchScope ?
          productName.trim() || "your batch order"
        : productName.trim() || "your product";
      if (priorPaid > 0) {
        return defaultMerchandiseAdditionalTopupMessage({
          productName: productLabel,
          topupNumber: formatMerchandiseTopupNumber(row?.id ?? orderItemId),
          additionalTopupCents: amount,
          priorPaidTopupCents: priorPaid,
          checkoutSubtotalCents: checkoutTotalForSummary,
          merchandiseOrderId: merchandiseOrderId ?? orderItemId,
          expiresAtIso,
          batchNumber: isBatchScope ? "batch order" : null,
        });
      }
      return defaultMerchandiseTopupMessage({
        productName: productLabel,
        topupAmountCents: amount,
        expiresAtIso,
      });
    },
    [
      previewDelta,
      paidTopupNetCents,
      row?.topupExpiresAt,
      row?.id,
      isBatchScope,
      productName,
      orderItemId,
      checkoutTotalForSummary,
      merchandiseOrderId,
    ],
  );

  const buildCompletedCheckoutTemplate = useCallback(() => {
    if (!row || paidTopupNetCents <= 0) {
      return "Customer has not completed a top-up checkout yet.";
    }
    const thisPaid =
      priorPaidInstallmentCents > 0 ?
        Math.max(0, paidTopupNetCents - priorPaidInstallmentCents)
      : Math.max(0, row.topupAmountCents ?? paidTopupNetCents);
    const productNames =
      messageProducts.length > 0 ?
        messageProducts.map((p) => p.productName.trim() || "Order product")
      : [productName.trim() || "Order product"];
    return defaultMerchandiseTopupPaidMessage({
      topupNumber: formatMerchandiseTopupNumber(row.id),
      topupAmountCents: thisPaid > 0 ? thisPaid : paidTopupNetCents,
      priorPaidTopupCents: priorPaidInstallmentCents,
      topupCheckoutOrderId: row.topupCheckoutOrderId,
      merchandiseOrderId: merchandiseOrderId ?? "—",
      batchNumber: isBatchScope ? "batch order" : null,
      productNames,
      checkoutSubtotalCents: checkoutTotalForSummary,
      newTotalCents: newTotalAfterPaidTopup,
    });
  }, [
    row,
    paidTopupNetCents,
    priorPaidInstallmentCents,
    messageProducts,
    productName,
    merchandiseOrderId,
    isBatchScope,
    checkoutTotalForSummary,
    newTotalAfterPaidTopup,
  ]);

  const applyMessageTemplate = useCallback(
    (templateId: MerchandiseTopupMessageTemplateId) => {
      let text = "";
      if (templateId === "informing") {
        text = populatedMessage;
        // Always include decision checkboxes on price-up informing messages.
        const dueForPrompt =
          hasPreviewInput ? previewDelta : actionTopupDueCents;
        if (
          dueForPrompt > 0 &&
          !messageBodyHasMerchandisePriceDecisionPrompt(text)
        ) {
          text = `${text.trimEnd()}\n\n${formatMerchandisePriceDecisionPromptLines().join("\n")}\n`;
        }
      } else if (templateId === "agree_to_pay") {
        text = buildAgreeToPayTemplate();
      } else {
        text = buildCompletedCheckoutTemplate();
      }
      if (dialogueTicketId) {
        setReplyDraft(text);
      } else {
        setMessage(text);
      }
      toast.message("Message template inserted — review and send when ready.");
    },
    [
      populatedMessage,
      buildAgreeToPayTemplate,
      buildCompletedCheckoutTemplate,
      dialogueTicketId,
      hasPreviewInput,
      previewDelta,
      actionTopupDueCents,
    ],
  );

  /** Auto-message templates only when a price-up top-up is in play. */
  const showTopupAutoMessageDropdown =
    row?.status !== "cancelled" &&
    (row?.status === "topup_pending" || actionTopupDueCents > 0);

  const messageTemplateSelect =
    showTopupAutoMessageDropdown ?
      <MerchandiseTopupMessageTemplateSelect
        disabled={pending || loading}
        showAgreeToPay={
          actionTopupDueCents > 0 || row?.status === "topup_pending"
        }
        showCompletedCheckout={paidTopupNetCents > 0}
        onSelect={applyMessageTemplate}
      />
    : null;

  const onRequestTopup = () => {
    startTransition(async () => {
      const priorPaidBefore = paidTopupNetCents;
      const res = await requestMerchandiseTopupAction({
        orderItemId,
        postCustomerMessage: false,
        ...relatedPayload,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRow(res.reconciliation);
      const remaining = remainingMerchandiseTopupCents({
        grossDeltaCents: res.reconciliation.deltaCents,
        paidNetCents: merchandiseTopupPaidNetCents(res.reconciliation),
      });
      const agreeDraft = buildAgreeToPayTemplate({
        topupAmountCents:
          remaining > 0 ?
            remaining
          : Math.max(0, res.reconciliation.topupAmountCents ?? 0),
        expiresAtIso: res.reconciliation.topupExpiresAt,
        priorPaidCents: priorPaidBefore,
      });
      setReplyDraft(agreeDraft);
      setMessage(agreeDraft);
      toast.success(
        "Top-up charge created. Agree to pay message drafted — send when ready.",
      );
      await load();
    });
  };

  const onConfirmRevokeTopup = () => {
    startTransition(async () => {
      const res = await revokeMerchandiseTopupAction({
        orderItemId,
        ...relatedPayload,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRevokeTopupConfirmOpen(false);
      setRow(res.reconciliation);
      setReplyDraft(res.draftCustomerMessage);
      setMessage(res.draftCustomerMessage);
      toast.success(res.message);
      await load();
      // Clear Actual / Updated Charges inputs for a fresh entry.
      setActualMerchUsd("");
      setActualShipUsd("");
      setActualTaxUsd("");
      setActualServiceUsd("");
      setServiceManual(false);
      setUnitsPerPackManual(false);
    });
  };

  const onMarkTopupPaid = () => {
    startTransition(async () => {
      const res = await markMerchandiseTopupPaidAction({
        orderItemId,
        ...relatedPayload,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRow(res.reconciliation);
      toast.success(res.message);
    });
  };

  const onCancelRefund = () => {
    const refundAmountCents = parseUsdToCents(refundUsd);
    if (refundAmountCents < 1) {
      toast.error("Enter a refund amount.");
      return;
    }
    startTransition(async () => {
      const res = await cancelMerchandiseReconciliationWithRefundAction({
        orderItemId,
        refundAmountCents,
        ...relatedPayload,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setRow(res.reconciliation);
      toast.success(res.message);
    });
  };

  const cancelled = row?.status === "cancelled";
  const showSendMessage = hasPreviewInput && previewDelta !== 0 && !cancelled;

  return (
    <section
      className={cn(
        "space-y-3 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] p-3",
        compact && "p-2.5",
      )}
    >
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/90">
          Retailer price reconciliation
        </p>
        <p className="text-[11px] text-muted-foreground">
          Merchandise, shipping, and sales tax can change.
          {isBatchScope ?
            " For batches, service & handling stays on the checkout side only — enter actual merchandise, shipping, and tax for the whole batch."
          : " Service & handling is suggested from fee tiers and can be adjusted."}
        </p>
        {customerCheckoutTotalCents != null || linePriceCents > 0 ?
          <div className="space-y-0.5 text-xs text-foreground">
            <p>
              Customer checkout total:{" "}
              <span className="font-semibold tabular-nums">
                {formatUsd(checkoutTotalForSummary)}
              </span>
            </p>
            {paidTopupNetCents > 0 ?
              <>
                <p>
                  Top-up add-on (paid):{" "}
                  <span className="font-semibold tabular-nums">
                    {formatUsd(paidTopupNetCents)}
                  </span>
                </p>
                <p>
                  New total:{" "}
                  <span className="font-semibold tabular-nums text-emerald-400">
                    {formatUsd(newTotalAfterPaidTopup)}
                  </span>
                </p>
                {hasPreviewInput && previewDelta !== 0 ?
                  <p>
                    {previewDelta > 0 ? "Still due after top-up: " : "Credit vs new total: "}
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        previewDelta > 0 ? "text-rose-300" : "text-sky-300",
                      )}
                    >
                      {previewDelta > 0 ? "+" : "−"}
                      {formatUsd(Math.abs(previewDelta))}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      (actual {formatUsd(previewActualTotal)} − new total{" "}
                      {formatUsd(newTotalAfterPaidTopup)})
                    </span>
                  </p>
                : null}
              </>
            : null}
          </div>
        : null}
        {row ?
          <p className="text-xs font-medium text-foreground">
            Status: {statusLabel(row.status)}
          </p>
        : null}
        {gate.ok ?
          <p className="text-xs font-medium text-emerald-400">
            Purchase approval unlocked
            {isBatchScope ? " for this batch" : " for this line"}.
          </p>
        : row ?
          <p className="text-xs text-amber-100/90">{gate.message}</p>
        : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 rounded-md border border-border/50 bg-background/40 p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Checkout (customer paid)
          </p>
          <dl className="space-y-1 text-xs">
            {visibleChargeRows.map((r) => {
              const showBatchServiceBreakdown =
                r.key === "service" &&
                isBatchScope &&
                (products?.length ?? 0) > 1;
              if (showBatchServiceBreakdown) {
                const serviceLines = (products ?? []).filter(
                  (p) => Math.max(0, Math.round(p.checkoutServiceCents ?? 0)) > 0,
                );
                return (
                  <div key={r.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                        <span className="min-w-0">{r.label}</span>
                        <button
                          type="button"
                          aria-expanded={checkoutServiceOpen}
                          onClick={() => setCheckoutServiceOpen((v) => !v)}
                          className={cn(
                            "inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors",
                            "hover:border-border hover:bg-muted hover:text-foreground",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            checkoutServiceOpen &&
                              "border-primary/40 bg-primary/10 text-foreground",
                          )}
                          title={
                            checkoutServiceOpen ?
                              "Hide S&H by product"
                            : "Show S&H by product"
                          }
                        >
                          <ChevronDownIcon
                            className={cn(
                              "size-3.5 transition-transform",
                              checkoutServiceOpen && "rotate-180",
                            )}
                            aria-hidden
                          />
                          <span className="sr-only">
                            {checkoutServiceOpen ? "Hide" : "Show"} service
                            &amp; handling by product
                          </span>
                        </button>
                      </dt>
                      <dd className="tabular-nums font-medium">
                        {formatUsd(r.checkoutCents)}
                      </dd>
                    </div>
                    {checkoutServiceOpen ?
                      <div className="space-y-1 rounded-md border border-border/50 bg-background/50 px-2.5 py-2">
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          What makes up this figure
                        </p>
                        <ul className="space-y-1">
                          {(serviceLines.length > 0 ?
                            serviceLines
                          : (products ?? [])
                          ).map((p, i) => {
                            const qty = Math.max(
                              0,
                              Math.floor(p.quantity ?? 0),
                            );
                            const serviceCents = Math.max(
                              0,
                              Math.round(p.checkoutServiceCents ?? 0),
                            );
                            const merchCents = Math.max(
                              0,
                              Math.round(p.checkoutMerchandiseCents ?? 0),
                            );
                            const unitMerch =
                              qty > 0 ? Math.round(merchCents / qty) : 0;
                            const unitFee =
                              unitMerch > 0 ?
                                serviceHandlingFeePerUnitCents(
                                  unitMerch,
                                  serviceTiers,
                                )
                              : 0;
                            const name =
                              p.productName.trim() || `Product ${i + 1}`;
                            return (
                              <li
                                key={p.productNumber ?? `${name}-${i}`}
                                className="flex justify-between gap-2 text-muted-foreground"
                              >
                                <span className="min-w-0">
                                  <span className="line-clamp-1 text-foreground/90">
                                    {name}
                                  </span>
                                  <span className="mt-0.5 block text-[10px] tabular-nums opacity-80">
                                    {qty > 0 ? `Qty ${qty}` : "Qty —"}
                                    {unitFee > 0 && qty > 0 ?
                                      ` · ${formatUsd(unitFee)}/unit`
                                    : null}
                                    {merchCents > 0 ?
                                      ` · merch ${formatUsd(merchCents)}`
                                    : null}
                                  </span>
                                </span>
                                <span className="shrink-0 tabular-nums font-medium text-foreground">
                                  {formatUsd(serviceCents)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        <p className="border-t border-border/50 pt-1 text-[10px] text-muted-foreground">
                          Checkout S&amp;H is the sum of each batch product&apos;s
                          quantity × fee tier.
                        </p>
                      </div>
                    : null}
                  </div>
                );
              }
              return (
                <div key={r.key} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{r.label}</dt>
                  <dd className="tabular-nums font-medium">
                    {formatUsd(r.checkoutCents)}
                  </dd>
                </div>
              );
            })}
            <div className="flex justify-between gap-2 border-t border-border/60 pt-1">
              <dt className="font-medium text-foreground">Subtotal</dt>
              <dd className="tabular-nums font-semibold">
                {formatUsd(checkoutVariableCents)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-2 rounded-md border border-border/50 bg-background/40 p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Actual / updated charges
          </p>
          {(checkoutMerchandiseCents > 0 ||
            previewActualMerch > 0 ||
            actualMerchUsd.trim() !== "") && (
            <div className="space-y-1.5">
              <Label htmlFor={`actual-merch-${orderItemId}`} className="text-xs">
                Merchandise
              </Label>
              <Input
                id={`actual-merch-${orderItemId}`}
                inputMode="decimal"
                placeholder="0.00"
                value={actualMerchUsd}
                onChange={(e) => {
                  setActualMerchUsd(e.target.value);
                  if (!isBatchScope) setServiceManual(false);
                }}
                disabled={pending || loading || cancelled}
              />
            </div>
          )}
          {!isBatchScope &&
            (checkoutServiceCents > 0 ||
              previewActualService > 0 ||
              actualServiceUsd.trim() !== "") && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">
                  Service &amp; handling
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor={`actual-service-${orderItemId}`}
                      className="text-[10px] text-muted-foreground"
                    >
                      S&amp;H fee
                    </Label>
                    <Input
                      id={`actual-service-${orderItemId}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={actualServiceUsd}
                      onChange={(e) => {
                        setServiceManual(true);
                        setActualServiceUsd(e.target.value);
                      }}
                      disabled={pending || loading || cancelled}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`units-per-pack-${orderItemId}`}
                      className="text-[10px] text-muted-foreground"
                    >
                      Pack #
                    </Label>
                    <Input
                      id={`units-per-pack-${orderItemId}`}
                      inputMode="numeric"
                      placeholder="1"
                      value={unitsPerPackInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d]/g, "");
                        setUnitsPerPackManual(true);
                        setUnitsPerPackInput(raw);
                        setServiceManual(false);
                      }}
                      disabled={pending || loading || cancelled}
                      className="tabular-nums"
                      aria-label="Consumer units per pack"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Editable. Tier suggestion:{" "}
                  <span className="tabular-nums text-foreground">
                    {formatUsd(suggestedServiceCents)}
                  </span>
                  {consumerUnits > 1 && suggestedPerUnitFeeCents > 0 ?
                    ` (${formatUsd(suggestedPerUnitFeeCents)} × ${consumerUnits} units${
                      unitsPerPack > 1 ?
                        packCount > 1 ?
                          `; ${packCount} packs × ${unitsPerPack}/pack`
                        : `; ${unitsPerPack}-pack`
                      : ""
                    })`
                  : packCount > 0 ?
                    ` (${packCount}× unit fee)`
                  : ""}
                  . Change merchandise or pack # to refresh the suggestion.
                </p>
              </div>
            )}
          {(checkoutShippingCents > 0 ||
            previewActualShip > 0 ||
            actualShipUsd.trim() !== "") && (
            <div className="space-y-1.5">
              <Label htmlFor={`actual-ship-${orderItemId}`} className="text-xs">
                Shipping
              </Label>
              <Input
                id={`actual-ship-${orderItemId}`}
                inputMode="decimal"
                placeholder="0.00"
                value={actualShipUsd}
                onChange={(e) => setActualShipUsd(e.target.value)}
                disabled={pending || loading || cancelled}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`actual-tax-${orderItemId}`} className="text-xs">
              Sales tax
            </Label>
            <Input
              id={`actual-tax-${orderItemId}`}
              inputMode="decimal"
              placeholder="0.00"
              value={actualTaxUsd}
              onChange={(e) => setActualTaxUsd(e.target.value)}
              disabled={pending || loading || cancelled}
            />
            {checkoutTaxCents === 0 ?
              <p className="text-[10px] text-muted-foreground">
                Checkout had no sales tax line — enter actual retailer tax if
                charged.
              </p>
            : null}
          </div>
          <p className="text-xs tabular-nums text-foreground">
            Actual subtotal:{" "}
            <span className="font-semibold">
              {hasPreviewInput ? formatUsd(previewActualTotal) : "—"}
            </span>
          </p>
        </div>
      </div>

      {hasPreviewInput ?
        <p
          className={cn(
            "text-xs tabular-nums",
            previewDelta > 0 && "text-rose-300",
            previewDelta < 0 && "text-sky-300",
            previewDelta === 0 && "text-emerald-300",
          )}
        >
          {paidTopupNetCents > 0 ?
            <>
              Remaining vs new total: {previewDelta >= 0 ? "+" : "−"}
              {formatUsd(Math.abs(previewDelta))}{" "}
              {previewDelta > 0 ?
                "(additional top-up or cancel)"
              : previewDelta < 0 ?
                "(below new total — review refund)"
              : "(covered by paid top-up — purchase allowed)"}
            </>
          : <>
              Delta: {previewDelta >= 0 ? "+" : "−"}
              {formatUsd(Math.abs(previewDelta))}{" "}
              {previewDelta > 0 ?
                "(price up — top-up or cancel)"
              : previewDelta < 0 ?
                "(price down — do not buy; cancel + refund)"
              : "(match — buy as normal)"}
            </>
          }
        </p>
      : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending || loading || cancelled}
          onClick={onSaveCost}
        >
          {pending ? "Saving…" : row ? "Update actual costs" : "Save actual costs"}
        </Button>
        {showSendMessage ?
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || loading}
            onClick={openMessageDialog}
          >
            <MessageSquare className="size-3.5" aria-hidden />
            {isBatchScope ? "Message batch" : "Message product"}
          </Button>
        : null}
      </div>

      {isBatchScope ?
        <AdminBatchReconciliationMessageDialog
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
          orderItemId={orderItemId}
          batchLabel={productName}
          customerDisplayName={customerDisplayName}
          products={messageProducts}
          checkout={checkoutBreakdown}
          actual={actualBreakdown}
          dialogueTicketId={dialogueTicketId}
          ticketMessages={ticketMessages}
          message={message}
          onMessageChange={setMessage}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
          onSendInitial={sendInitialCustomerMessage}
          onReply={onAdminThreadReply}
          pending={pending}
          composeTrailingActions={messageTemplateSelect}
        />
      : <AdminSingleReconciliationMessageDialog
          open={messageDialogOpen}
          onOpenChange={setMessageDialogOpen}
          orderItemId={orderItemId}
          productName={productName}
          customerDisplayName={customerDisplayName}
          dialogueTicketId={dialogueTicketId}
          ticketMessages={ticketMessages}
          message={message}
          onMessageChange={setMessage}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
          onSendInitial={sendInitialCustomerMessage}
          onReply={onAdminThreadReply}
          pending={pending}
          composeTrailingActions={messageTemplateSelect}
        />
      }

      {row &&
      row.status !== "cancelled" &&
      (row.deltaCents !== 0 || dialogueTicketId) ?
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              1. Message customer — {isBatchScope ? "batch" : "product"}
              {customerDisplayName ? ` · ${customerDisplayName}` : ""}
            </p>
            <button
              type="button"
              aria-expanded={messageCustomerOpen}
              onClick={() => {
                const next = !messageCustomerOpen;
                setMessageCustomerOpen(next);
                if (next) void refreshMessages();
              }}
              className={cn(
                "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background/60 text-muted-foreground transition-colors",
                "hover:border-border hover:bg-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                messageCustomerOpen &&
                  "border-primary/40 bg-primary/10 text-foreground",
              )}
              title={
                messageCustomerOpen ?
                  "Hide message customer"
                : "Show message customer"
              }
            >
              <ChevronDownIcon
                className={cn(
                  "size-3.5 transition-transform",
                  messageCustomerOpen && "rotate-180",
                )}
                aria-hidden
              />
              <span className="sr-only">
                {messageCustomerOpen ? "Hide" : "Show"} message customer
              </span>
            </button>
          </div>
          {messageCustomerOpen ?
            dialogueTicketId ?
              <div className="space-y-3">
                <div className="max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card sm:max-h-80">
                  <SupportTicketThread
                    messages={ticketMessages}
                    viewerIsStaff
                    customerLabel={customerDisplayName ?? "Customer"}
                    className="border-0 bg-transparent"
                  />
                </div>
                <SupportTicketComposeForm
                  textareaId={`merch-msg-reply-${orderItemId}`}
                  label="Reply in this conversation"
                  placeholder="Type a follow-up…"
                  submitLabel="Send reply"
                  ticketId={dialogueTicketId}
                  body={replyDraft}
                  onBodyChange={setReplyDraft}
                  onSubmit={onAdminThreadReply}
                  disabled={pending || loading}
                  trailingActions={messageTemplateSelect}
                />
              </div>
            : <div className="space-y-2">
                <SupportTicketComposeForm
                  textareaId={`merch-msg-${orderItemId}`}
                  label="First message"
                  placeholder="Edit the price-update message…"
                  submitLabel="Send message & await directive"
                  body={message}
                  onBodyChange={setMessage}
                  onSubmit={onNotifyCompose}
                  disabled={pending || loading}
                  trailingActions={messageTemplateSelect}
                />
              </div>
          : null}

          {/* Driven by the customer’s thread choice (top-up ☑ vs cancel ☑). */}
          {canActOnCustomerDecision &&
          row.status === "customer_notified" &&
          !customerPriceDecision &&
          (actionTopupDueCents > 0 || (hasPreviewInput && previewDelta > 0)) ?
            <div className="space-y-1 border-t border-border/60 pt-3">
              {customerDecisionHeader}
              <p className="text-xs text-muted-foreground">
                Waiting for the customer to choose pay the difference (top-up) or
                cancel for a refund in this conversation.
              </p>
            </div>
          : null}

          {showTopupRequestUi ?
            <div className="space-y-2 border-t border-border/60 pt-3">
              {customerDecisionHeader}
              <p className="text-xs text-emerald-200/90">
                Customer chose pay the difference (top-up).
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={`outcome-topup-${orderItemId}`}
                    checked
                    readOnly
                    disabled={pending}
                  />
                  Request top-up (
                  {formatUsd(
                    actionTopupDueCents > 0 ?
                      actionTopupDueCents
                    : Math.max(0, previewDelta),
                  )}
                  )
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {actionTopupDueCents < 1 && previewDelta < 1 ?
                  <p className="text-xs text-muted-foreground">
                    Update actual costs above, then request the top-up here.
                  </p>
                : <Button
                    type="button"
                    size="sm"
                    disabled={pending || actionTopupDueCents < 1}
                    onClick={onRequestTopup}
                  >
                    Request top-up
                  </Button>
                }
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setAdminForceCancelRefund(true)}
                  className="text-xs font-medium text-rose-300 underline-offset-2 hover:text-rose-200 hover:underline disabled:opacity-50"
                >
                  Cancel / refund
                </button>
              </div>
            </div>
          : null}

          {showCancelRefundUi ?
            <div className="space-y-2 border-t border-border/60 pt-3">
              {customerDecisionHeader}
              <p className="text-xs text-sky-200/90">
                {customerPriceDecision === "cancel" ?
                  "Customer chose cancel for a refund. Do not purchase — cancel and refund (full or partial)."
                : "Cancel and refund (full or partial). Do not purchase."}
              </p>
              <Label
                htmlFor={`cancel-refund-${orderItemId}`}
                className="text-xs"
              >
                Refund amount (USD)
              </Label>
              <Input
                id={`cancel-refund-${orderItemId}`}
                inputMode="decimal"
                value={refundUsd}
                onChange={(e) => setRefundUsd(e.target.value)}
                disabled={pending}
              />
              {paidTopupNetCents > 0 ?
                <p className="text-[11px] text-amber-200/90">
                  Paid top-up add-on of {formatUsd(paidTopupNetCents)} will also
                  be refunded automatically
                  {isBatchScope ? " for this batch" : " for this product"}.
                </p>
              : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={openMessageDialog}
                >
                  Message customer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={onCancelRefund}
                >
                  Cancel &amp; refund
                </Button>
                {customerPriceDecision === "topup" && adminForceCancelRefund ?
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setAdminForceCancelRefund(false)}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    Back to request top-up
                  </button>
                : null}
              </div>
            </div>
          : null}

          {row.status === "topup_pending" ?
            <div className="space-y-2 border-t border-border/60 pt-3">
              {customerDecisionHeader}
              <p className="text-xs text-emerald-200/90">
                Top-up requested
                {actionTopupDueCents > 0 || (row.topupAmountCents ?? 0) > 0 ?
                  ` (${formatUsd(
                    actionTopupDueCents > 0 ?
                      actionTopupDueCents
                    : Math.max(0, row.topupAmountCents ?? 0),
                  )})`
                : ""}
                . Waiting for payment.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled>
                  Top-up already requested
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={onMarkTopupPaid}
                >
                  Mark top-up paid
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setRevokeTopupConfirmOpen(true)}
                  className="border-rose-500/40 text-rose-200 hover:bg-rose-500/10 hover:text-rose-100"
                >
                  Revoke top-up request
                </Button>
              </div>
              {row.topupExpiresAt ?
                <p className="w-full text-[11px] text-muted-foreground">
                  Top-up expires{" "}
                  {new Date(row.topupExpiresAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              : null}
            </div>
          : null}
        </div>
      : null}

      {row && paidTopupNetCents > 0 ?
        <div className="space-y-3 border-t border-border/60 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            2. Top-up add-on
          </p>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-3.5 py-3 shadow-sm ring-1 ring-emerald-500/15">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-background/50 text-emerald-400">
                    <CreditCard className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      Purchase price top-up — paid
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Customer completed checkout for this add-on charge.
                    </p>
                  </div>
                </div>
                <dl className="grid gap-1 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 text-xs sm:grid-cols-2">
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <dt className="text-muted-foreground">Top-up #</dt>
                    <dd className="font-mono font-medium tabular-nums text-foreground">
                      {formatMerchandiseTopupNumber(row.id)}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-1.5">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {formatUsd(paidTopupNetCents)}
                    </dd>
                  </div>
                  {row.topupCheckoutOrderId ?
                    <div className="flex flex-wrap items-baseline gap-x-1.5 sm:col-span-2">
                      <dt className="text-muted-foreground">Top-up order #</dt>
                      <dd
                        className="font-mono font-medium tabular-nums text-foreground"
                        title={row.topupCheckoutOrderId}
                      >
                        {row.topupCheckoutOrderId}
                      </dd>
                    </div>
                  : null}
                  {row.topupPaidAt ?
                    <div className="flex flex-wrap items-baseline gap-x-1.5 sm:col-span-2">
                      <dt className="text-muted-foreground">Paid</dt>
                      <dd className="text-foreground">
                        {new Date(row.topupPaidAt).toLocaleString()}
                      </dd>
                    </div>
                  : null}
                </dl>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-foreground">
                {formatUsd(paidTopupNetCents)}
              </p>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Checkout subtotal</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatUsd(checkoutTotalForSummary)}
                </span>
              </div>
              {paidTopupBreakdowns.length > 0 ?
                <div className="space-y-2">
                  {paidTopupBreakdowns.map((snap, index) => {
                    const checkout = {
                      merchandiseCents: snap.breakdown.checkoutMerchandiseCents,
                      shippingCents: snap.breakdown.checkoutShippingCents,
                      taxCents: snap.breakdown.checkoutTaxCents,
                      serviceCents: snap.breakdown.checkoutServiceCents,
                    };
                    const actual = {
                      merchandiseCents: snap.breakdown.actualMerchandiseCents,
                      shippingCents: snap.breakdown.actualShippingCents,
                      taxCents: snap.breakdown.actualTaxCents,
                      serviceCents: snap.breakdown.actualServiceCents,
                    };
                    const isLast = index === paidTopupBreakdowns.length - 1;
                    return (
                      <MerchandiseTopupAmountBreakdownToggle
                        key={snap.id}
                        label={
                          <span className="text-muted-foreground">
                            {paidTopupBreakdowns.length > 1 ?
                              `Top-up ${index + 1} add-on`
                            : "Top-up add-on"}
                          </span>
                        }
                        amountCents={snap.amountCents}
                        mode="paid"
                        priorPaidInstallmentCents={0}
                        checkoutSubtotalCents={checkoutTotalForSummary}
                        newTotalCents={
                          checkoutTotalForSummary +
                          paidTopupBreakdowns
                            .slice(0, index + 1)
                            .reduce((sum, s) => sum + s.amountCents, 0)
                        }
                        showBalanceBreakdown={isLast && hasPreviewInput}
                        balanceCents={isLast ? previewDelta : undefined}
                        checkout={checkout}
                        actual={actual}
                        defaultOpen={isLast}
                        footnote={
                          paidTopupBreakdowns.length > 1 ?
                            `Frozen copy from ${new Date(snap.createdAt).toLocaleString()}. Each top-up keeps its own breakdown.`
                          : `Frozen breakdown saved ${new Date(snap.createdAt).toLocaleString()}. A later top-up will store a separate copy.`
                        }
                      />
                    );
                  })}
                </div>
              : <MerchandiseTopupAmountBreakdownToggle
                  label={
                    <span className="text-muted-foreground">Top-up add-on</span>
                  }
                  amountCents={paidTopupNetCents}
                  mode="paid"
                  priorPaidInstallmentCents={priorPaidInstallmentCents}
                  checkoutSubtotalCents={checkoutTotalForSummary}
                  newTotalCents={newTotalAfterPaidTopup}
                  showBalanceBreakdown={hasPreviewInput}
                  balanceCents={previewDelta}
                  checkout={checkoutBreakdown}
                  actual={actualBreakdown}
                  footnote="Expand Previous top-up for the earlier payment; This for the latest; Balance for remaining due."
                />
              }
              <div className="flex items-baseline justify-between gap-3 border-t border-border/50 pt-2">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  New total
                </span>
                <span className="text-lg font-semibold tabular-nums tracking-tight text-emerald-400">
                  {formatUsd(newTotalAfterPaidTopup)}
                </span>
              </div>
              {hasPreviewInput ?
                <div className="flex items-baseline justify-between gap-3 pt-1">
                  <span className="text-muted-foreground">Actual subtotal</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatUsd(previewActualTotal)}
                  </span>
                </div>
              : null}
            </div>
          </div>
        </div>
      : null}

      {hasPreviewInput &&
      previewDelta < 0 &&
      row &&
      row.status !== "cancelled" &&
      !showCancelRefundUi ?
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs text-sky-200/90">
            Charges dropped — do not purchase. Cancel and refund (full or
            partial).
          </p>
          <Label htmlFor={`drop-refund-${orderItemId}`} className="text-xs">
            Refund amount (USD)
          </Label>
          <Input
            id={`drop-refund-${orderItemId}`}
            inputMode="decimal"
            value={refundUsd}
            onChange={(e) => setRefundUsd(e.target.value)}
            disabled={pending}
          />
          {paidTopupNetCents > 0 ?
            <p className="text-[11px] text-amber-200/90">
              Paid top-up add-on of {formatUsd(paidTopupNetCents)} will also be
              refunded automatically
              {isBatchScope ? " for this batch" : " for this product"}.
            </p>
          : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={openMessageDialog}
            >
              Message customer
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onCancelRefund}
            >
              Cancel &amp; refund
            </Button>
          </div>
        </div>
      : null}

      <AlertDialog
        open={revokeTopupConfirmOpen}
        onOpenChange={setRevokeTopupConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke top-up add-on request?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                This removes the unpaid purchase-price top-up
                {row?.topupAmountCents != null && row.topupAmountCents > 0 ?
                  <>
                    {" "}
                    of{" "}
                    <span className="font-medium text-foreground">
                      {formatUsd(row.topupAmountCents)}
                    </span>
                  </>
                : null}{" "}
                from the customer&apos;s Products (Active) add-on charges
                {isBatchScope ? " for this batch" : ""}.
              </span>
              <span className="block">
                After you confirm, a revoke message will be drafted in Reply —
                review it and send when ready. Previously paid top-ups are not
                refunded.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              render={
                <Button type="button" variant="destructive" disabled={pending} />
              }
              onClick={(event) => {
                event.preventDefault();
                onConfirmRevokeTopup();
              }}
            >
              {pending ? "Revoking…" : "Revoke top-up request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
