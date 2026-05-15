/**
 * Server-side Vercel Blob writes use {@link process.env.BLOB_READ_WRITE_TOKEN}.
 * Create a read-write token in the Vercel dashboard (Storage → Blob → Tokens).
 */
export function getBlobReadWriteToken(): string | undefined {
  const t = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return t || undefined;
}

export function blobReadWriteNotConfiguredMessage(): string {
  return "File upload is not configured. Set BLOB_READ_WRITE_TOKEN (Vercel Blob read/write token).";
}
