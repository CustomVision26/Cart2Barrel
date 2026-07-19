import OpenAI from "openai";
import { z } from "zod";

const bagFeeSchema = z.object({
  secondBagUsd: z.number().finite().nonnegative().nullable(),
  thirdBagUsd: z.number().finite().nonnegative().nullable(),
  fourthBagUsd: z.literal(null).optional(),
  notes: z.string().nullable().optional(),
});

export type AirlineCheckedBagFeeEstimate = {
  secondBagUsd: number | null;
  thirdBagUsd: number | null;
  fourthBagUsd: null;
  notes?: string | null;
};

/**
 * Ask OpenAI for 2nd / 3rd checked-bag fees (~50 lb) the traveler pays on the travel day.
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
          "You estimate published US airline checked-baggage fees passengers pay at check-in or prepaid online for a specific travel day. Return JSON only.",
      },
      {
        role: "user",
        content: [
          `Airline: ${airline}`,
          `Travel day: ${travelDay}`,
          "",
          "Cart2Barrel courier specials need ONLY the retail USD fees a traveler pays the airline on that travel day for:",
          "- the 2nd standard checked bag (~50 lb / 23 kg, not overweight/oversize)",
          "- the 3rd standard checked bag (~50 lb / 23 kg, not overweight/oversize)",
          "",
          "These are airline fees at the airport/on the travel day — not Cart2Barrel platform fees.",
          "Use that airline's typical published US check-in or online prepaid rate for the travel date.",
          "If fees vary by route or fare, pick the most common published US retail fee for that bag position.",
          "If unknown for a bag position, use null for that field.",
          "Do NOT estimate 4th or additional bags — always set fourthBagUsd to null.",
          "",
          "In notes, write 2–4 clear shopper-facing sentences about this airline's 2nd and 3rd checked-bag policy and typical USD amounts on the travel day. Do not mention 4th bags or Cart2Barrel.",
          "",
          'Return JSON: { "secondBagUsd": number|null, "thirdBagUsd": number|null, "fourthBagUsd": null, "notes": string|null }',
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

  return {
    secondBagUsd: parsed.data.secondBagUsd,
    thirdBagUsd: parsed.data.thirdBagUsd,
    fourthBagUsd: null,
    notes: parsed.data.notes ?? null,
  };
}
