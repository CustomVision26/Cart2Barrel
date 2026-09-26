import "server-only";

import { usableRetailerProductImageUrl } from "@/lib/product-variants/variant-images";

const FETCH_MS = 8000;
const MAX_BYTES = 5_000_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function refererFor(href: string): string {
  try {
    const host = new URL(href).hostname.toLowerCase();
    if (host.includes("walmart")) return "https://www.walmart.com/";
    if (host.includes("amazon") || host.includes("media-amazon")) {
      return "https://www.amazon.com/";
    }
    if (host.includes("target")) return "https://www.target.com/";
    if (host.includes("keurig")) return "https://www.keurig.com/";
    return `${new URL(href).origin}/`;
  } catch {
    return "https://www.google.com/";
  }
}

/** Amazon often serves WebP even when the URL ends in .jpg (FMwebp). pdfkit cannot embed WebP. */
function preferPdfFriendlyHref(href: string): string {
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    if (
      !host.includes("media-amazon.com") &&
      !host.includes("ssl-images-amazon.com")
    ) {
      return href;
    }
    const idMatch = url.pathname.match(/\/images\/I\/([^./]+)/i);
    if (idMatch?.[1]) {
      url.pathname = `/images/I/${idMatch[1]}._SL320_.jpg`;
      url.search = "";
      return url.href;
    }
    url.pathname = url.pathname.replace(/_FMwebp_/gi, "_FMjpg_");
    return url.href;
  } catch {
    return href;
  }
}

function resolveImageHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || /\.pdf(?:$|\?)/i.test(trimmed)) return null;
  if (trimmed.startsWith("data:image/")) return trimmed;
  const usable = usableRetailerProductImageUrl(trimmed);
  const candidate =
    usable ??
    (trimmed.startsWith("//")
      ? `https:${trimmed}`
      : /^https?:\/\//i.test(trimmed)
        ? trimmed
        : null);
  if (candidate) return preferPdfFriendlyHref(candidate);
  if (trimmed.startsWith("/")) {
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
    return origin ? `${origin}${trimmed}` : null;
  }
  return null;
}

function isJpegOrPng(bytes: Buffer): boolean {
  return (
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47)
  );
}

async function toPng(
  bytes: Buffer,
  maxEdge: number,
  cover: boolean,
): Promise<Buffer | null> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(bytes)
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: cover ? "cover" : "inside",
        withoutEnlargement: !cover,
      })
      .png()
      .toBuffer();
  } catch {
    return isJpegOrPng(bytes) ? bytes : null;
  }
}

async function download(href: string): Promise<Buffer | null> {
  if (href.startsWith("data:image/")) {
    const match = href.match(/^data:image\/[^;]+;base64,(.+)$/i);
    if (!match?.[1]) return null;
    try {
      const bytes = Buffer.from(match[1], "base64");
      return bytes.length >= 32 && bytes.length <= MAX_BYTES ? bytes : null;
    } catch {
      return null;
    }
  }
  try {
    const response = await fetch(href, {
      signal: AbortSignal.timeout(FETCH_MS),
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/avif,image/*;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": BROWSER_UA,
        Referer: refererFor(href),
      },
      redirect: "follow",
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("svg") || contentType.includes("gif")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 32 || bytes.length > MAX_BYTES) return null;
    return bytes;
  } catch {
    return null;
  }
}

/** Fetch a remote photo and convert it to PNG so pdfkit can embed it. */
export async function fetchPdfEmbedImage(
  url: string | null | undefined,
  options?: { maxEdge?: number; cover?: boolean },
): Promise<Buffer | null> {
  const href = url ? resolveImageHref(url) : null;
  if (!href) return null;
  const bytes = await download(href);
  if (!bytes) return null;
  return toPng(bytes, options?.maxEdge ?? 1200, options?.cover ?? false);
}
