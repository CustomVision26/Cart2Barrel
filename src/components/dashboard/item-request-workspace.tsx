"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { compareRetailerPricesAction } from "@/actions/compare-retailer-prices";
import type { RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { draftItemRequestFromSerpApiAction } from "@/actions/customer-ai-item-draft";
import { fetchProductVariantsAction } from "@/actions/product-variants";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { ItemRequestProductVariants, VARIANT_APPLY_TOOLTIP } from "@/components/dashboard/item-request-product-variants";
import { createItemRequestAction } from "@/actions/item-request";
import { ItemRequestCompareRetailers } from "@/components/dashboard/item-request-compare-retailers";
import { uploadItemRequestProductImageAction } from "@/actions/upload-item-request-product-image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatUsd } from "@/lib/admin-markup";
import {
  spotlightFormSeedFromPrefill,
  spotlightPrefillMerchPreview,
  type SpotlightRequestPrefill,
} from "@/lib/spotlight-request-prefill";
import {
  COMPARE_REQUIRES_PRODUCT_NAME_MESSAGE,
  isProductNameReadyForCompare,
  MANUAL_PRODUCT_NAME_AFTER_BLOCKED_SCRAPE,
  MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT,
} from "@/lib/item-request-product-name-hint";
import { isRetailerPageFetchBlockedMessage } from "@/lib/ai/fetch-page-for-ai";
import {
  parseValidHttpsProductUrl,
  validateItemRequestRetailerUrl,
} from "@/lib/product-url/item-request-retailer-url";
import { findVariantMatchingColor } from "@/lib/product-variants/merge-walmart-variants";
import {
  dashItemsTableCardHeader,
  dashItemsTableStatusPanel,
  dashItemsTableToolbar,
} from "@/lib/app-table-surfaces";
import { cn } from "@/lib/utils";

function normalizeUrlInput(value: string): string {
  const t = value.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function urlsMatchForSubmit(previewRaw: string, productRaw: string): boolean {
  const a = normalizeUrlInput(previewRaw);
  const b = normalizeUrlInput(productRaw);
  if (!a || !b) return false;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return a === b;
  }
}

function parseQuantity(value: string): number | null {
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  return n;
}

function formatVariantsLoadedMessage(
  count: number,
  retailer: string,
  method: string,
): string {
  const countLabel =
    count === 1 ? "1 variant was" : `${count} variants were`;
  if (method.includes("page_ai")) {
    return `${countLabel} retrieved from ${retailer}. Where available, promotional prices were taken from the live store listing. Please verify all prices and availability on the retailer's website before submitting your request.`;
  }
  return `${countLabel} retrieved from ${retailer}. Listed prices are based on catalog data and may differ from current promotions or rollback pricing on the retailer's site. Please verify the current price on the store listing before submitting your request.`;
}

function isAiErrorMessage(message: string): boolean {
  const low = message.toLowerCase();
  return (
    low.includes("could not") ||
    low.includes("failed") ||
    low.includes("invalid") ||
    low.includes("enter a valid")
  );
}

function merchPreviewFromVariant(
  variant: ProductVariantOffer,
  q: number,
  productSize: string,
  productColor: string,
): {
  quantity: number;
  unitPriceCents: number;
  merchandiseSubtotalCents: number;
  variantSizeNorm: string;
  variantColorNorm: string;
} | null {
  if (variant.priceUsdCents == null) return null;
  return {
    quantity: q,
    unitPriceCents: variant.priceUsdCents,
    merchandiseSubtotalCents: variant.priceUsdCents * q,
    variantSizeNorm: (variant.size ?? productSize).trim().toLowerCase(),
    variantColorNorm: (variant.color ?? productColor).trim().toLowerCase(),
  };
}

/** Snapshot after a successful AI draft; used for merchandise preview + stale detection. */
type AiMerchPreviewState = {
  quantity: number;
  unitPriceCents: number | null;
  merchandiseSubtotalCents: number | null;
  variantSizeNorm: string;
  variantColorNorm: string;
};

type WorkspaceTab = "request" | "compare";

type ItemRequestWorkspaceProps = {
  /** Prefill URL from query string when spotlight row is not resolved. */
  initialProductUrl?: string;
  /** Full curated row from home spotlight (`spotlightProductId` + URL). */
  spotlightPrefill?: SpotlightRequestPrefill | null;
};

export function ItemRequestWorkspace({
  initialProductUrl,
  spotlightPrefill = null,
}: ItemRequestWorkspaceProps = {}) {
  const spotlightSeed = spotlightPrefill ?
    spotlightFormSeedFromPrefill(spotlightPrefill, 1)
  : null;

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isComparePending, startCompareTransition] = useTransition();
  const [isVariantsPending, startVariantsTransition] = useTransition();
  const [isApplyVariantPending, startApplyVariantTransition] = useTransition();
  const [applyingVariantId, setApplyingVariantId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("request");
  const [variantRows, setVariantRows] = useState<ProductVariantOffer[]>([]);
  const [variantRetailer, setVariantRetailer] = useState<string | null>(null);
  const [variantMethod, setVariantMethod] = useState<string | null>(null);
  const [variantsMessage, setVariantsMessage] = useState<string | null>(null);
  const [compareOffers, setCompareOffers] = useState<RetailerPriceOffer[]>([]);
  const [compareSearchQuery, setCompareSearchQuery] = useState<string | null>(
    null,
  );
  const [compareMessage, setCompareMessage] = useState<string | null>(null);
  const [isSpotlightFeed, setIsSpotlightFeed] = useState(Boolean(spotlightSeed));

  const [previewInput, setPreviewInput] = useState(spotlightSeed?.productUrl ?? "");

  const [productUrl, setProductUrl] = useState(spotlightSeed?.productUrl ?? "");
  const [productName, setProductName] = useState(spotlightSeed?.productName ?? "");
  const [productSize, setProductSize] = useState(spotlightSeed?.productSize ?? "");
  const [productColor, setProductColor] = useState(spotlightSeed?.productColor ?? "");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(
    spotlightSeed ?
      "Loaded from spotlight: review the fields below, then submit your request to staff."
    : null,
  );
  const [lastAiNotes, setLastAiNotes] = useState<string | null>(null);
  /** From last successful AI draft; sent on submit so DB stores retailer label. */
  const [draftSiteName, setDraftSiteName] = useState<string | null>(
    spotlightSeed?.draftSiteName ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined> | undefined
  >();
  const [formResetKey, setFormResetKey] = useState(0);
  /** From last AI draft — saved as https product_image_url on submit when present. */
  const [draftProductImageUrl, setDraftProductImageUrl] = useState<string | null>(
    spotlightSeed?.draftProductImageUrl ?? null,
  );
  const [aiMerchPreview, setAiMerchPreview] = useState<AiMerchPreviewState | null>(
    spotlightSeed?.aiMerchPreview ?? null,
  );
  const [pendingProductPhoto, setPendingProductPhoto] = useState<File | null>(
    null,
  );
  const productPhotoRef = useRef<HTMLInputElement>(null);
  const productLinkBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [productLinkFocused, setProductLinkFocused] = useState(false);
  const [urlSyncHintDismissed, setUrlSyncHintDismissed] = useState(false);
  const [spotlightPrefillDismissed, setSpotlightPrefillDismissed] = useState(false);

  const spotlightAppliedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!spotlightPrefill) {
      spotlightAppliedIdRef.current = null;
      setIsSpotlightFeed(false);
      const raw = initialProductUrl?.trim();
      if (!raw) return;
      const normalized = normalizeUrlInput(raw);
      if (!normalized) return;
      setPreviewInput(normalized);
      setProductUrl(normalized);
      return;
    }

    if (spotlightAppliedIdRef.current === spotlightPrefill.id) return;
    spotlightAppliedIdRef.current = spotlightPrefill.id;

    const seed = spotlightFormSeedFromPrefill(
      spotlightPrefill,
      parseQuantity(quantity) ?? 1,
    );
    const url = seed.productUrl.trim() ?
      normalizeUrlInput(seed.productUrl)
    : "";

    const q = parseQuantity(quantity) ?? 1;
    if (url) {
      setPreviewInput(url);
      setProductUrl(url);
    }
    setProductName(seed.productName);
    setProductSize(seed.productSize);
    setProductColor(seed.productColor);
    setDraftSiteName(seed.draftSiteName);
    setDraftProductImageUrl(seed.draftProductImageUrl);
    setPendingProductPhoto(null);
    const merch = spotlightPrefillMerchPreview(spotlightPrefill, q);
    setAiMerchPreview(merch);
    setAiMessage(
      merch ?
        "Loaded from spotlight: review the fields below, then submit your request to staff."
      : "Loaded from spotlight: review the link and details, then submit your request to staff.",
    );
    setIsSpotlightFeed(true);
    setSpotlightPrefillDismissed(false);
  }, [spotlightPrefill, initialProductUrl, quantity]);

  useEffect(() => {
    if (!isSpotlightFeed || !spotlightPrefill) return;
    const q = parseQuantity(quantity);
    if (q == null) return;
    setAiMerchPreview((prev) => {
      if (prev?.unitPriceCents != null) {
        return {
          ...prev,
          quantity: q,
          merchandiseSubtotalCents: prev.unitPriceCents * q,
        };
      }
      return spotlightPrefillMerchPreview(spotlightPrefill, q);
    });
  }, [quantity, isSpotlightFeed, spotlightPrefill]);

  const pricePreviewStale = useMemo(() => {
    if (!aiMerchPreview) return false;
    const q = parseQuantity(quantity);
    if (q !== aiMerchPreview.quantity) return true;
    if (productSize.trim().toLowerCase() !== aiMerchPreview.variantSizeNorm)
      return true;
    if (productColor.trim().toLowerCase() !== aiMerchPreview.variantColorNorm)
      return true;
    return false;
  }, [aiMerchPreview, quantity, productSize, productColor]);

  const syncPreviewAndProductLink = useCallback(() => {
    const fromPreview = normalizeUrlInput(previewInput);
    if (fromPreview) {
      setProductUrl(fromPreview);
      setUrlSyncHintDismissed(true);
      return;
    }
    const fromLink = normalizeUrlInput(productUrl);
    if (fromLink) {
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : fromLink);
      setUrlSyncHintDismissed(true);
    }
  }, [previewInput, productUrl]);

  useEffect(() => {
    setUrlSyncHintDismissed(false);
  }, [previewInput]);

  useEffect(() => {
    return () => {
      if (productLinkBlurTimeoutRef.current) {
        clearTimeout(productLinkBlurTimeoutRef.current);
      }
    };
  }, []);

  const runLoadVariants = useCallback(() => {
    setVariantsMessage(null);
    let storeUrl = normalizeUrlInput(previewInput);
    let linkUrl = normalizeUrlInput(productUrl);

    if (!storeUrl && !linkUrl) {
      setVariantsMessage(
        "Enter a valid https product link before loading from the store.",
      );
      return;
    }

    if (!storeUrl && linkUrl) {
      storeUrl = linkUrl;
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : linkUrl);
    }
    if (storeUrl && !linkUrl) {
      linkUrl = storeUrl;
      setProductUrl(storeUrl);
    }
    if (storeUrl && linkUrl && !urlsMatchForSubmit(storeUrl, linkUrl)) {
      setProductUrl(storeUrl);
      linkUrl = storeUrl;
    }

    const alignedUrl = parseValidHttpsProductUrl(storeUrl);
    if (!alignedUrl) {
      setVariantsMessage(
        "Enter a valid https product link before loading from the store.",
      );
      return;
    }
    if (!urlsMatchForSubmit(storeUrl, linkUrl)) {
      setVariantsMessage(
        "Store product URL and Product link must match before loading from the store.",
      );
      return;
    }

    startVariantsTransition(async () => {
      const res = await fetchProductVariantsAction({
        productUrl: alignedUrl,
        productName: productName.trim() || undefined,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
      });
      if (!res.ok) {
        setVariantRows([]);
        setVariantRetailer(null);
        setVariantMethod(null);
        setVariantsMessage(res.message);
        return;
      }
      setVariantRows(res.variants);
      setVariantRetailer(res.retailer);
      setVariantMethod(res.method);
      const serpTitle = res.listingTitle?.trim();
      const serpImage = res.listingImageUrl?.trim();
      if (serpTitle && !productName.trim()) {
        setProductName(serpTitle);
      }
      if (serpImage && /^https:\/\//i.test(serpImage)) {
        setDraftProductImageUrl(serpImage);
      }
      if (res.variants.length > 0 && res.variants[0]?.label && !productName.trim() && !serpTitle) {
        const primary = res.variants.find((v) => v.isCurrent) ?? res.variants[0];
        if (primary?.label) {
          setProductName(primary.label.split("·")[0]?.trim() || primary.label);
        }
      }
      const q = parseQuantity(quantity) ?? 1;
      const matched =
        findVariantMatchingColor(res.variants, productColor) ??
        res.variants.find((v) => v.isCurrent) ??
        res.variants[0];
      const liveMerch =
        matched ?
          merchPreviewFromVariant(matched, q, productSize, productColor)
        : null;
      if (liveMerch) {
        setAiMerchPreview(liveMerch);
        setAiMessage(null);
      }
      setVariantsMessage(
        res.variants.length > 0 ?
          formatVariantsLoadedMessage(res.variants.length, res.retailer, res.method)
        : `No variants were returned for this listing. Enter the product URL again or open the retailer's site in a new tab to verify the link.`,
      );
    });
  }, [previewInput, productUrl, productName, productSize, productColor, quantity]);

  const hasPreviewUrl = Boolean(normalizeUrlInput(previewInput));
  const hasProductLinkUrl = Boolean(normalizeUrlInput(productUrl));
  const validProductLinkUrl = parseValidHttpsProductUrl(productUrl);
  const hasValidProductLinkUrl = Boolean(validProductLinkUrl);
  const retailerProductUrlCheck = useMemo(
    () => validateItemRequestRetailerUrl(productUrl),
    [productUrl],
  );
  const isRetailerProductUrl = retailerProductUrlCheck.ok;
  const canUseUrlSync = hasPreviewUrl || hasProductLinkUrl;

  const urlsAligned = urlsMatchForSubmit(previewInput, productUrl);
  const showUrlSyncHint =
    productLinkFocused &&
    hasPreviewUrl &&
    !urlsAligned &&
    !urlSyncHintDismissed;
  const quantityOk = parseQuantity(quantity) != null;
  const canSubmit = urlsAligned && quantityOk && !isPending;
  const productNameReadyForCompare = isProductNameReadyForCompare(productName);
  const needsManualProductName =
    Boolean(normalizeUrlInput(productUrl)) && !productNameReadyForCompare;
  const canCompare =
    productNameReadyForCompare && !isComparePending && !isPending;
  const canLoadVariants =
    hasValidProductLinkUrl &&
    urlsAligned &&
    !isVariantsPending &&
    !isPending;
  const loadVariantsDisabledTitle =
    isVariantsPending || isPending ? undefined
    : !hasValidProductLinkUrl ?
      "Enter a valid https product link"
    : !urlsAligned ?
      "Product link must match the store product URL"
    : undefined;
  const fallbackCompareImage =
    draftProductImageUrl?.trim() ||
    spotlightPrefill?.imageUrl?.trim() ||
    null;

  const fieldError = useMemo(
    () =>
      (name: string) =>
        fieldErrors?.[name]?.length ? fieldErrors[name] : undefined,
    [fieldErrors]
  );

  const resetWorkspaceForm = useCallback(() => {
    setFormMessage(null);
    setFieldErrors(undefined);
    setAiMessage(null);
    setLastAiNotes(null);
    setDraftSiteName(null);
    setDraftProductImageUrl(null);
    setAiMerchPreview(null);
    setPendingProductPhoto(null);
    if (productPhotoRef.current) productPhotoRef.current.value = "";
    setPreviewInput("");
    setVariantRows([]);
    setVariantRetailer(null);
    setVariantMethod(null);
    setVariantsMessage(null);
    setCompareOffers([]);
    setCompareSearchQuery(null);
    setCompareMessage(null);
    setProductUrl("");
    setProductName("");
    setProductSize("");
    setProductColor("");
    setNote("");
    setQuantity("1");
    setIsSpotlightFeed(false);
    setSpotlightPrefillDismissed(true);
    setActiveTab("request");
    setApplyingVariantId(null);
    setFormResetKey((k) => k + 1);
  }, []);

  const canClearForm =
    !isPending &&
    !isVariantsPending &&
    !isComparePending &&
    !isApplyVariantPending &&
    (hasPreviewUrl ||
      hasProductLinkUrl ||
      productName.trim().length > 0 ||
      productSize.trim().length > 0 ||
      productColor.trim().length > 0 ||
      note.trim().length > 0 ||
      quantity !== "1" ||
      pendingProductPhoto != null ||
      variantRows.length > 0 ||
      compareOffers.length > 0 ||
      aiMerchPreview != null);

  const submit = useCallback(() => {
    setFormMessage(null);
    setFieldErrors(undefined);
    if (!urlsMatchForSubmit(previewInput, productUrl)) {
      setFormMessage(
        'Store product URL and Product link must be the same address. Use "Use store URL above" or edit both fields so they match.'
      );
      return;
    }
    if (parseQuantity(quantity) == null) {
      setFormMessage("Enter a quantity between 1 and 999.");
      return;
    }
    const payload = {
      productUrl,
      productName: productName.trim() || undefined,
      productSize: productSize.trim() || undefined,
      productColor: productColor.trim() || undefined,
      quantity,
      note: note.trim() || undefined,
      siteName: draftSiteName?.trim() || undefined,
      productImageUrl: draftProductImageUrl?.trim() || undefined,
    };
    const photoSnapshot = pendingProductPhoto;
    startTransition(async () => {
      const result = await createItemRequestAction(payload);
      if (result.ok) {
        let photoUploadError: string | undefined;
        if (result.itemRequestId && photoSnapshot) {
          const fd = new FormData();
          fd.set("itemRequestId", result.itemRequestId);
          fd.append("file", photoSnapshot);
          const up = await uploadItemRequestProductImageAction(fd);
          if (!up.ok) {
            photoUploadError = up.message;
          }
        }
        setFieldErrors(undefined);
        setFormMessage(null);
        resetWorkspaceForm();
        toast.success(
          result.message?.trim() ||
            "Your item request was submitted. Staff will review it soon.",
        );
        if (photoUploadError) {
          toast.error(
            `Your request was saved, but the product photo did not upload: ${photoUploadError}`,
          );
        }
        router.refresh();
        return;
      }
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
        const msg =
          result.message ?? "Please fix the highlighted fields and try again.";
        setFormMessage(msg);
        toast.error(msg);
        return;
      }
      setFieldErrors(undefined);
      const errMsg = result.message ?? "Could not submit request.";
      setFormMessage(errMsg);
      toast.error(errMsg);
    });
  }, [
    previewInput,
    productUrl,
    productName,
    productSize,
    productColor,
    quantity,
    note,
    draftSiteName,
    draftProductImageUrl,
    pendingProductPhoto,
    router,
    resetWorkspaceForm,
  ]);

  const applyVariant = useCallback(
    (variant: ProductVariantOffer) => {
      const url = normalizeUrlInput(variant.productUrl ?? productUrl);
      if (!url) {
        toast.error("No product URL for this variant.");
        return;
      }
      const q = parseQuantity(quantity);
      if (q == null) {
        toast.error("Enter a quantity between 1 and 999.");
        return;
      }

      setPreviewInput(url);
      setProductUrl(url);
      if (variant.size) setProductSize(variant.size);
      if (variant.color) setProductColor(variant.color);

      const sizeNorm = (variant.size ?? productSize).trim().toLowerCase();
      const colorNorm = (variant.color ?? productColor).trim().toLowerCase();

      if (variant.priceUsdCents != null) {
        setAiMerchPreview({
          quantity: q,
          unitPriceCents: variant.priceUsdCents,
          merchandiseSubtotalCents: variant.priceUsdCents * q,
          variantSizeNorm: sizeNorm,
          variantColorNorm: colorNorm,
        });
      }

      const applyListingImage = (imageUrl: string | null | undefined) => {
        const image = imageUrl?.trim();
        if (!image || !/^https:\/\//i.test(image)) return false;
        setDraftProductImageUrl(image);
        setPendingProductPhoto(null);
        if (productPhotoRef.current) productPhotoRef.current.value = "";
        return true;
      };

      applyListingImage(variant.imageUrl);

      setActiveTab("request");
      setApplyingVariantId(variant.id);

      startApplyVariantTransition(async () => {
        try {
          const res = await draftItemRequestFromSerpApiAction({
            productUrl: url,
            quantity: String(q),
            productSize: variant.size?.trim() || productSize.trim() || undefined,
            productColor:
              variant.color?.trim() || productColor.trim() || undefined,
          });

          if (!res.ok) {
            const fallbackName = variant.label?.trim();
            if (fallbackName && isProductNameReadyForCompare(fallbackName)) {
              setProductName(fallbackName);
            }
            const hasImage = applyListingImage(variant.imageUrl);
            const blocked = isRetailerPageFetchBlockedMessage(res.message ?? "");
            toast.error(
              blocked ?
                `${MANUAL_PRODUCT_NAME_AFTER_BLOCKED_SCRAPE} ${MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT}${hasImage ? " Listing image was applied from the variant when available." : ""}`
              : `${res.message ?? "Could not read this listing."} ${MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT}${hasImage ? " Listing image was applied from the variant when available." : ""}`,
              { duration: 10_000 },
            );
            return;
          }

          const resolvedName =
            res.productName?.trim() ||
            (isProductNameReadyForCompare(variant.label ?? "")
              ? variant.label!.trim()
              : "");

          if (resolvedName) {
            setProductName(resolvedName);
          }

          if (res.siteName) setDraftSiteName(res.siteName);
          const hasListingImage = applyListingImage(
            res.productImageUrl ?? variant.imageUrl,
          );

          if (res.unitPriceCents != null) {
            setAiMerchPreview({
              quantity: q,
              unitPriceCents: res.unitPriceCents,
              merchandiseSubtotalCents: res.merchandiseSubtotalCents,
              variantSizeNorm: sizeNorm,
              variantColorNorm: colorNorm,
            });
          }

          const imageNote = hasListingImage ? " Product photo updated from the listing." : "";

          if (isProductNameReadyForCompare(resolvedName)) {
            toast.success(
              `Variant applied with product name from the listing.${imageNote}`,
            );
          } else {
            toast.warning(
              `Variant applied (URL, size, color, price).${imageNote} ${MANUAL_PRODUCT_NAME_AFTER_BLOCKED_SCRAPE} ${MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT}`,
              { duration: 10_000 },
            );
          }
        } finally {
          setApplyingVariantId(null);
        }
      });
    },
    [productUrl, quantity, productSize, productColor],
  );

  const submitFromVariant = useCallback(
    (variant: ProductVariantOffer) => {
      const url = normalizeUrlInput(variant.productUrl ?? productUrl);
      if (!url) {
        toast.error("No product URL for this variant.");
        return;
      }
      setFormMessage(null);
      setFieldErrors(undefined);
      const q = parseQuantity(quantity);
      if (q == null) {
        toast.error("Enter a quantity between 1 and 999.");
        return;
      }
      const payload = {
        productUrl: url,
        productName: productName.trim() || undefined,
        productSize: variant.size?.trim() || productSize.trim() || undefined,
        productColor: variant.color?.trim() || productColor.trim() || undefined,
        quantity: String(q),
        note: note.trim() || undefined,
        siteName:
          variantRetailer?.trim() || draftSiteName?.trim() || undefined,
        productImageUrl:
          variant.imageUrl?.trim() ||
          draftProductImageUrl?.trim() ||
          spotlightPrefill?.imageUrl?.trim() ||
          undefined,
      };
      const photoSnapshot = pendingProductPhoto;
      startTransition(async () => {
        const result = await createItemRequestAction(payload);
        if (result.ok) {
          let photoUploadError: string | undefined;
          if (result.itemRequestId && photoSnapshot) {
            const fd = new FormData();
            fd.set("itemRequestId", result.itemRequestId);
            fd.append("file", photoSnapshot);
            const up = await uploadItemRequestProductImageAction(fd);
            if (!up.ok) photoUploadError = up.message;
          }
          toast.success(
            result.message?.trim() ||
              "Your item request was submitted. Staff will review it soon.",
          );
          if (photoUploadError) {
            toast.error(
              `Request saved, but the product photo did not upload: ${photoUploadError}`,
            );
          }
          router.refresh();
          return;
        }
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          toast.error(
            result.message ?? "Please fix the highlighted fields and try again.",
          );
          setActiveTab("request");
          return;
        }
        toast.error(result.message ?? "Could not submit request.");
      });
    },
    [
      productUrl,
      productName,
      productSize,
      productColor,
      quantity,
      note,
      variantRetailer,
      draftSiteName,
      draftProductImageUrl,
      spotlightPrefill,
      pendingProductPhoto,
      router,
    ],
  );

  const runComparePrices = useCallback(() => {
    setCompareMessage(null);
    const name = productName.trim();
    if (!isProductNameReadyForCompare(name)) {
      setCompareMessage(COMPARE_REQUIRES_PRODUCT_NAME_MESSAGE);
      return;
    }
    startCompareTransition(async () => {
      const res = await compareRetailerPricesAction({
        productName: name,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
        originalProductUrl: normalizeUrlInput(productUrl) || undefined,
        originalRetailer: draftSiteName?.trim() || undefined,
        originalPriceUsdCents: aiMerchPreview?.unitPriceCents ?? undefined,
        originalImageUrl:
          draftProductImageUrl?.trim() ||
          spotlightPrefill?.imageUrl?.trim() ||
          undefined,
      });
      if (!res.ok) {
        setCompareMessage(res.message);
        return;
      }
      setCompareOffers(res.offers);
      setCompareSearchQuery(res.searchQuery);
      const verifiedNote =
        res.verifiedCount > 0 ?
          `${res.verifiedCount} verified · `
        : "";
      setCompareMessage(
        `${verifiedNote}${res.offers.length} offer${res.offers.length === 1 ? "" : "s"} across the web (SerpApi Google Shopping).`,
      );
      setActiveTab("compare");
    });
  }, [
    productName,
    productSize,
    productColor,
    productUrl,
    draftSiteName,
    aiMerchPreview,
    draftProductImageUrl,
    spotlightPrefill,
  ]);

  const submitFromOffer = useCallback(
    (offer: RetailerPriceOffer) => {
      const url = normalizeUrlInput(offer.productUrl);
      if (!url) {
        toast.error("Invalid product URL for this offer.");
        return;
      }
      setFormMessage(null);
      setFieldErrors(undefined);
      const q = parseQuantity(quantity);
      if (q == null) {
        toast.error("Enter a quantity between 1 and 999.");
        return;
      }
      const payload = {
        productUrl: url,
        productName: offer.title.trim() || productName.trim() || undefined,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
        quantity: String(q),
        note: note.trim() || undefined,
        siteName: offer.retailer.trim() || draftSiteName?.trim() || undefined,
        productImageUrl:
          offer.imageUrl?.trim() ||
          draftProductImageUrl?.trim() ||
          spotlightPrefill?.imageUrl?.trim() ||
          undefined,
      };
      const photoSnapshot = pendingProductPhoto;
      startTransition(async () => {
        const result = await createItemRequestAction(payload);
        if (result.ok) {
          let photoUploadError: string | undefined;
          if (result.itemRequestId && photoSnapshot) {
            const fd = new FormData();
            fd.set("itemRequestId", result.itemRequestId);
            fd.append("file", photoSnapshot);
            const up = await uploadItemRequestProductImageAction(fd);
            if (!up.ok) photoUploadError = up.message;
          }
          toast.success(
            result.message?.trim() ||
              "Your item request was submitted. Staff will review it soon.",
          );
          if (photoUploadError) {
            toast.error(
              `Request saved, but the product photo did not upload: ${photoUploadError}`,
            );
          }
          router.refresh();
          return;
        }
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
          toast.error(
            result.message ?? "Please fix the highlighted fields and try again.",
          );
          setActiveTab("request");
          return;
        }
        toast.error(result.message ?? "Could not submit request.");
      });
    },
    [
      quantity,
      productName,
      productSize,
      productColor,
      note,
      draftSiteName,
      draftProductImageUrl,
      spotlightPrefill,
      pendingProductPhoto,
      router,
    ],
  );

  const browseCard = (
    <Card className="overflow-hidden border-border/80 shadow-none">
      <CardHeader className={dashItemsTableCardHeader}>
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold tracking-tight">
          Product from store
          <HelpBalloon label="About Product from store" tooltipClassName="w-80">
            Paste the retailer product URL and load sizes, colors, and prices from the store
            listing (SerpAPI for Walmart, Amazon, and similar retailers). Must match the product
            link on your request.
          </HelpBalloon>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
        <div className="space-y-1.5">
          <label
            htmlFor="item-preview-product-url"
            className="text-sm font-medium text-foreground"
          >
            Store product URL
          </label>
          <p className="text-xs text-muted-foreground">
            Must match the product link submitted with your request.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="item-preview-product-url"
            key={`preview-${formResetKey}`}
            name="previewProductUrl"
            autoComplete="off"
            aria-label="Store product URL"
            placeholder="https://example-store.com/…"
            value={previewInput}
            onChange={(e) => setPreviewInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runLoadVariants();
              }
            }}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            onClick={runLoadVariants}
            disabled={!canLoadVariants}
            title={loadVariantsDisabledTitle}
          >
            {isVariantsPending ?
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </>
            : "Load product from store"}
          </Button>
        </div>

        {variantRows.length > 0 || isVariantsPending || variantsMessage ?
          <ItemRequestProductVariants
            embedded
            hideLoadButton
            variants={variantRows}
            retailer={variantRetailer}
            method={variantMethod}
            variantsMessage={variantsMessage}
            isVariantsPending={isVariantsPending}
            isApplyVariantPending={isApplyVariantPending}
            applyingVariantId={applyingVariantId}
            isSubmitPending={isPending}
            onLoadVariants={runLoadVariants}
            onApplyVariant={applyVariant}
            onSubmitVariant={submitFromVariant}
            canLoadVariants={canLoadVariants}
            loadVariantsDisabledTitle={loadVariantsDisabledTitle}
          />
        : null}
      </CardContent>
    </Card>
  );

  const requestCard = (
    <Card className="overflow-hidden border-border/80 shadow-none">
      <CardHeader className={dashItemsTableCardHeader}>
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold tracking-tight">
          Request details
          <HelpBalloon label="About Request details" tooltipClassName="w-80">
            Complete the fields below. Apply a store variant or enter details manually.
            Merchandise estimates reflect retailer product cost only—staff will issue an official
            quote after review.
          </HelpBalloon>
        </CardTitle>
      </CardHeader>
        <CardContent className="px-6 py-5">
          <FieldSet key={formResetKey} className="gap-6">
            <div className={cn(dashItemsTableStatusPanel, "space-y-4 px-4 py-4 text-sm text-muted-foreground")}>
                <div
                  role="note"
                  className="flex gap-3 rounded-md border border-border bg-card px-3 py-3 text-xs leading-relaxed"
                >
                  <Info
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="space-y-2 min-w-0">
                    <p className="font-medium text-foreground">
                      About merchandise estimates
                    </p>
                    <ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
                      <li>
                        Retailer prices may vary by quantity, size, and color. Figures
                        shown are AI-derived from the listing and may be incomplete or
                        outdated.
                      </li>
                      <li>
                        Tax, Cart2Barrel service and handling, and shipping are not
                        included. Staff will provide a full quote where applicable.
                      </li>
                    </ul>
                  </div>
                </div>
                <p className="inline-flex flex-wrap items-center gap-2 leading-relaxed">
                  {variantRows.length > 0 ?
                    <>
                      This variant is loaded by{" "}
                      <span className="font-medium text-foreground">
                        Product from store
                      </span>
                      : select{" "}
                      <span
                        className="font-medium text-foreground underline decoration-dotted underline-offset-4"
                        title={VARIANT_APPLY_TOOLTIP}
                      >
                        Apply
                      </span>{" "}
                      on another available product row above to populate the form.
                    </>
                  : <>
                      <span>
                        Align the store product URL with the product link, then use{" "}
                        <span className="font-medium text-foreground">
                          Load product from store
                        </span>
                        . All fields remain editable before you submit.
                      </span>
                      <HelpBalloon label="About loading from store">
                        Align the store product URL with the product link, then use Load product
                        from store. All fields remain editable before you submit.
                      </HelpBalloon>
                    </>
                  }
                </p>
                {aiMessage ?
                  <p
                    className={cn(
                      "mt-2 text-sm leading-relaxed",
                      isAiErrorMessage(aiMessage) ?
                        "text-destructive"
                      : "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-amber-950 dark:text-amber-100",
                    )}
                    role={isAiErrorMessage(aiMessage) ? "status" : "note"}
                  >
                    {aiMessage}
                  </p>
                : null}
                {aiMerchPreview ? (
                  <div className="rounded-md border border-border bg-background px-4 py-4 text-foreground">
                    <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Merchandise estimate
                    </p>
                    {pricePreviewStale ? (
                      <p
                        role="status"
                        className="mt-2 text-xs text-muted-foreground"
                      >
                        Quantity, size, or color changed after loading from the
                        store. Use{" "}
                        <span className="font-medium text-foreground">
                          Load product from store
                        </span>{" "}
                        again to refresh the estimate.
                      </p>
                    ) : null}
                    <div className="mt-3 space-y-2 tabular-nums text-sm">
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-muted-foreground">
                          Est. unit price
                        </span>
                        <span>{formatUsd(aiMerchPreview.unitPriceCents)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-muted-foreground">Quantity</span>
                        <span>{aiMerchPreview.quantity}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-2 font-medium">
                        <span>Est. merchandise total</span>
                        <span>
                          {formatUsd(aiMerchPreview.merchandiseSubtotalCents)}
                        </span>
                      </div>
                    </div>
                    {aiMerchPreview.unitPriceCents == null ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        The page did not yield a clear unit price for this variant.
                        Staff will price it when they quote you.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Service &amp; handling, shipping, and tax are not included—see
                        the notice above.
                      </p>
                    )}
                  </div>
                ) : null}
                {lastAiNotes ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">AI note:</span>{" "}
                    {lastAiNotes}
                  </p>
                ) : null}
              </div>

            <FieldGroup>
              <Field data-invalid={Boolean(fieldError("productUrl")?.length)}>
                <FieldLabelWithHelp
                  htmlFor="item-product-url"
                  label="Product link"
                  help={
                    <>
                      Paste the product page URL for this request (sent to staff). It must match
                      the store product URL above—use{" "}
                      <span className="font-medium text-foreground">Use store URL above</span> to
                      copy the link here.
                    </>
                  }
                  helpLabel="About Product link"
                />
                <FieldContent>
                  <Input
                    id="item-product-url"
                    name="productUrl"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://…"
                    value={productUrl}
                    onChange={(e) => setProductUrl(e.target.value)}
                    onFocus={() => {
                      if (productLinkBlurTimeoutRef.current) {
                        clearTimeout(productLinkBlurTimeoutRef.current);
                        productLinkBlurTimeoutRef.current = null;
                      }
                      setProductLinkFocused(true);
                    }}
                    onBlur={() => {
                      productLinkBlurTimeoutRef.current = setTimeout(() => {
                        setProductLinkFocused(false);
                      }, 180);
                    }}
                    aria-invalid={Boolean(fieldError("productUrl")?.length)}
                    aria-describedby={
                      showUrlSyncHint ? "item-product-url-sync-hint" : undefined
                    }
                  />
                  <FieldError errors={fieldError("productUrl")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
              <div className="relative w-fit">
                {showUrlSyncHint ? (
                  <div
                    id="item-product-url-sync-hint"
                    role="status"
                    className="absolute bottom-full left-0 z-20 mb-2 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-primary/40 bg-primary/15 px-3 py-2.5 text-xs leading-relaxed text-foreground shadow-lg ring-1 ring-primary/20"
                  >
                    <span
                      aria-hidden
                      className="absolute -bottom-1.5 left-5 size-2.5 rotate-45 border-b border-r border-primary/40 bg-primary/15"
                    />
                    Store URL is ready — click{" "}
                    <span className="font-semibold text-foreground">
                      Use store URL above
                    </span>{" "}
                    to copy it into Product link.
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onPointerDown={() => {
                    if (productLinkBlurTimeoutRef.current) {
                      clearTimeout(productLinkBlurTimeoutRef.current);
                      productLinkBlurTimeoutRef.current = null;
                    }
                  }}
                  onClick={syncPreviewAndProductLink}
                  disabled={!canUseUrlSync}
                >
                  {hasPreviewUrl
                    ? "Use store URL above"
                    : "Use product link above"}
                </Button>
              </div>
            </FieldGroup>

            <Separator />

            <Field data-invalid={Boolean(fieldError("productName")?.length)}>
              <FieldLabelWithHelp
                htmlFor="item-product-name"
                label="Product name"
                help="Required for price comparison (minimum 2 characters). If Apply could not read the page, copy the product title from the retailer listing."
                helpLabel="About Product name"
              />
              <FieldContent>
                <Input
                  id="item-product-name"
                  name="productName"
                  placeholder="e.g. Brand — model"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  aria-invalid={Boolean(fieldError("productName")?.length)}
                />
                <FieldError errors={fieldError("productName")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            {needsManualProductName ?
              <p
                role="status"
                className={cn(dashItemsTableStatusPanel, "text-sm leading-relaxed text-muted-foreground")}
              >
                <span className="font-medium text-foreground">
                  Product name required.
                </span>{" "}
                {MANUAL_PRODUCT_NAME_AFTER_BLOCKED_SCRAPE}{" "}
                {MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT}
              </p>
            : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={Boolean(fieldError("productSize")?.length)}>
                <FieldLabel htmlFor="item-product-size">
                  Product size{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="item-product-size"
                    name="productSize"
                    placeholder="e.g. M, 10 US, 42 EU"
                    value={productSize}
                    onChange={(e) => setProductSize(e.target.value)}
                    aria-invalid={Boolean(fieldError("productSize")?.length)}
                  />
                  <FieldError errors={fieldError("productSize")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
              <Field data-invalid={Boolean(fieldError("productColor")?.length)}>
                <FieldLabel htmlFor="item-product-color">
                  Product color{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="item-product-color"
                    name="productColor"
                    placeholder="e.g. Navy, Black / white"
                    value={productColor}
                    onChange={(e) => setProductColor(e.target.value)}
                    aria-invalid={Boolean(fieldError("productColor")?.length)}
                  />
                  <FieldError errors={fieldError("productColor")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
            </div>

            <Field data-invalid={Boolean(fieldError("quantity")?.length)}>
              <FieldLabel htmlFor="item-quantity">Quantity</FieldLabel>
              <FieldContent>
                <Input
                  id="item-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  max={999}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="max-w-32"
                  aria-invalid={Boolean(fieldError("quantity")?.length)}
                />
                <FieldError errors={fieldError("quantity")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabelWithHelp
                htmlFor="item-product-photo"
                label={
                  <>
                    Product photo{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </>
                }
                help="Filled from the listing when you Apply a store variant or run AI. You can also upload your own file (JPEG, PNG, WebP, or GIF up to 8 MB)—upload replaces the listing image on submit."
                helpLabel="About Product photo"
              />
              <FieldContent className="space-y-2">
                {draftProductImageUrl?.trim() ?
                  <div className={cn(dashItemsTableStatusPanel, "flex flex-wrap items-start gap-3 p-2")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draftProductImageUrl.trim()}
                      alt=""
                      className="h-20 w-20 shrink-0 rounded object-cover"
                    />
                    <p className="min-w-0 text-xs text-muted-foreground">
                      Listing image from AI — saved with your request unless you pick your own file
                      below (upload replaces it).
                    </p>
                  </div>
                : null}
                <input
                  ref={productPhotoRef}
                  id="item-product-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setPendingProductPhoto(f);
                    if (f) setDraftProductImageUrl(null);
                  }}
                />
                {pendingProductPhoto ?
                  <p className="text-xs text-muted-foreground">
                    Selected:{" "}
                    <span className="font-medium text-foreground">
                      {pendingProductPhoto.name}
                    </span>
                  </p>
                : null}
              </FieldContent>
            </Field>

            <Field data-invalid={Boolean(fieldError("note")?.length)}>
              <FieldLabel htmlFor="item-note">
                Staff notes{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <FieldContent>
                <textarea
                  id="item-note"
                  name="note"
                  rows={3}
                  placeholder="Variant preferences, seller requirements, budget limit, etc."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(
                    inputFieldClassName,
                    "flex min-h-20 resize-y py-2 text-sm",
                  )}
                  aria-invalid={Boolean(fieldError("note")?.length)}
                />
                <FieldError errors={fieldError("note")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            {hasPreviewUrl &&
            hasProductLinkUrl &&
            !urlsAligned &&
            !fieldErrors?.productUrl?.length ? (
              <p
                role="status"
                className={cn(dashItemsTableStatusPanel, "text-sm text-muted-foreground")}
              >
                Store product URL and product link must match. Select{" "}
                <span className="font-medium text-foreground">
                  Use store URL above
                </span>{" "}
                or edit both fields to use the same product page address.
              </p>
            ) : null}

            {formMessage && (
              <p
                role="status"
                className={`text-sm ${
                  fieldErrors ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {formMessage}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!canClearForm}
                title={
                  !canClearForm && !isPending ?
                    "Nothing to clear"
                  : undefined
                }
                onClick={resetWorkspaceForm}
              >
                Clear form
              </Button>
              <Button
                type="button"
                disabled={!canSubmit}
                title={
                  !canSubmit && !isPending
                    ? !hasPreviewUrl || !hasProductLinkUrl
                      ? "Fill in store product URL and product link"
                      : !urlsAligned
                        ? "Store product URL and product link must match"
                        : !quantityOk
                          ? "Enter a valid quantity (1–999)"
                          : undefined
                    : undefined
                }
                onClick={submit}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit for staff review"
                )}
              </Button>
            </div>
          </FieldSet>
        </CardContent>
      </Card>
  );

  const showSpotlightPrefillNotice =
    isSpotlightFeed && !spotlightPrefillDismissed;

  const tabClass = (tab: WorkspaceTab) =>
    cn(
      "shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors",
      activeTab === tab
        ? "bg-background text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );

  const tabCountClass =
    "ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground";

  return (
    <div className="space-y-6">
      {showSpotlightPrefillNotice ?
        <div
          role="status"
          className={cn(dashItemsTableStatusPanel, "flex flex-col gap-3 px-4 py-3.5 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between")}
        >
          <p className="text-pretty leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Spotlight prefill applied.</span>{" "}
            Product link, name, pricing, variant, and image (when available) have been
            populated. Review the form and submit for staff review, or open the Price
            comparison tab to evaluate other retailers.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setSpotlightPrefillDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      : null}

      <div
        role="tablist"
        aria-label="Request workflow"
        className={cn(dashItemsTableToolbar, "inline-flex max-w-full gap-1 overflow-x-auto p-1")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "request"}
          className={tabClass("request")}
          onClick={() => setActiveTab("request")}
        >
          Request form
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "compare"}
          className={tabClass("compare")}
          onClick={() => setActiveTab("compare")}
        >
          Price comparison
          {compareOffers.length > 0 ?
            <span className={tabCountClass}>{compareOffers.length}</span>
          : null}
        </button>
      </div>

      {activeTab === "request" ?
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,26rem)] xl:items-start xl:gap-8">
          <div className="min-w-0">{browseCard}</div>
          <div className="min-w-0 xl:sticky xl:top-6 xl:z-10 xl:self-start">
            {requestCard}
          </div>
        </div>
      : <div className="min-w-0 space-y-6">
          <ItemRequestCompareRetailers
            offers={compareOffers}
            searchQuery={compareSearchQuery}
            fallbackImageUrl={fallbackCompareImage}
            compareMessage={compareMessage}
            isComparePending={isComparePending}
            isSubmitPending={isPending}
            onCompare={runComparePrices}
            onSubmitOffer={submitFromOffer}
            canCompare={canCompare}
            needsManualProductName={needsManualProductName}
          />
          <p className="text-center text-xs text-muted-foreground">
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setActiveTab("request")}
            >
              Return to request form
            </button>
          </p>
        </div>
      }
    </div>
  );
}
