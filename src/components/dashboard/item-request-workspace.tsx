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
import {
  normalizeRetailerImageUrl,
  resolveListingImageUrl,
  resolveVariantDraftImageUrl,
} from "@/lib/product-variants/variant-images";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
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
import { FieldHoverHint, FieldInlineHint } from "@/components/ui/field-hover-hint";
import { FieldLabelWithHelp } from "@/components/ui/field-label-with-help";
import { HelpBalloon } from "@/components/ui/help-balloon";
import { Input, inputFieldClassName } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatUsd } from "@/lib/admin-markup";
import {
  centsToUsdInput,
  parseUsdToCents,
} from "@/lib/admin-pricing-form-utils";
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
  const [variantListingImageUrl, setVariantListingImageUrl] = useState<string | null>(
    null,
  );
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
  const [unitPriceDollars, setUnitPriceDollars] = useState(
    spotlightSeed?.aiMerchPreview?.unitPriceCents != null
      ? centsToUsdInput(spotlightSeed.aiMerchPreview.unitPriceCents)
      : "",
  );
  const [unitPriceUserEdited, setUnitPriceUserEdited] = useState(false);
  const [storeVariantsLoaded, setStoreVariantsLoaded] = useState(false);
  const [priceHintDismissed, setPriceHintDismissed] = useState(false);
  const [loadFromStoreHintDismissed, setLoadFromStoreHintDismissed] = useState(false);
  /** After Use store URL copies the link, prompt Load product from store (or manual form). */
  const [promptLoadFromStoreAfterSync, setPromptLoadFromStoreAfterSync] =
    useState(false);
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
  const [urlSyncHintDismissed, setUrlSyncHintDismissed] = useState(false);
  const [spotlightPrefillDismissed, setSpotlightPrefillDismissed] = useState(false);

  const spotlightAppliedIdRef = useRef<string | null>(null);

  const applyUnitPriceFromCatalog = useCallback((cents: number | null | undefined) => {
    setUnitPriceUserEdited(false);
    if (cents != null && cents > 0) {
      setUnitPriceDollars(centsToUsdInput(cents));
    } else {
      setUnitPriceDollars("");
    }
  }, []);

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
    if (merch?.unitPriceCents != null) {
      applyUnitPriceFromCatalog(merch.unitPriceCents);
    }
    setAiMessage(
      merch ?
        "Loaded from spotlight: review the fields below, then submit your request to staff."
      : "Loaded from spotlight: review the link and details, then submit your request to staff.",
    );
    setIsSpotlightFeed(true);
    setSpotlightPrefillDismissed(false);
  }, [spotlightPrefill, initialProductUrl, quantity, applyUnitPriceFromCatalog]);

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

  useEffect(() => {
    if (unitPriceUserEdited) return;
    if (aiMerchPreview?.unitPriceCents != null) {
      setUnitPriceDollars(centsToUsdInput(aiMerchPreview.unitPriceCents));
    }
  }, [aiMerchPreview?.unitPriceCents, unitPriceUserEdited]);

  useEffect(() => {
    const q = parseQuantity(quantity);
    if (q == null) return;
    const cents = parseUsdToCents(unitPriceDollars);
    if (cents <= 0) return;
    const sizeNorm = productSize.trim().toLowerCase();
    const colorNorm = productColor.trim().toLowerCase();
    setAiMerchPreview((prev) => ({
      quantity: q,
      unitPriceCents: cents,
      merchandiseSubtotalCents: cents * q,
      variantSizeNorm: prev?.variantSizeNorm ?? sizeNorm,
      variantColorNorm: prev?.variantColorNorm ?? colorNorm,
    }));
  }, [quantity, unitPriceDollars]);

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

  const scrollToLoadFromStoreButton = useCallback(() => {
    requestAnimationFrame(() => {
      document
        .getElementById("item-load-from-store")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const syncPreviewAndProductLink = useCallback(() => {
    const fromPreview = normalizeUrlInput(previewInput);
    if (fromPreview) {
      setProductUrl(fromPreview);
      setUrlSyncHintDismissed(true);
      setLoadFromStoreHintDismissed(false);
      setPromptLoadFromStoreAfterSync(true);
      scrollToLoadFromStoreButton();
      return;
    }
    const fromLink = normalizeUrlInput(productUrl);
    if (fromLink) {
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : fromLink);
      setUrlSyncHintDismissed(true);
    }
  }, [previewInput, productUrl, scrollToLoadFromStoreButton]);

  useEffect(() => {
    setUrlSyncHintDismissed(false);
  }, [previewInput]);

  const runLoadVariants = useCallback(() => {
    setLoadFromStoreHintDismissed(true);
    setPromptLoadFromStoreAfterSync(false);
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
        setVariantListingImageUrl(null);
        setVariantsMessage(res.message);
        return;
      }
      setVariantRows(res.variants);
      setVariantRetailer(res.retailer);
      setVariantMethod(res.method);
      const serpTitle = res.listingTitle?.trim();
      const listingHero = resolveListingImageUrl(
        res.variants,
        res.listingImageUrl,
      );
      if (serpTitle && !productName.trim()) {
        setProductName(serpTitle);
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
      const draftImage =
        matched ?
          resolveVariantDraftImageUrl(matched, listingHero)
        : listingHero;
      if (listingHero) {
        setVariantListingImageUrl(listingHero);
      } else {
        setVariantListingImageUrl(null);
      }
      if (draftImage) {
        setDraftProductImageUrl(draftImage);
      }
      const liveMerch =
        matched ?
          merchPreviewFromVariant(matched, q, productSize, productColor)
        : null;
      if (liveMerch) {
        setAiMerchPreview(liveMerch);
        applyUnitPriceFromCatalog(liveMerch.unitPriceCents);
        setAiMessage(null);
      }
      setStoreVariantsLoaded(true);
      setPriceHintDismissed(false);
      setVariantsMessage(
        res.variants.length > 0 ?
          formatVariantsLoadedMessage(res.variants.length, res.retailer, res.method)
        : `No variants were returned for this listing. Enter the product URL again or open the retailer's site in a new tab to verify the link.`,
      );
      requestAnimationFrame(() => {
        document
          .getElementById("item-unit-price")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }, [
    previewInput,
    productUrl,
    productName,
    productSize,
    productColor,
    quantity,
    applyUnitPriceFromCatalog,
  ]);

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
  const showProductLinkSyncHint =
    hasPreviewUrl && !urlsAligned && !urlSyncHintDismissed;
  const showPriceVerifyHint = storeVariantsLoaded && !priceHintDismissed;
  const showLoadFromStoreHint =
    promptLoadFromStoreAfterSync &&
    urlsAligned &&
    hasValidProductLinkUrl &&
    !loadFromStoreHintDismissed &&
    !storeVariantsLoaded &&
    !isVariantsPending;
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
    normalizeRetailerImageUrl(draftProductImageUrl) ??
    normalizeRetailerImageUrl(spotlightPrefill?.imageUrl) ??
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
    setVariantListingImageUrl(null);
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
    setUnitPriceDollars("");
    setUnitPriceUserEdited(false);
    setStoreVariantsLoaded(false);
    setPriceHintDismissed(false);
    setLoadFromStoreHintDismissed(false);
    setPromptLoadFromStoreAfterSync(false);
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
        'Store product URL and Product link must be the same address. Use "Use store URL" or edit both fields so they match.'
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
      customerUnitPriceUsd: unitPriceDollars.trim() || undefined,
      siteName: draftSiteName?.trim() || undefined,
      productImageUrl: normalizeRetailerImageUrl(draftProductImageUrl) ?? undefined,
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
    unitPriceDollars,
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
        applyUnitPriceFromCatalog(variant.priceUsdCents);
        setAiMerchPreview({
          quantity: q,
          unitPriceCents: variant.priceUsdCents,
          merchandiseSubtotalCents: variant.priceUsdCents * q,
          variantSizeNorm: sizeNorm,
          variantColorNorm: colorNorm,
        });
      }

      const applyListingImage = (imageUrl: string | null | undefined) => {
        const image = normalizeRetailerImageUrl(imageUrl);
        if (!image) return false;
        setDraftProductImageUrl(image);
        setPendingProductPhoto(null);
        if (productPhotoRef.current) productPhotoRef.current.value = "";
        return true;
      };

      applyListingImage(
        resolveVariantDraftImageUrl(variant, variantListingImageUrl),
      );

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
            const hasImage = applyListingImage(
              resolveVariantDraftImageUrl(variant, variantListingImageUrl),
            );
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
            res.productImageUrl ??
              resolveVariantDraftImageUrl(variant, variantListingImageUrl),
          );

          if (res.unitPriceCents != null) {
            applyUnitPriceFromCatalog(res.unitPriceCents);
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
    [
      productUrl,
      quantity,
      productSize,
      productColor,
      variantListingImageUrl,
      applyUnitPriceFromCatalog,
    ],
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
        customerUnitPriceUsd:
          unitPriceDollars.trim() ||
          (variant.priceUsdCents != null
            ? centsToUsdInput(variant.priceUsdCents)
            : undefined),
        siteName:
          variantRetailer?.trim() || draftSiteName?.trim() || undefined,
        productImageUrl:
          resolveVariantDraftImageUrl(variant, variantListingImageUrl) ??
          normalizeRetailerImageUrl(draftProductImageUrl) ??
          normalizeRetailerImageUrl(spotlightPrefill?.imageUrl) ??
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
      unitPriceDollars,
      variantRetailer,
      variantListingImageUrl,
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
          normalizeRetailerImageUrl(draftProductImageUrl) ??
          normalizeRetailerImageUrl(spotlightPrefill?.imageUrl) ??
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
        customerUnitPriceUsd:
          unitPriceDollars.trim() ||
          (offer.priceUsdCents != null && offer.priceUsdCents > 0
            ? centsToUsdInput(offer.priceUsdCents)
            : undefined),
        siteName: offer.retailer.trim() || draftSiteName?.trim() || undefined,
        productImageUrl:
          normalizeRetailerImageUrl(offer.imageUrl) ??
          normalizeRetailerImageUrl(draftProductImageUrl) ??
          normalizeRetailerImageUrl(spotlightPrefill?.imageUrl) ??
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
      unitPriceDollars,
      draftSiteName,
      draftProductImageUrl,
      spotlightPrefill,
      pendingProductPhoto,
      router,
    ],
  );

  const browseCard = (
    <Card className="overflow-visible border-border/80 shadow-none">
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
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center",
            showLoadFromStoreHint && "pt-28 sm:pt-32",
          )}
        >
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
          <div className="relative w-fit shrink-0 self-start">
            <FieldHoverHint
              show={showLoadFromStoreHint}
              id="item-load-from-store-hint"
              anchor="center"
              arrowAlign="center"
              placement="above"
              prominent
              onDismiss={() => {
                setLoadFromStoreHintDismissed(true);
                setPromptLoadFromStoreAfterSync(false);
              }}
              dismissLabel="Dismiss load from store hint"
              className="w-[min(24rem,calc(100vw-2rem))]"
            >
              Product link is ready — click Load product from store button below to pull sizes,
              colors, and prices from the retailer site variant listing. Or scroll down, fill out
              the request form manually, then click Submit for staff review.
            </FieldHoverHint>
            <Button
              id="item-load-from-store"
              type="button"
              onClick={runLoadVariants}
              disabled={!canLoadVariants}
              title={loadVariantsDisabledTitle}
              aria-describedby={
                showLoadFromStoreHint ? "item-load-from-store-hint" : undefined
              }
            >
              {isVariantsPending ?
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading…
                </>
              : "Load product from store"}
            </Button>
          </div>
        </div>

        {variantRows.length > 0 || isVariantsPending || variantsMessage ?
          <ItemRequestProductVariants
            embedded
            hideLoadButton
            variants={variantRows}
            listingImageUrl={variantListingImageUrl}
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
    <Card className="overflow-visible border-border/80 shadow-none">
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
                      the store product URL above—use the{" "}
                      <span className="font-medium text-foreground">Use store URL</span> button to
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
                    aria-invalid={Boolean(fieldError("productUrl")?.length)}
                  />
                  <FieldError errors={fieldError("productUrl")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
              <div className="flex flex-col gap-2.5">
                <FieldInlineHint
                  show={showProductLinkSyncHint}
                  id="item-product-url-sync-hint"
                  prominent
                  onDismiss={() => setUrlSyncHintDismissed(true)}
                  dismissLabel="Dismiss product link hint"
                >
                  Store product URL is ready. Click{" "}
                  <span className="font-semibold text-zinc-900">Use store URL</span> below to
                  copy it into the Product link field.
                </FieldInlineHint>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onClick={syncPreviewAndProductLink}
                  disabled={!canUseUrlSync}
                  aria-describedby={
                    showProductLinkSyncHint ? "item-product-url-sync-hint" : undefined
                  }
                >
                  {hasPreviewUrl ? "Use store URL" : "Use product link above"}
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

            <div className="grid gap-5 sm:grid-cols-2">
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

              <Field data-invalid={Boolean(fieldError("customerUnitPriceUsd")?.length)}>
                <FieldLabelWithHelp
                  htmlFor="item-unit-price"
                  label={
                    <>
                      Unit price (USD){" "}
                      <span className="font-normal text-muted-foreground">(retailer)</span>
                    </>
                  }
                  help="Per-item price on the retailer site. Filled when you load from the store or apply a variant; edit if catalog data does not match what you see on the listing."
                  helpLabel="About unit price"
                />
                <FieldContent>
                  <div className="relative overflow-visible">
                    <FieldHoverHint
                      show={showPriceVerifyHint}
                      id="item-unit-price-verify-hint"
                      inFrame
                      arrowAlign="left"
                      className="w-[min(20rem,calc(100vw-6rem))]"
                      onDismiss={() => setPriceHintDismissed(true)}
                      dismissLabel="Dismiss price hint"
                    >
                      Loaded price may not match the retailer site. Open the product page and
                      enter the{" "}
                      <span className="font-semibold text-zinc-900">actual unit price</span> you
                      see on the listing.
                    </FieldHoverHint>
                    <Input
                      id="item-unit-price"
                      name="customerUnitPriceUsd"
                      inputMode="decimal"
                      placeholder="e.g. 3.27"
                      value={unitPriceDollars}
                      onChange={(e) => {
                        setUnitPriceUserEdited(true);
                        setPriceHintDismissed(true);
                        const raw = e.target.value;
                        setUnitPriceDollars(raw);
                        const q = parseQuantity(quantity) ?? 1;
                        const sizeNorm = productSize.trim().toLowerCase();
                        const colorNorm = productColor.trim().toLowerCase();
                        const cents = parseUsdToCents(raw);
                        setAiMerchPreview({
                          quantity: q,
                          unitPriceCents: cents > 0 ? cents : null,
                          merchandiseSubtotalCents: cents > 0 ? cents * q : null,
                          variantSizeNorm: sizeNorm,
                          variantColorNorm: colorNorm,
                        });
                      }}
                      className="w-full max-w-40"
                      aria-invalid={Boolean(fieldError("customerUnitPriceUsd")?.length)}
                      aria-describedby={
                        showPriceVerifyHint ? "item-unit-price-verify-hint" : undefined
                      }
                    />
                  </div>
                  <FieldError
                    errors={fieldError("customerUnitPriceUsd")?.map((m) => ({
                      message: m,
                    }))}
                  />
                  {parseUsdToCents(unitPriceDollars) > 0 && parseQuantity(quantity) != null ?
                    <p className="text-xs text-muted-foreground">
                      Est. merchandise:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {formatUsd(
                          parseUsdToCents(unitPriceDollars) * (parseQuantity(quantity) ?? 1),
                        )}
                      </span>{" "}
                      ({parseQuantity(quantity)} × {formatUsd(parseUsdToCents(unitPriceDollars))})
                    </p>
                  : null}
                </FieldContent>
              </Field>
            </div>

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
                {normalizeRetailerImageUrl(draftProductImageUrl) ?
                  <div className={cn(dashItemsTableStatusPanel, "flex flex-wrap items-start gap-3 p-2")}>
                    <ProductRequestThumbnail
                      imageUrl={normalizeRetailerImageUrl(draftProductImageUrl)}
                      productLabel={productName.trim() || "Product"}
                      variant="dialog"
                      className="h-20 w-20 max-w-20"
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
                  Use store URL
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
