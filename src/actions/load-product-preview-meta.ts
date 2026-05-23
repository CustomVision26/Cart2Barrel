"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { resolveSpotlightProductPageMeta } from "@/lib/spotlight-product-preview";
import { validateItemRequestRetailerUrl } from "@/lib/product-url/item-request-retailer-url";

const inputSchema = z.object({
  productUrl: z.string().min(1),
});

export type LoadProductPreviewMetaInput = z.infer<typeof inputSchema>;

export type ProductPreviewMeta = {
  title: string | null;
  imageUrl: string | null;
  href: string;
};

export type LoadProductPreviewMetaResult =
  | { ok: true; meta: ProductPreviewMeta }
  | { ok: false; message: string };

export async function loadProductPreviewMetaAction(
  input: LoadProductPreviewMetaInput,
): Promise<LoadProductPreviewMetaResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "Sign in required." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid preview request." };
  }

  const validated = validateItemRequestRetailerUrl(parsed.data.productUrl);
  if (!validated.ok) {
    return { ok: false, message: validated.message };
  }

  try {
    const pageMeta = await resolveSpotlightProductPageMeta(validated.href);
    return {
      ok: true,
      meta: {
        href: validated.href,
        title: pageMeta.title,
        imageUrl: pageMeta.imageUrl,
      },
    };
  } catch {
    return {
      ok: true,
      meta: {
        href: validated.href,
        title: null,
        imageUrl: null,
      },
    };
  }
}
