import "server-only";

import { Shippo } from "shippo";

import { usStateToAbbreviation } from "@/lib/us-states";

export type ShippoAddressInput = {
  name?: string | null;
  phone?: string | null;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country?: string;
};

export type ShippoParcelInput = {
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
};

export type ShippoQuotedRate = {
  cents: number;
  carrier: string;
  service: string;
  estimatedDays: number | null;
  durationTerms: string | null;
  /** Shippo rate `object_id` for purchasing a label. Empty when the quote cannot be bought. */
  objectId: string;
};

function shippoApiKey(): string | null {
  const raw = process.env.SHIPPO_API_KEY?.trim() ?? "";
  if (!raw) return null;
  const unquoted = raw.replace(/^["']|["']$/g, "").trim();
  const token = unquoted.replace(/^ShippoToken\s+/i, "").replace(/[^\x21-\x7E]/g, "");
  return token || null;
}

/** Shippo expects `Authorization: ShippoToken <key>`. */
function shippoAuthHeader(apiKey: string): string {
  const trimmed = apiKey.trim();
  return /^shippotoken\s+/i.test(trimmed) ? trimmed : `ShippoToken ${trimmed}`;
}

export function isShippoConfigured(): boolean {
  return Boolean(shippoApiKey());
}

function toShippoAddress(address: ShippoAddressInput) {
  const state = usStateToAbbreviation(address.state) ?? address.state.trim();
  return {
    name: address.name?.trim() || undefined,
    phone: address.phone?.trim() || undefined,
    street1: address.street1.trim(),
    street2: address.street2?.trim() || undefined,
    city: address.city.trim(),
    state,
    zip: address.zip.trim(),
    country: address.country?.trim() || "US",
  };
}

function mapUsdRates(rates: unknown[]): ShippoQuotedRate[] {
  const mapped: ShippoQuotedRate[] = [];
  for (const raw of rates) {
    if (!raw || typeof raw !== "object") continue;
    const rate = raw as Record<string, unknown>;
    const currency = String(rate.currency ?? "USD").toUpperCase();
    if (currency !== "USD") continue;
    const amount = Number.parseFloat(String(rate.amount ?? ""));
    if (!Number.isFinite(amount) || amount < 0) continue;
    const servicelevel =
      rate.servicelevel && typeof rate.servicelevel === "object" ?
        (rate.servicelevel as { name?: string; token?: string })
      : undefined;
    const estimatedRaw = rate.estimatedDays ?? rate.estimated_days;
    const estimatedDays =
      typeof estimatedRaw === "number" && Number.isFinite(estimatedRaw) && estimatedRaw > 0
        ? Math.round(estimatedRaw)
        : typeof estimatedRaw === "string" && Number.parseInt(estimatedRaw, 10) > 0
          ? Number.parseInt(estimatedRaw, 10)
          : null;
    const durationRaw = rate.durationTerms ?? rate.duration_terms;
    mapped.push({
      cents: Math.round(amount * 100),
      carrier: String(rate.provider ?? "").trim() || "Carrier",
      service:
        servicelevel?.name?.trim() ||
        servicelevel?.token?.trim() ||
        "Ground",
      estimatedDays,
      durationTerms:
        typeof durationRaw === "string" && durationRaw.trim() ?
          durationRaw.trim()
        : null,
      objectId: String(rate.objectId ?? rate.object_id ?? "").trim(),
    });
  }
  mapped.sort((a, b) => a.cents - b.cents || a.carrier.localeCompare(b.carrier));
  return mapped;
}

export function isCompareShippingCarrier(carrier: string): boolean {
  const name = carrier.trim().toLowerCase();
  return (
    name === "usps" ||
    name.startsWith("usps ") ||
    name === "ups" ||
    name.startsWith("ups ") ||
    name === "fedex" ||
    name.startsWith("fedex ")
  );
}

function shippoErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "body" in error &&
    typeof (error as { body: unknown }).body === "string"
  ) {
    const body = (error as { body: string; statusCode?: number; message?: string }).body;
    try {
      const parsed = JSON.parse(body) as {
        detail?: unknown;
        messages?: { text?: string }[];
      };
      if (typeof parsed.detail === "string" && parsed.detail.trim()) {
        const detail = parsed.detail.trim();
        if (/token does not exist/i.test(detail)) {
          return "Shippo rejected the API key. Create a new test key at portal.goshippo.com (API Configuration → Developer keys), set SHIPPO_API_KEY in .env with no spaces around =, then restart the server.";
        }
        if (/authentication credentials were not provided/i.test(detail)) {
          return "Shippo did not receive a valid API key. Check SHIPPO_API_KEY in .env and restart the server.";
        }
        return detail;
      }
      const first = parsed.messages?.find((row) => row.text?.trim())?.text?.trim();
      if (first) return first;
    } catch {
      /* use generic message */
    }
    const status = (error as { statusCode?: number }).statusCode;
    const message = (error as { message?: string }).message?.trim();
    if (message) return message;
    if (status) return `Shippo could not rate this shipment (${status}).`;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Could not reach Shippo. Try again in a moment.";
}

function isShippoTestApiKey(apiKey: string): boolean {
  return /shippo_test_/i.test(apiKey);
}

function testModeTrackingUnavailableMessage(carrierLabel: string): string {
  const label = carrierLabel.trim() || "this carrier";
  return `Shippo test keys cannot look up ${label} tracking. Open tracking to confirm on the carrier site, then click Next when it shows delivered. Automatic checks need a live Shippo API key.`;
}

function shippoTrackingApiErrorMessage(
  body: {
    detail?: unknown;
    messages?: { text?: string }[];
  } | null,
  status: number,
  carrierLabel: string,
): string {
  const detail = typeof body?.detail === "string" ? body.detail.trim() : "";
  const first = body?.messages?.find((row) => row.text?.trim())?.text?.trim() ?? "";
  const raw = detail || first;
  if (/not a valid test tracking carrier/i.test(raw)) {
    return testModeTrackingUnavailableMessage(carrierLabel);
  }
  return raw || `Shippo could not look up this tracking number (${status}).`;
}

/** Map a staff-entered carrier name to a Shippo tracking token. */
export function shippoTrackingCarrierToken(carrier: string): string | null {
  const raw = carrier.trim().toLowerCase();
  if (!raw) return null;
  if (/fed\s*ex|federal express/.test(raw)) return "fedex";
  if (/\bups\b|united parcel/.test(raw)) return "ups";
  if (/usps|united states postal|u\.s\. postal|postal service/.test(raw)) {
    return "usps";
  }
  if (/\bdhl\b/.test(raw)) return "dhl_express";
  if (/ontrac/.test(raw)) return "ontrac";
  if (raw === "shippo") return "shippo";
  return raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || null;
}

export type ShippoTrackingLookup =
  | {
      ok: true;
      skipped: true;
      message: string;
    }
  | {
      ok: true;
      skipped?: false;
      status: string;
      statusDetails: string | null;
      delivered: boolean;
    }
  | { ok: false; message: string };

/** Registers the tracking number with Shippo and returns the latest carrier status. */
export async function lookupShippoTrackingStatus(input: {
  carrier: string;
  trackingNumber: string;
}): Promise<ShippoTrackingLookup> {
  const apiKey = shippoApiKey();
  if (!apiKey) {
    return {
      ok: true,
      skipped: true,
      message:
        "Shippo is not configured. Open tracking to check the carrier page, then click Next when it shows delivered.",
    };
  }
  const carrier = shippoTrackingCarrierToken(input.carrier);
  const trackingNumber = input.trackingNumber.trim();
  if (!carrier || !trackingNumber) {
    return {
      ok: false,
      message: "Carrier name and tracking number are required to check delivery.",
    };
  }

  const carrierLabel = input.carrier.trim() || carrier;
  if (isShippoTestApiKey(apiKey) && carrier !== "shippo") {
    return {
      ok: true,
      skipped: true,
      message: testModeTrackingUnavailableMessage(carrierLabel),
    };
  }

  try {
    const response = await fetch("https://api.goshippo.com/tracks/", {
      method: "POST",
      headers: {
        Authorization: shippoAuthHeader(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        carrier,
        tracking_number: trackingNumber,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      detail?: unknown;
      tracking_status?: {
        status?: string;
        status_details?: string;
      };
      messages?: { text?: string }[];
    } | null;
    if (!response.ok) {
      const message = shippoTrackingApiErrorMessage(body, response.status, carrierLabel);
      if (/test keys cannot look up/i.test(message)) {
        return { ok: true, skipped: true, message };
      }
      return { ok: false, message };
    }
    const status = body?.tracking_status?.status?.trim() || "UNKNOWN";
    const statusDetails = body?.tracking_status?.status_details?.trim() || null;
    return {
      ok: true,
      status,
      statusDetails,
      delivered: status.toUpperCase() === "DELIVERED",
    };
  } catch (error) {
    return { ok: false, message: shippoErrorMessage(error) };
  }
}

/** Creates a Shippo shipment and returns USD rates (cheapest first). */
export async function listShippoUsdRates(input: {
  from: ShippoAddressInput;
  to: ShippoAddressInput;
  parcel: ShippoParcelInput;
}): Promise<{ ok: true; rates: ShippoQuotedRate[] } | { ok: false; message: string }> {
  return createShippoUsdRates(input);
}

/** Creates a Shippo shipment and returns the cheapest USD rate. */
export async function quoteShippoUsdRate(input: {
  from: ShippoAddressInput;
  to: ShippoAddressInput;
  parcel: ShippoParcelInput;
}): Promise<{ ok: true; rate: ShippoQuotedRate } | { ok: false; message: string }> {
  const listed = await createShippoUsdRates(input);
  if (!listed.ok) return listed;
  const rate = listed.rates[0];
  if (!rate) {
    return {
      ok: false,
      message: "Shippo did not return a US shipping rate for this address and package.",
    };
  }
  return { ok: true, rate };
}

async function createShippoUsdRates(input: {
  from: ShippoAddressInput;
  to: ShippoAddressInput;
  parcel: ShippoParcelInput;
}): Promise<{ ok: true; rates: ShippoQuotedRate[] } | { ok: false; message: string }> {
  const apiKey = shippoApiKey();
  if (!apiKey) {
    return {
      ok: false,
      message: "Shippo is not configured. Add SHIPPO_API_KEY on the server.",
    };
  }

  const weight = Number(input.parcel.weightOz);
  const length = Number(input.parcel.lengthIn);
  const width = Number(input.parcel.widthIn);
  const height = Number(input.parcel.heightIn);
  if (
    !Number.isFinite(weight) ||
    weight < 0.1 ||
    !Number.isFinite(length) ||
    length < 0.1 ||
    !Number.isFinite(width) ||
    width < 0.1 ||
    !Number.isFinite(height) ||
    height < 0.1
  ) {
    return {
      ok: false,
      message: "Package weight and dimensions are required for US shipping rates.",
    };
  }

  const round = (value: number) => (Math.round(value * 10) / 10).toFixed(1);
  const client = new Shippo({ apiKeyHeader: shippoAuthHeader(apiKey) });

  try {
    const shipment = await client.shipments.create({
      async: false,
      addressFrom: toShippoAddress(input.from),
      addressTo: toShippoAddress(input.to),
      parcels: [
        {
          massUnit: "oz",
          distanceUnit: "in",
          weight: round(weight),
          length: round(length),
          width: round(width),
          height: round(height),
        },
      ],
    });

    const rates = mapUsdRates(shipment.rates ?? []);
    if (rates.length === 0) {
      const hint = shipment.messages
        ?.map((row) => row.text?.trim())
        .find(Boolean);
      return {
        ok: false,
        message:
          hint ||
          "Shippo did not return a US shipping rate for this address and package.",
      };
    }
    return { ok: true, rates };
  } catch (error) {
    return { ok: false, message: shippoErrorMessage(error) };
  }
}

export type ShippoPurchasedLabel = {
  transactionId: string;
  trackingNumber: string;
  trackingUrl: string | null;
  carrier: string;
  service: string;
  labelUrl: string | null;
  trackingStatus: string | null;
};

/** Purchases a domestic PDF label for a rate returned by `listShippoUsdRates`. */
export async function purchaseShippoDomesticLabel(input: {
  rateObjectId: string;
  metadata?: string;
}): Promise<{ ok: true; label: ShippoPurchasedLabel } | { ok: false; message: string }> {
  const apiKey = shippoApiKey();
  if (!apiKey) {
    return {
      ok: false,
      message: "Shippo is not configured. Add SHIPPO_API_KEY on the server.",
    };
  }
  const rateObjectId = input.rateObjectId.trim();
  if (!rateObjectId) {
    return { ok: false, message: "That shipping rate can no longer be purchased. Compare rates again." };
  }

  const client = new Shippo({ apiKeyHeader: shippoAuthHeader(apiKey) });
  try {
    const transaction = await client.transactions.create({
      rate: rateObjectId,
      labelFileType: "PDF",
      async: false,
      metadata: input.metadata?.trim() || undefined,
    });
    if (transaction.status && transaction.status !== "SUCCESS") {
      const hint = transaction.messages
        ?.map((row) => row.text?.trim())
        .find(Boolean);
      return {
        ok: false,
        message:
          hint ||
          `Shippo could not purchase this label (${transaction.status.toLowerCase()}). Try again or enter tracking manually.`,
      };
    }
    const trackingNumber = transaction.trackingNumber?.trim() ?? "";
    if (!trackingNumber) {
      return {
        ok: false,
        message:
          "Shippo purchased the label but did not return a tracking number. Open the Shippo dashboard or enter tracking manually.",
      };
    }
    const rate =
      transaction.rate && typeof transaction.rate === "object" ? transaction.rate : null;
    const carrier = rate?.provider?.trim() || "Carrier";
    const service =
      rate?.servicelevelName?.trim() || rate?.servicelevelToken?.trim() || "Ground";
    return {
      ok: true,
      label: {
        transactionId: transaction.objectId?.trim() || rateObjectId,
        trackingNumber,
        trackingUrl: transaction.trackingUrlProvider?.trim() || null,
        carrier,
        service,
        labelUrl: transaction.labelUrl?.trim() || null,
        trackingStatus: transaction.trackingStatus?.trim() || "PRE_TRANSIT",
      },
    };
  } catch (error) {
    return { ok: false, message: shippoErrorMessage(error) };
  }
}

