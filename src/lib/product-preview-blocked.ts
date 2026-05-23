/** Retailer HTML that needs JS/captcha cannot render inside our sanitized preview frame. */
export function isInteractivePreviewBlockedHtml(html: string): boolean {
  const low = html.toLowerCase();
  return (
    low.includes("robot or human") ||
    low.includes("activate and hold") ||
    low.includes("confirm that you're human") ||
    low.includes("confirm you are human") ||
    low.includes("are you a robot") ||
    low.includes("px-captcha") ||
    low.includes("perimeterx") ||
    low.includes("cf-challenge") ||
    low.includes("challenge-platform") ||
    low.includes("datadome") ||
    low.includes("arkose")
  );
}

/** Hosts that almost always serve captcha / bot checks to server or embedded views. */
export function hostRequiresExternalBrowserPreview(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "walmart.com" ||
    host.endsWith(".walmart.com") ||
    host === "amazon.com" ||
    host.endsWith(".amazon.com") ||
    host.includes("amazon.") ||
    host === "target.com" ||
    host.endsWith(".target.com")
  );
}
