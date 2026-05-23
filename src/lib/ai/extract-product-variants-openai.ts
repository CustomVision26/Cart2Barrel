import OpenAI from "openai";
import { z } from "zod";

import type { ProductVariantOffer } from "@/lib/product-variants/types";
import { buildVariantLabel, priceUsdToCents } from "@/lib/product-variants/labels";

const variantRowSchema = z.object({
  label: z.union([z.string(), z.null()]).optional(),
  size: z.union([z.string(), z.null()]).optional(),
  color: z.union([z.string(), z.null()]).optional(),
  packLabel: z.union([z.string(), z.null()]).optional(),
  unitPriceUsd: z.union([z.number(), z.string(), z.null()]).optional(),
  productUrl: z.union([z.string(), z.null()]).optional(),
  imageUrl: z.union([z.string(), z.null()]).optional(),
  inStock: z.union([z.boolean(), z.null()]).optional(),
  isCurrent: z.union([z.boolean(), z.null()]).optional(),
});

const variantsResponseSchema = z.object({
  variants: z.array(variantRowSchema).max(40).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
});

function parseUsd(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * Enumerate SKU rows from product page HTML (Temu, Shein, Target, etc.).
 */
export async function extractProductVariantsWithOpenAI(
  htmlSlice: string,
  pageUrl: string,
  context?: {
    productSize?: string | null;
    productColor?: string | null;
  },
): Promise<{ variants: ProductVariantOffer[]; notes: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const body = htmlSlice.slice(0, 175_000);

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_completion_tokens: 3500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You extract ALL purchasable product variants/SKUs from e-commerce HTML.",
          "Return JSON: { variants: [...], notes }.",
          "Each variant object keys: label, size, color, packLabel, unitPriceUsd, productUrl, imageUrl, inStock, isCurrent.",
          "Rules:",
          "- List every distinct SKU you can find: sizes, colors, pack counts (2-pack, 6-pack), weights, etc.",
          "- unitPriceUsd: ONE unit price in USD for that SKU (number or null).",
          "- Match prices to the correct variant row from JSON in script tags (__NUXT__, __NEXT_DATA__, skuList, warehouseList, ld+json Offers).",
          "- For Walmart color swatches: each color tile shows its own price (e.g. rollback/sale)—use that price for that color, not the main item price.",
          "- isCurrent: true only for the variant that matches the page's pre-selected options",
          context?.productSize || context?.productColor
            ? ` or the requested size "${context.productSize ?? ""}" / color "${context.productColor ?? ""}".`
            : ".",
          "- productUrl: absolute https URL for that SKU when the page exposes per-SKU links; else null.",
          "- label: short human label combining color/size/pack when helpful.",
          "- Cap at 30 variants; prefer in-stock rows when many exist.",
          "- notes: brief caveat or null.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Product page URL: ${pageUrl}\n\nHTML:\n${body}`,
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

  const parsed = variantsResponseSchema.parse(parsedJson);
  const variants: ProductVariantOffer[] = [];

  for (const row of parsed.variants ?? []) {
    const size = row.size?.trim() || null;
    const color = row.color?.trim() || null;
    const packLabel = row.packLabel?.trim() || null;
    const label =
      row.label?.trim() ||
      buildVariantLabel({ size, color, packLabel });

    variants.push({
      id: `page-${variants.length}`,
      label,
      size,
      color,
      packLabel,
      priceUsdCents: priceUsdToCents(parseUsd(row.unitPriceUsd)),
      productUrl: row.productUrl?.trim() || null,
      imageUrl: row.imageUrl?.trim() || null,
      inStock: row.inStock ?? null,
      isCurrent: Boolean(row.isCurrent),
      source: "page_ai",
    });
  }

  return {
    variants,
    notes: parsed.notes?.trim() || null,
  };
}
