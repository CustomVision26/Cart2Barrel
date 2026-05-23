import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { fetchPageHtmlForAi, isRetailerPageFetchBlockedMessage } from "@/lib/ai/fetch-page-for-ai";
import {
  buildPreviewFrameDocument,
  previewFrameBlockedDocument,
  previewFrameErrorDocument,
} from "@/lib/product-preview-frame-html";
import {
  hostRequiresExternalBrowserPreview,
  isInteractivePreviewBlockedHtml,
} from "@/lib/product-preview-blocked";
import { validateItemRequestRetailerUrl } from "@/lib/product-url/item-request-retailer-url";
import { hostnameFromProductUrl } from "@/lib/site-name";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const rawUrl = new URL(request.url).searchParams.get("url")?.trim();
  if (!rawUrl) {
    return new Response(previewFrameErrorDocument("Missing product URL."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const validated = validateItemRequestRetailerUrl(rawUrl);
  if (!validated.ok) {
    return new Response(previewFrameErrorDocument(validated.message), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const hostname = hostnameFromProductUrl(validated.href) ?? "This store";
  const blockedHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Frame-Options": "SAMEORIGIN",
    "X-Cart2Barrel-Preview-Mode": "blocked-interactive",
  } as const;

  if (hostRequiresExternalBrowserPreview(hostname)) {
    return new Response(previewFrameBlockedDocument(hostname), {
      status: 200,
      headers: blockedHeaders,
    });
  }

  try {
    const html = await fetchPageHtmlForAi(validated.href);
    if (isInteractivePreviewBlockedHtml(html)) {
      return new Response(previewFrameBlockedDocument(hostname), {
        status: 200,
        headers: blockedHeaders,
      });
    }
    const document = buildPreviewFrameDocument(validated.href, html);
    return new Response(document, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=300",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ?
        isRetailerPageFetchBlockedMessage(e.message) ?
          e.message
        : `Could not load this product page. Use Open in new tab to view the listing on the retailer site.`
      : "Could not load this product page.";
    return new Response(previewFrameErrorDocument(message), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  }
}
