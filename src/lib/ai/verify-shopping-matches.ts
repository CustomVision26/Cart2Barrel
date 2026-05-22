import OpenAI from "openai";
import { z } from "zod";

const verificationBatchSchema = z.object({
  results: z.array(
    z.object({
      candidateIndex: z.number().int(),
      match: z.boolean(),
      confidence: z.number().min(0).max(1),
      reason: z.string().optional(),
    }),
  ),
});

export type ShoppingMatchCandidate = {
  index: number;
  title: string;
  retailer: string;
};

export type VerifiedShoppingMatch = {
  candidateIndex: number;
  match: boolean;
  confidence: number;
  reason: string | null;
};

export type OriginalProductContext = {
  title: string;
  size: string | null;
  color: string | null;
  retailer: string | null;
};

const MATCH_CONFIDENCE_THRESHOLD = 0.9;

export { MATCH_CONFIDENCE_THRESHOLD };

/**
 * Use OpenAI to score whether SerpApi shopping hits are the same SKU as the reference product.
 */
export async function verifyShoppingMatchesWithOpenAI(
  original: OriginalProductContext,
  candidates: ShoppingMatchCandidate[],
): Promise<VerifiedShoppingMatch[]> {
  if (candidates.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const candidateLines = candidates
    .map(
      (c) =>
        `[${c.index}] ${c.retailer}: ${c.title}`,
    )
    .join("\n");

  const originalBlock = [
    `Title: ${original.title}`,
    original.size ? `Size: ${original.size}` : null,
    original.color ? `Color: ${original.color}` : null,
    original.retailer ? `Listed at: ${original.retailer}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You verify whether Google Shopping search results refer to the SAME purchasable product as a reference listing.",
          "Reject: different generation/model, refurbished/open-box unless reference is refurbished, bundles, accessories, wrong color/size when reference specifies them.",
          "Accept only near-exact matches (same model and variant when variant is known).",
          `Return JSON: { "results": [ { "candidateIndex": number, "match": boolean, "confidence": 0-1, "reason": string } ] }`,
          `Only mark match true when confidence >= ${MATCH_CONFIDENCE_THRESHOLD}.`,
          "Include every candidate index from the list.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Original product:\n${originalBlock}\n\nCandidates:\n${candidateLines}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("AI returned an empty verification response.");
  }

  let parsed: z.infer<typeof verificationBatchSchema>;
  try {
    parsed = verificationBatchSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("AI verification response was not valid JSON.");
  }

  const byIndex = new Map(
    parsed.results.map((r) => [r.candidateIndex, r] as const),
  );

  return candidates.map((c) => {
    const hit = byIndex.get(c.index);
    return {
      candidateIndex: c.index,
      match: hit?.match ?? false,
      confidence: hit?.confidence ?? 0,
      reason: hit?.reason?.trim() || null,
    };
  });
}
