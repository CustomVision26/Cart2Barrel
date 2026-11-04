"use server";

import { put } from "@vercel/blob";
import { auth } from "@clerk/nextjs/server";

import { extractShoppingListFromImage } from "@/lib/ai/extract-shopping-list-openai";
import {
  isRetailerReceiptImageMime,
  retailerReceiptExtensionForMime,
  RETAILER_RECEIPT_IMAGE_MAX_BYTES,
} from "@/lib/retailer-receipt-images";
import {
  blobReadWriteNotConfiguredMessage,
  getBlobReadWriteToken,
} from "@/lib/vercel-blob-env";

export type ParsedShoppingListLine = {
  clientKey: string;
  productName: string;
  quantity: number;
  productSize: string;
  productColor: string;
  note: string;
  productImageUrl: string;
};

export type ParseShoppingListImageState =
  | {
      ok: true;
      sourceImageUrl: string;
      lines: ParsedShoppingListLine[];
    }
  | { ok: false; message: string };

export async function parseShoppingListImageAction(
  raw: unknown,
): Promise<ParseShoppingListImageState> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, message: "You must be signed in to upload a list." };
  }

  if (!(raw instanceof FormData)) {
    return { ok: false, message: "Choose a list photo to upload." };
  }
  const file = raw.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a list photo to upload." };
  }
  if (!isRetailerReceiptImageMime(file.type)) {
    return {
      ok: false,
      message: "Only JPEG, PNG, WebP, and GIF images are allowed.",
    };
  }
  if (file.size > RETAILER_RECEIPT_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      message: `Each image must be at most ${Math.round(RETAILER_RECEIPT_IMAGE_MAX_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const token = getBlobReadWriteToken();
  if (!token) {
    return { ok: false, message: blobReadWriteNotConfiguredMessage() };
  }

  const ext = retailerReceiptExtensionForMime(file.type);
  let sourceImageUrl: string;
  try {
    const blob = await put(
      `shopping-list-source/${userId}/${crypto.randomUUID()}.${ext}`,
      file,
      {
        access: "public",
        token,
        contentType: file.type || undefined,
      },
    );
    sourceImageUrl = blob.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save the list photo.";
    return { ok: false, message: msg };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractShoppingListFromImage({
      mimeType: file.type,
      imageBase64: buffer.toString("base64"),
    });
    if (extracted.length === 0) {
      return {
        ok: false,
        message: "No products were found in that photo. Try a clearer list image.",
      };
    }
    return {
      ok: true,
      sourceImageUrl,
      lines: extracted.map((row, index) => ({
        clientKey: `ai-${index}-${crypto.randomUUID().slice(0, 8)}`,
        productName: row.productName,
        quantity: row.quantity,
        productSize: row.productSize ?? "",
        productColor: row.productColor ?? "",
        note: row.note ?? "",
        productImageUrl: "",
      })),
    };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Could not read products from this photo.";
    return { ok: false, message: msg };
  }
}
