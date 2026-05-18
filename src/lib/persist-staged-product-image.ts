import { adminUploadItemRequestProductImageAction } from "@/actions/admin-upload-item-request-product-image";

export async function persistStagedProductImage(
  itemRequestId: string,
  stagedFile: File | null,
  fallbackUrl: string | null | undefined,
): Promise<{ ok: true; imageUrl: string | null } | { ok: false; message: string }> {
  if (stagedFile) {
    const fd = new FormData();
    fd.set("itemRequestId", itemRequestId);
    fd.set("persistToRequest", "false");
    fd.append("file", stagedFile);
    const res = await adminUploadItemRequestProductImageAction(fd);
    if (!res.ok) {
      return { ok: false, message: res.message };
    }
    return { ok: true, imageUrl: res.imageUrl };
  }

  const trimmed = fallbackUrl?.trim();
  return { ok: true, imageUrl: trimmed || null };
}
