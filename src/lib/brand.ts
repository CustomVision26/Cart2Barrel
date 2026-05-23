import { statSync } from "node:fs";
import path from "node:path";

export const BRAND_NAME = "Cart2Barrel";

export const BRAND_LOGO_FILENAME = "amani-cart2barrel-logo.png";

export const BRAND_LOGO_ALT = `${BRAND_NAME} logo`;

let logoSrcCache: { mtimeMs: number; src: string } | null = null;

/** Logo URL with a cache-busting query when the file on disk changes. */
export function getBrandLogoSrc(): string {
  const filePath = path.join(process.cwd(), "public", BRAND_LOGO_FILENAME);

  try {
    const mtimeMs = statSync(filePath).mtimeMs;

    if (!logoSrcCache || logoSrcCache.mtimeMs !== mtimeMs) {
      logoSrcCache = {
        mtimeMs,
        src: `/${BRAND_LOGO_FILENAME}?v=${mtimeMs}`,
      };
    }

    return logoSrcCache.src;
  } catch {
    return `/${BRAND_LOGO_FILENAME}`;
  }
}
