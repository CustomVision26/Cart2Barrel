import { usableRetailerProductImageUrl } from "@/lib/product-variants/variant-images";
import { isSerpApiRateLimitError, serpApiGet } from "@/lib/serpapi/http";

type GoogleImageRaw = {
  original?: string;
  thumbnail?: string;
  source?: string;
  link?: string;
  title?: string;
};

function isSheinProductPhotoHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("ltwebstatic.com") || host.includes("shein.com");
  } catch {
    return false;
  }
}

function imageMentionsShein(raw: GoogleImageRaw): boolean {
  const hay = `${raw.source ?? ""} ${raw.link ?? ""} ${raw.title ?? ""} ${raw.original ?? ""}`.toLowerCase();
  return hay.includes("shein") || hay.includes("ltwebstatic");
}

/**
 * Google Images via SerpApi — used to recover SHEIN listing photos when the
 * product page is an empty JS shell.
 * @see https://serpapi.com/google-images-api
 */
export async function searchGoogleImagesForSheinProduct(
  query: string,
): Promise<string | null> {
  const q = query.trim();
  if (q.length < 8) return null;

  let data: { images_results?: GoogleImageRaw[] };
  try {
    data = await serpApiGet<{ images_results?: GoogleImageRaw[] }>({
      engine: "google_images",
      q,
      gl: "us",
      hl: "en",
      ijn: "0",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image search failed.";
    if (isSerpApiRateLimitError(msg)) {
      throw err instanceof Error ? err : new Error(msg);
    }
    return null;
  }

  for (const row of data.images_results ?? []) {
    if (!imageMentionsShein(row)) continue;
    const original = usableRetailerProductImageUrl(row.original);
    if (original && isSheinProductPhotoHost(original)) return original;
  }

  for (const row of data.images_results ?? []) {
    if (!imageMentionsShein(row)) continue;
    const thumb = usableRetailerProductImageUrl(row.thumbnail);
    if (thumb) return thumb;
  }

  return null;
}
