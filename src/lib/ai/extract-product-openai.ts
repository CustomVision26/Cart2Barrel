import OpenAI from "openai";
import { z } from "zod";

import {
  extractOgImageFromHtml,
  normalizeHttpsImageUrlForPage,
} from "@/lib/ai/product-image-url";

const extractionSchema = z
  .object({
    productName: z.union([z.string(), z.null()]).optional(),
    siteName: z.union([z.string(), z.null()]).optional(),
    unitPriceUsd: z.union([z.number(), z.string(), z.null()]).optional(),
    productImageUrl: z.union([z.string(), z.null()]).optional(),
    color: z.union([z.string(), z.null()]).optional(),
    size: z.union([z.string(), z.null()]).optional(),
    notes: z.union([z.string(), z.null()]).optional(),
  })
  .transform((o) => ({
    productName: o.productName?.trim() || null,
    siteName: o.siteName?.trim() || null,
    unitPriceUsd: parseUsdNumber(o.unitPriceUsd),
    productImageUrl: o.productImageUrl?.trim() || null,
    color: o.color?.trim() || null,
    size: o.size?.trim() || null,
    notes: o.notes?.trim() || null,
  }));

export type AiProductExtraction = z.output<typeof extractionSchema>;

function parseUsdNumber(
  v: number | string | null | undefined
): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number.parseFloat(cleaned);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export type AiEstimateVariantContext = {
  quantity: number;
  productSize: string | null;
  productColor: string | null;
};

export async function extractProductWithOpenAI(
  htmlSlice: string,
  pageUrl: string,
  variantContext?: AiEstimateVariantContext
): Promise<AiProductExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const maxChars = variantContext != null ? 175_000 : 120_000;
  const body = htmlSlice.slice(0, maxChars);

  const variantLines =
    variantContext != null
      ? [
          "Variant / order context for pricing (staff entered these; the HTML may show a different pre-selected SKU):",
          `- quantity (units to buy): ${variantContext.quantity}`,
          `- requested size: ${variantContext.productSize?.trim() || "(not specified — infer only from page if obvious)"}`,
          `- requested color: ${variantContext.productColor?.trim() || "(not specified — infer only from page if obvious)"}`,
          "",
          "Apply this when extracting unitPriceUsd (critical on marketplaces like Temu/Amazon where each color/size can have a different sale price):",
          "- Sites often ship HTML with ONE \"current\" variant's price near the title (e.g. Rust selected). That headline price is NOT reliable for pricing unless you confirm the same variant (color/size) matches what was requested above.",
          '- When color and/or size are specified: find the price that belongs to THAT variant only. Search the entire HTML: option/sku matrices, tables, data-* attributes, and JSON blobs inside <script> (__NUXT__, __NEXT_DATA__, hydration payloads, productSku/spec/warehouseList style arrays, ld+json with multiple Offers). Pair price fields with the same object/row as the requested color name (match loosely: "Brown", "brown", etc.).',
          "- If the only clear per-unit price in the snapshot is visibly tied to a different color than requested (e.g. \"Color: Rust\" or selected thumb for Rust while staff asked Brown), do NOT use that price: keep searching for Brown's row/JSON entry, or set unitPriceUsd to null and say in notes that the snapshot shows another variant's price.",
          "- Prefer a price explicitly associated with the requested variant in structured data over a lone banner price with no variant linkage.",
          "- Match flexibly on labels (XL vs X-Large). If you cannot tie a numeric price to the requested variant after searching, null for unitPriceUsd and explain briefly in notes.",
          "- If quantity > 1 and the page shows a bundle/line/subtotal for that quantity for this variant, you may set unitPriceUsd to (that variant-appropriate line merchandise total ÷ quantity) when clearly applicable; otherwise use the single-unit sale price for that variant (before tax/shipping).",
          "- Return color and size in JSON to reflect the variant you priced (use requested strings when they match the row you used).",
          "",
        ].join("\n")
      : "";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_completion_tokens: 900,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You extract product listing data from raw HTML for a purchasing assistant.",
          "Return a single JSON object with keys: productName, siteName, unitPriceUsd, productImageUrl, color, size, notes.",
          "Rules:",
          "- productName: concise title if visible, else null.",
          "- siteName: short human-readable store or site name for this listing (e.g. Amazon, Temu, SHEIN, or the registrable domain without www). Infer from page branding, logo alt text, or the page URL host. null only if truly unknown.",
          "- unitPriceUsd: numeric USD price for ONE unit of the relevant variant (main or requested variant). Number or null. Never currency symbols inside JSON numbers.",
          "- When variant context is given in the user message, unitPriceUsd must correspond to that size/color (and quantity rules when stated). Never substitute another variant's price (e.g. do not return Rust's sale price when Brown was requested). If the HTML only exposes another variant's price, use null for unitPriceUsd.",
          "- productImageUrl: absolute https URL of the main product hero/primary image for that variant when possible.",
          "  Prefer og:image, twitter:image, JSON-LD image/url, or the main gallery image src.",
          "  Must be https. If relative, resolve using the page URL. If no suitable product image, null.",
          "- color and size: variant attributes for the row you priced; use requested values when they match the page, else what you inferred, else null.",
          "- notes: brief caveats (e.g. ambiguous variant, members-only price, multiple SKUs) or null.",
          "If price is ambiguous, use null for unitPriceUsd.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Product page URL (context): ${pageUrl}`,
          variantLines ? `\n${variantLines}` : "",
          "\nHTML follows:\n",
          body,
        ].join(""),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw?.trim()) {
    throw new Error("The model returned an empty response.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("The model returned invalid JSON.");
  }

  const rawExtraction = extractionSchema.parse(parsedJson);
  const fromModel = normalizeHttpsImageUrlForPage(
    rawExtraction.productImageUrl,
    pageUrl
  );
  const fromMeta = extractOgImageFromHtml(body, pageUrl);
  const productImageUrl = fromModel ?? fromMeta ?? null;

  return {
    ...rawExtraction,
    productImageUrl,
  };
}
