export function getSerpApiKey(): string | null {
  const key = process.env.SERPAPI_API_KEY?.trim();
  return key || null;
}

export function serpApiNotConfiguredMessage(): string {
  return "SERPAPI_API_KEY is not set. Add it to .env to compare retailer prices.";
}
