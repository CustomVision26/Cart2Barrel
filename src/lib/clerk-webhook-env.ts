/** Clerk webhook signing secret (Dashboard → Webhooks → Signing secret). */
export function getClerkWebhookSigningSecret(): string | undefined {
  return (
    process.env.CLERK_WEBHOOK_SECRET_KEY?.trim() ||
    process.env.CLERK_WEBHOOK_SIGNING_SECRET?.trim() ||
    undefined
  );
}

export function clerkWebhookSigningSecretNotConfiguredMessage(): string {
  return "CLERK_WEBHOOK_SECRET_KEY (or CLERK_WEBHOOK_SIGNING_SECRET) is not set.";
}
