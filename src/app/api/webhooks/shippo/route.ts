import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { applyShippoTrackUpdated } from "@/data/hub-stock-us-package";

export const runtime = "nodejs";

/**
 * Intentionally public: Shippo POSTs tracking updates here (no Clerk session).
 * Authenticate with SHIPPO_WEBHOOK_TOKEN as `?token=` or `X-Shippo-Token` /
 * `Authorization: Bearer`.
 */
const trackStatusObjectSchema = z
  .object({
    status: z.string().optional(),
    status_details: z.string().optional(),
    statusDetails: z.string().optional(),
  })
  .passthrough();

const trackDataSchema = z
  .object({
    tracking_number: z.string().optional(),
    trackingNumber: z.string().optional(),
    transaction: z.string().optional(),
    carrier: z.string().optional(),
    tracking_url_provider: z.string().optional(),
    trackingUrlProvider: z.string().optional(),
    tracking_status: z.union([z.string(), trackStatusObjectSchema]).optional(),
    trackingStatus: z.union([z.string(), trackStatusObjectSchema]).optional(),
  })
  .passthrough();

const envelopeSchema = z.object({
  event: z.string(),
  test: z.boolean().optional(),
  data: z.unknown().optional(),
});

function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function webhookTokenFromRequest(req: Request): string | null {
  const url = new URL(req.url);
  const query = url.searchParams.get("token")?.trim();
  if (query) return query;
  const header = req.headers.get("x-shippo-token")?.trim();
  if (header) return header;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.match(/^(?:Bearer|Token)\s+(.+)$/i);
  return bearer?.[1]?.trim() || null;
}

function trackingFields(data: z.infer<typeof trackDataSchema>): {
  trackingNumber: string;
  transactionId: string | null;
  status: string | null;
  statusDetails: string | null;
  trackingUrl: string | null;
  carrier: string | null;
} {
  const trackingNumber = (data.trackingNumber ?? data.tracking_number ?? "").trim();
  const statusRaw = data.trackingStatus ?? data.tracking_status;
  let status: string | null = null;
  let statusDetails: string | null = null;
  if (typeof statusRaw === "string") {
    status = statusRaw.trim() || null;
  } else if (statusRaw && typeof statusRaw === "object") {
    status = statusRaw.status?.trim() || null;
    statusDetails =
      statusRaw.statusDetails?.trim() || statusRaw.status_details?.trim() || null;
  }
  return {
    trackingNumber,
    transactionId: data.transaction?.trim() || null,
    status,
    statusDetails,
    trackingUrl:
      data.trackingUrlProvider?.trim() || data.tracking_url_provider?.trim() || null,
    carrier: data.carrier?.trim() || null,
  };
}

export async function POST(req: Request) {
  const expected = process.env.SHIPPO_WEBHOOK_TOKEN?.trim() ?? "";
  if (!expected) {
    return new Response("SHIPPO_WEBHOOK_TOKEN is not set.", { status: 500 });
  }

  const provided = webhookTokenFromRequest(req);
  if (!provided || !tokensEqual(provided, expected)) {
    return new Response("Invalid webhook token.", { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) {
    return new Response("Unsupported webhook payload.", { status: 400 });
  }

  if (envelope.data.event !== "track_updated") {
    return new Response(null, { status: 200 });
  }

  const data = trackDataSchema.safeParse(envelope.data.data ?? {});
  if (!data.success) {
    return new Response("Invalid track payload.", { status: 400 });
  }

  const fields = trackingFields(data.data);
  if (!fields.trackingNumber) {
    return new Response("Missing tracking number.", { status: 400 });
  }

  const applied = await applyShippoTrackUpdated(fields);
  if (!applied.ok) {
    return new Response(applied.message, { status: 500 });
  }

  return new Response(null, { status: 200 });
}
