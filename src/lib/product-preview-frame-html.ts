import { assertHttpsProductUrl } from "@/lib/ai/url-safety";

/** Strip active content before serving retailer HTML in a same-origin preview frame. */
export function sanitizeHtmlForPreviewFrame(html: string): string {
  let out = html;
  out = out.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    "",
  );
  out = out.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  out = out.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  out = out.replace(/<embed\b[^>]*>/gi, "");
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(
    /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    "",
  );
  return out;
}

export function injectPreviewBaseTag(html: string, pageUrl: string): string {
  const base = assertHttpsProductUrl(pageUrl).href;
  const baseTag = `<base href="${base.replace(/"/g, "&quot;")}">`;
  if (/<base\s/i.test(html)) {
    return html;
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(
      /<html([^>]*)>/i,
      `<html$1><head>${baseTag}</head>`,
    );
  }
  return `<!DOCTYPE html><html><head>${baseTag}</head><body>${html}</body></html>`;
}

export function buildPreviewFrameDocument(pageUrl: string, html: string): string {
  const sanitized = sanitizeHtmlForPreviewFrame(html);
  return injectPreviewBaseTag(sanitized, pageUrl);
}

export function previewFrameBlockedDocument(
  retailerLabel: string,
): string {
  const safe = retailerLabel
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="cart2barrel-preview" content="blocked-interactive" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #0a0a0a; color: #e5e5e5; }
    h1 { font-size: 1rem; font-weight: 600; margin: 0 0 0.75rem; }
    p { max-width: 32rem; line-height: 1.55; font-size: 0.875rem; color: #a3a3a3; margin: 0 0 0.5rem; }
  </style>
</head>
<body data-cart2barrel-preview="blocked-interactive">
  <h1>${safe} requires a full browser tab</h1>
  <p>This store shows a &quot;press and hold&quot; verification that only works with JavaScript in a normal browser tab—not inside Cart2Barrel&apos;s preview window.</p>
  <p>Use <strong>Open in new tab</strong> in the preview toolbar, complete verification there, then fill in your request below.</p>
</body>
</html>`;
}

export function previewFrameErrorDocument(message: string): string {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #0a0a0a; color: #e5e5e5; }
    p { max-width: 36rem; line-height: 1.5; font-size: 0.9rem; }
  </style>
</head>
<body>
  <p>${safe}</p>
</body>
</html>`;
}
