import "server-only";

import { loadHubShipFromSettings } from "@/data/hub-ship-from";

/** City, state, and postal code for the configured U.S. hub, when one is saved. */
export async function budgetBarrelShoppingLocation(): Promise<string | null> {
  try {
    const hub = await loadHubShipFromSettings();
    const country = hub.country?.trim() || "United States";
    const parts = [hub.city?.trim(), hub.state?.trim(), hub.postalCode?.trim(), country]
      .filter((part): part is string => Boolean(part));
    return parts.length > 1 ? parts.join(", ") : null;
  } catch (error) {
    console.warn(
      "[Amani Cart2Barrel] Budget barrel hub location unavailable:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
