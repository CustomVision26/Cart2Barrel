import OpenAI from "openai";
import { z } from "zod";

const bagFeeSchema = z.object({
  secondBagUsd: z.number().finite().nonnegative().nullable(),
  thirdBagUsd: z.number().finite().nonnegative().nullable(),
  fourthBagUsd: z.number().finite().nonnegative().nullable(),
  notes: z.string().nullable().optional(),
});

export type AirlineCheckedBagFeeEstimate = z.infer<typeof bagFeeSchema>;

/**
 * Ask OpenAI for typical checked-bag fees (~50 lb) for 2nd+ bags on a travel day.
 */
export async function estimateAirlineCheckedBagFeeWithOpenAI(input: {
  airlineName: string;
  travelDateIso: string;
}): Promise<AirlineCheckedBagFeeEstimate> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });
  const airline = input.airlineName.trim();
  const travelDay = input.travelDateIso.slice(0, 10);

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You estimate published airline checked-baggage fees for US-origin passenger travel. Return JSON only.",
      },
      {
        role: "user",
        content: [
          `Airline: ${airline}`,
          `Travel day (UTC date): ${travelDay}`,
          "These are OUTSIDE airline fees a traveler would pay at the airline if they add 2nd, 3rd, or 4th checked bags on that travel day (not Cart2Barrel platform fees).",
          "Estimate USD fees for standard checked suitcases up to about 50 lb (23 kg), not overweight/oversize.",
          "Return fees for the 2nd checked bag and additional bags (3rd, 4th) for typical US–Caribbean / US domestic published rates when known.",
          "If fees vary by route or fare, pick the most common published US retail fee for that bag position on the travel day.",
          "If unknown, use null for that field and explain briefly in notes.",
          "In notes, write a clear customer-facing extra note about that airline's checked-bag policy for 2nd+ bags on the travel day (include typical USD amounts when known).",
          'Return JSON: { "secondBagUsd": number|null, "thirdBagUsd": number|null, "fourthBagUsd": number|null, "notes": string|null }',
        ].join("\n"),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error("AI returned an empty baggage-fee response.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("AI baggage-fee response was not valid JSON.");
  }

  const parsed = bagFeeSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("AI baggage-fee response did not match the expected shape.");
  }
  return parsed.data;
}
