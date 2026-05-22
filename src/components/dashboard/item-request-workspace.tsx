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
import { ExternalLink, Info, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { compareRetailerPricesAction } from "@/actions/compare-retailer-prices";
import type { RetailerPriceOffer } from "@/lib/retailer-price-compare";
import { draftItemRequestFromUrlAction } from "@/actions/customer-ai-item-draft";
import { fetchProductVariantsAction } from "@/actions/product-variants";
import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { ItemRequestProductVariants } from "@/components/dashboard/item-request-product-variants";
import { createItemRequestAction } from "@/actions/item-request";
import { ItemRequestCompareRetailers } from "@/components/dashboard/item-request-compare-retailers";
import { uploadItemRequestProductImageAction } from "@/actions/upload-item-request-product-image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const IFRAME_TITLE = "Shopping site preview";

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

/** Snapshot after a successful AI draft; used for merchandise preview + stale detection. */
type AiMerchPreviewState = {
  quantity: number;
  unitPriceCents: number | null;
  merchandiseSubtotalCents: number | null;
  variantSizeNorm: string;
  variantColorNorm: string;
};

type WorkspaceTab = "request" | "variants" | "compare";

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
  const [isAiPending, startAiTransition] = useTransition();
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
  const [iframeSrc, setIframeSrc] = useState<string | null>(
    spotlightSeed?.productUrl || null,
  );

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
      setIframeSrc(url);
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
    const merch = spotlightPrefillMerchPreview(spotlightPrefill, q);
    if (merch) setAiMerchPreview(merch);
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

  const openPreviewInNewTab = useCallback(() => {
    const url =
      normalizeUrlInput(previewInput) || normalizeUrlInput(productUrl);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [previewInput, productUrl]);

  const loadPreview = useCallback(() => {
    const fromPreview = normalizeUrlInput(previewInput);
    const fromLink = normalizeUrlInput(productUrl);
    const url = fromPreview || fromLink;
    if (!url) {
      setIframeSrc(null);
      return;
    }
    if (!fromPreview && fromLink) {
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : fromLink);
    }
    setIframeSrc(url);
  }, [previewInput, productUrl]);

  const syncPreviewAndProductLink = useCallback(() => {
    const fromPreview = normalizeUrlInput(previewInput);
    if (fromPreview) {
      setProductUrl(fromPreview);
      return;
    }
    const fromLink = normalizeUrlInput(productUrl);
    if (fromLink) {
      const raw = productUrl.trim();
      setPreviewInput(/^https?:\/\//i.test(raw) ? raw : fromLink);
      setIframeSrc(fromLink);
    }
  }, [previewInput, productUrl]);

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
  const quantityOk = parseQuantity(quantity) != null;
  const canSubmit = urlsAligned && quantityOk && !isPending;
  const canRunAi =
    urlsAligned &&
    quantityOk &&
    isRetailerProductUrl &&
    !isAiPending &&
    !isSpotlightFeed;
  const fillAiDisabledTitle =
    isSpotlightFeed ?
      "Details were loaded from spotlight—edit fields manually if needed."
    : isAiPending || isPending ? undefined
    : !hasPreviewUrl || !hasProductLinkUrl ?
      "Fill preview and product URLs"
    : !urlsAligned ?
      "Product link must match the preview URL"
    : !quantityOk ?
      "Enter quantity 1–999"
    : !isRetailerProductUrl ?
      retailerProductUrlCheck.message
    : undefined;
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
      "Product link must match the preview URL"
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

  const runAiDraft = useCallback(() => {
    setAiMessage(null);
    setLastAiNotes(null);
    setDraftSiteName(null);
    setDraftProductImageUrl(null);
    const retailerCheck = validateItemRequestRetailerUrl(productUrl);
    if (!retailerCheck.ok) {
      setAiMessage(retailerCheck.message);
      return;
    }
    if (!urlsMatchForSubmit(previewInput, productUrl)) {
      setAiMessage(
        'Product URL (preview) and Product link must match. Use "Use preview URL above" so both fields use the same address.'
      );
      return;
    }
    if (parseQuantity(quantity) == null) {
      setAiMessage("Enter a quantity between 1 and 999.");
      return;
    }
    startAiTransition(async () => {
      const res = await draftItemRequestFromUrlAction({
        productUrl: retailerCheck.href,
        quantity,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setAiMerchPreview(null);
        setDraftSiteName(null);
        setDraftProductImageUrl(null);
        const blocked = isRetailerPageFetchBlockedMessage(res.message ?? "");
        setAiMessage(
          blocked ?
            `${MANUAL_PRODUCT_NAME_AFTER_BLOCKED_SCRAPE} ${MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT}`
          : (res.message ?? "AI could not read this page."),
        );
        return;
      }
      setFieldErrors(undefined);
      setDraftSiteName(res.siteName ?? null);
      setDraftProductImageUrl(res.productImageUrl ?? null);
      if (res.productName) {
        setProductName(res.productName);
      }
      if (res.productSize) {
        setProductSize(res.productSize);
      }
      if (res.productColor) {
        setProductColor(res.productColor);
      }
      setAiMerchPreview({
        quantity: res.quantity,
        unitPriceCents: res.unitPriceCents,
        merchandiseSubtotalCents: res.merchandiseSubtotalCents,
        variantSizeNorm: (
          res.productSize?.trim() ? res.productSize : productSize
        )
          .trim()
          .toLowerCase(),
        variantColorNorm: (
          res.productColor?.trim() ? res.productColor : productColor
        )
          .trim()
          .toLowerCase(),
      });
      setLastAiNotes(res.aiNotes);
      if (res.aiNotes) {
        setNote((prev) => {
          const t = prev.trim();
          return t ? `${t}\n\n— From AI: ${res.aiNotes}` : res.aiNotes!;
        });
      }
      setAiMessage(
        "Details and a merchandise cost preview were filled from the listing. Review everything, then submit your request to staff."
      );
    });
  }, [previewInput, productUrl, quantity, productSize, productColor]);

  const submit = useCallback(() => {
    setFormMessage(null);
    setFieldErrors(undefined);
    if (!urlsMatchForSubmit(previewInput, productUrl)) {
      setFormMessage(
        'Product URL (preview) and Product link must be the same address. Use "Use preview URL above" or edit both fields so they match.'
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
        setAiMessage(null);
        setLastAiNotes(null);
        setDraftSiteName(null);
        setDraftProductImageUrl(null);
        setAiMerchPreview(null);
        setPendingProductPhoto(null);
        if (productPhotoRef.current) productPhotoRef.current.value = "";
        setPreviewInput("");
        setIframeSrc(null);
        setProductUrl("");
        setProductName("");
        setProductSize("");
        setProductColor("");
        setNote("");
        setQuantity("1");
        setFormResetKey((k) => k + 1);
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
  ]);

  const runLoadVariants = useCallback(() => {
    setVariantsMessage(null);
    const url = parseValidHttpsProductUrl(productUrl);
    if (!url) {
      setVariantsMessage("Enter a valid https product link before loading variants.");
      return;
    }
    if (!urlsMatchForSubmit(previewInput, productUrl)) {
      setVariantsMessage(
        "Product URL (preview) and Product link must match before loading variants.",
      );
      return;
    }
    startVariantsTransition(async () => {
      const res = await fetchProductVariantsAction({
        productUrl: url,
        productName: productName.trim() || undefined,
        productSize: productSize.trim() || undefined,
        productColor: productColor.trim() || undefined,
      });
      if (!res.ok) {
        setVariantsMessage(res.message);
        return;
      }
      setVariantRows(res.variants);
      setVariantRetailer(res.retailer);
      setVariantMethod(res.method);
      setVariantsMessage(
        `Found ${res.variants.length} variant${res.variants.length === 1 ? "" : "s"} at ${res.retailer}.`,
      );
      setActiveTab("variants");
    });
  }, [previewInput, productUrl, productName, productSize, productColor]);

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
      setIframeSrc(url);
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
          const res = await draftItemRequestFromUrlAction({
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
      setCompareMessage(
        `Found ${res.offers.length} verified offer${res.offers.length === 1 ? "" : "s"}.`,
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

  const previewIframeClass =
    "h-[min(72vh,560px)] w-full bg-background xl:h-[min(78vh,620px)]";
  const previewPlaceholderClass =
    "flex h-[min(50vh,360px)] w-full items-center justify-center px-6 text-center text-sm text-muted-foreground xl:min-h-[min(44vh,380px)]";

  const browseCard = (
    <Card className="overflow-hidden border-border/80 shadow-none">
      <CardHeader className="space-y-1 border-b border-border bg-muted/30 px-6 py-5">
        <CardTitle className="text-base font-semibold tracking-tight">
          Product preview
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Enter the retailer product URL to load an embedded preview. If the frame
          is blank, the store may block embeds—use{" "}
          <span className="font-medium text-foreground">Open in new tab</span> to
          view the listing, then confirm the same URL in the request form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <label
              htmlFor="item-preview-product-url"
              className="text-sm font-medium text-foreground"
            >
              Preview URL
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
              aria-label="Product URL for preview"
              placeholder="https://example-store.com/…"
              value={previewInput}
              onChange={(e) => setPreviewInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  loadPreview();
                }
              }}
              className="min-w-0 flex-1"
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" onClick={loadPreview} disabled={!canUseUrlSync}>
                Load preview
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={openPreviewInNewTab}
                disabled={!canUseUrlSync}
              >
                <ExternalLink className="size-4" />
                Open in new tab
              </Button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-md border border-border bg-muted/15">
            {iframeSrc ? (
              <iframe
                title={IFRAME_TITLE}
                src={iframeSrc}
                className={previewIframeClass}
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className={previewPlaceholderClass}>
                Enter a URL above and select Load preview to display the listing
                here.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
  );

  const requestCard = (
    <Card className="overflow-hidden border-border/80 shadow-none">
      <CardHeader className="space-y-1 border-b border-border bg-muted/30 px-6 py-5">
        <CardTitle className="text-base font-semibold tracking-tight">
          Request details
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Complete the fields below. AI can extract title, variant, and an estimated
          merchandise subtotal (retailer product cost only). Staff will issue an
          official quote after review.
        </CardDescription>
      </CardHeader>
        <CardContent className="px-6 py-5">
          <FieldSet key={formResetKey} className="gap-6">
            <div className="space-y-4 rounded-md border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                <div
                  role="note"
                  className="flex gap-3 rounded-md border border-border bg-background/80 px-3 py-3 text-xs leading-relaxed"
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
                <p className="leading-relaxed">
                  {variantRows.length > 0 ?
                    <>
                      Variants are available on the{" "}
                      <span className="font-medium text-foreground">
                        Store variants
                      </span>{" "}
                      tab. Select Apply to populate the form, then review all fields
                      before submission.
                    </>
                  : <>
                      Align the preview URL with the product link, enter quantity and
                      optional variant fields, then use{" "}
                      <span className="font-medium text-foreground">
                        Extract listing details
                      </span>{" "}
                      or{" "}
                      <span className="font-medium text-foreground">
                        Load store variants
                      </span>
                      . All fields remain editable before you submit.
                    </>
                  }
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                {variantRows.length === 0 ?
                  <Button
                    type="button"
                    className={cn(
                      "gap-1.5",
                      (!canRunAi || isSpotlightFeed) && "opacity-50",
                    )}
                    variant="secondary"
                    disabled={!canRunAi}
                    onClick={runAiDraft}
                    title={fillAiDisabledTitle}
                  >
                    {isAiPending ?
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Filling…
                      </>
                    : <>
                        <Sparkles className="size-4" aria-hidden />
                        Extract listing details
                      </>
                    }
                  </Button>
                : null}
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "gap-1.5",
                    !canLoadVariants && "opacity-50",
                  )}
                  disabled={!canLoadVariants}
                  title={loadVariantsDisabledTitle}
                  onClick={runLoadVariants}
                >
                  {isVariantsPending ?
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading…
                    </>
                  : "Load store variants"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={!canCompare}
                  onClick={runComparePrices}
                >
                  {isComparePending ?
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Comparing…
                    </>
                  : "Compare retailer prices"}
                </Button>
                </div>
                {aiMessage ? (
                  <p
                    className={cn(
                      "mt-2 text-sm",
                      aiMessage.includes("Review") ||
                      aiMessage.includes("filled") ||
                      aiMessage.includes("merchandise cost preview")
                        ? "text-muted-foreground"
                        : "text-destructive"
                    )}
                    role="status"
                  >
                    {aiMessage}
                  </p>
                ) : null}
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
                        Quantity, size, or color changed after extraction. Run{" "}
                        <span className="font-medium text-foreground">
                          Extract listing details
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
                <FieldLabel htmlFor="item-product-url">Product link</FieldLabel>
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
                  <FieldDescription>
                    Paste the product page URL for this request (sent to staff). It must
                    match the Product URL (preview) above—use{" "}
                    <span className="font-medium text-foreground">
                      Use preview URL above
                    </span>{" "}
                    to copy the preview link here.
                  </FieldDescription>
                  <FieldError errors={fieldError("productUrl")?.map((m) => ({ message: m }))} />
                </FieldContent>
              </Field>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={syncPreviewAndProductLink}
                disabled={!canUseUrlSync}
              >
                {hasPreviewUrl
                  ? "Use preview URL above"
                  : "Use product link in preview"}
              </Button>
            </FieldGroup>

            <Separator />

            <Field data-invalid={Boolean(fieldError("productName")?.length)}>
              <FieldLabel htmlFor="item-product-name">
                Product name
              </FieldLabel>
              <FieldContent>
                <Input
                  id="item-product-name"
                  name="productName"
                  placeholder="e.g. Brand — model"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  aria-invalid={Boolean(fieldError("productName")?.length)}
                />
                <FieldDescription>
                  Required for price comparison (minimum 2 characters). If extraction
                  or Apply could not read the page, copy the product title from the
                  retailer listing.
                </FieldDescription>
                <FieldError errors={fieldError("productName")?.map((m) => ({ message: m }))} />
              </FieldContent>
            </Field>

            {needsManualProductName ?
              <p
                role="status"
                className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground"
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
              <FieldLabel htmlFor="item-product-photo">
                Product photo{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <FieldContent className="space-y-2">
                <FieldDescription>
                  Filled from the listing when you Apply a store variant or run AI. You can
                  also upload your own file (JPEG, PNG, WebP, or GIF up to 8 MB)—upload
                  replaces the listing image on submit.
                </FieldDescription>
                {draftProductImageUrl?.trim() ?
                  <div className="flex flex-wrap items-start gap-3 rounded-md border border-border bg-muted/20 p-2">
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
                  className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex w-full resize-y rounded-lg border px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground"
              >
                Preview URL and product link must match. Select{" "}
                <span className="font-medium text-foreground">
                  Use preview URL above
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

            <Button
              type="button"
              disabled={!canSubmit}
              title={
                !canSubmit && !isPending
                  ? !hasPreviewUrl || !hasProductLinkUrl
                    ? "Fill in Product URL (preview) and Product link"
                    : !urlsAligned
                      ? "Preview URL and product link must match"
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
          className="flex flex-col gap-3 rounded-md border border-border bg-muted/25 px-4 py-3.5 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-pretty leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Spotlight prefill applied.</span>{" "}
            Product link, name, pricing, variant, and image (when available) have been
            populated. Listing extraction is disabled—review the form, submit for staff
            review, or open Price comparison to evaluate other retailers.
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
        className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1"
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
          aria-selected={activeTab === "variants"}
          className={tabClass("variants")}
          onClick={() => setActiveTab("variants")}
        >
          Store variants
          {variantRows.length > 0 ?
            <span className={tabCountClass}>{variantRows.length}</span>
          : null}
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
      : activeTab === "variants" ?
        <div className="min-w-0 space-y-6">
          <ItemRequestProductVariants
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
