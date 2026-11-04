import OpenAI from "openai";

import { SHOPPING_LIST_MAX_LINES } from "@/lib/shopping-list-quote";

export type ExtractedShoppingListLine = {
  productName: string;
  quantity: number;
  productSize: string | null;
  productColor: string | null;
  note: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asTrimmedString(value: unknown, max: number): string | null {
  if (value == null) return null;
  let text = "";
  if (typeof value === "string") text = value;
  else if (typeof value === "number" && Number.isFinite(value)) text = String(value);
  else return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function parseQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 10_000) return n;
    return 1;
  }
  if (typeof value === "string") {
    const match = value.match(/(\d{1,5})/);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (n >= 1 && n <= 10_000) return n;
    }
  }
  return 1;
}

function findProductRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const obj = asRecord(value);
  if (!obj) return [];

  const preferred = ["products", "items", "lines", "rows", "list", "entries"];
  for (const key of preferred) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }

  for (const nested of Object.values(obj)) {
    if (Array.isArray(nested) && nested.some((row) => asRecord(row) !== null)) {
      return nested;
    }
    const nestedObj = asRecord(nested);
    if (nestedObj) {
      const inner = findProductRows(nestedObj);
      if (inner.length > 0) return inner;
    }
  }

  if (
    obj.productName ||
    obj.name ||
    obj.product ||
    obj.title ||
    obj.item ||
    obj.description
  ) {
    return [obj];
  }
  return [];
}

function normalizeLine(row: unknown): ExtractedShoppingListLine | null {
  const obj = asRecord(row);
  if (!obj) {
    const asName = asTrimmedString(row, 300);
    if (!asName) return null;
    return {
      productName: asName,
      quantity: 1,
      productSize: null,
      productColor: null,
      note: null,
    };
  }

  const productName = asTrimmedString(
    obj.productName ??
      obj.name ??
      obj.product ??
      obj.title ??
      obj.item ??
      obj.description,
    300,
  );
  if (!productName) return null;

  return {
    productName,
    quantity: parseQuantity(obj.quantity ?? obj.qty ?? obj.count ?? obj.amount),
    productSize: asTrimmedString(obj.size ?? obj.productSize ?? obj.packSize, 200),
    productColor: asTrimmedString(obj.color ?? obj.productColor ?? obj.colour, 200),
    note: asTrimmedString(obj.notes ?? obj.note ?? obj.details, 2000),
  };
}

/** Accepts the shapes vision models actually return, not only the prompt schema. */
export function normalizeExtractedShoppingListJson(
  parsedJson: unknown,
): ExtractedShoppingListLine[] {
  const lines: ExtractedShoppingListLine[] = [];
  for (const row of findProductRows(parsedJson)) {
    const line = normalizeLine(row);
    if (!line) continue;
    lines.push(line);
    if (lines.length >= SHOPPING_LIST_MAX_LINES) break;
  }
  return lines;
}

function parseJsonPayload(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const brace = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (brace >= 0 && end > brace) {
      return JSON.parse(raw.slice(brace, end + 1));
    }
    throw new Error("The AI response was not valid JSON. Try a clearer photo.");
  }
}

export async function extractShoppingListFromImage(params: {
  mimeType: string;
  imageBase64: string;
}): Promise<ExtractedShoppingListLine[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const dataUrl = `data:${params.mimeType};base64,${params.imageBase64}`;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_completion_tokens: 4000,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You convert photos of shopping lists into a structured product table. Handwritten grocery lists, numbered notes, receipts, screenshots, and product collages all count as product lists. Return JSON only.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              "Transcribe every product you can read, including messy handwriting. Prefer a best-guess name over skipping the line.",
              'Return JSON: {"products":[{...}]}.',
              "Each product object must include:",
              "- productName (required string — the item to buy)",
              "- quantity (JSON integer only, e.g. 2. Default 1 if unclear. Never put words like pack or box here.)",
              '- size (string or null — pack size, weight, clothing/shoe size. Example: "6-pack", "12 oz")',
              "- color (string or null)",
              "- notes (string or null — extra details, brand, store, or the original unclear text)",
              `At most ${SHOPPING_LIST_MAX_LINES} products. Skip headers, titles, totals, and ads.`,
              'Only return {"products":[]} if the image has no readable product names at all.',
            ].join("\n"),
          },
          { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    throw new Error("The AI did not return any products from this image.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = parseJsonPayload(raw);
  } catch {
    throw new Error("The AI response was not valid JSON. Try a clearer photo.");
  }

  return normalizeExtractedShoppingListJson(parsedJson);
}
