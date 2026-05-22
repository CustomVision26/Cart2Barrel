/** Product name must be at least this long to enable Compare prices with AI. */
export const MIN_PRODUCT_NAME_LENGTH_FOR_COMPARE = 2;

export function isProductNameReadyForCompare(name: string): boolean {
  return name.trim().length >= MIN_PRODUCT_NAME_LENGTH_FOR_COMPARE;
}

/** Shown when scrape fails or name is still empty after Apply / Fill with AI. */
export const MANUAL_PRODUCT_NAME_FOR_COMPARE_SHORT =
  "Copy the product title from the retailer page into Product name (2+ characters) so Compare prices with AI can run.";

export const MANUAL_PRODUCT_NAME_AFTER_BLOCKED_SCRAPE =
  "This retailer blocked an automatic read. Open the product page (preview or Open in new tab), copy the exact title from the site, and paste it into Product name on the Item request tab.";

export const COMPARE_REQUIRES_PRODUCT_NAME_MESSAGE =
  "Compare prices with AI needs a product name with at least 2 characters. If the field is empty, open the listing, copy the title from the retailer site, and paste it into Product name on the Item request tab.";
