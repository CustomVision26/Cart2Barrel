export const CONTACT_US_QUERY_KEY = "contact";
export const CONTACT_US_QUERY_VALUE = "us";
export const CONTACT_US_OPEN_EVENT = "amani-open-contact-us";

export function contactUsHref(): string {
  return `?${CONTACT_US_QUERY_KEY}=${CONTACT_US_QUERY_VALUE}`;
}

export function openContactUsDialog(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set(CONTACT_US_QUERY_KEY, CONTACT_US_QUERY_VALUE);
  window.history.replaceState({}, "", url);
  window.dispatchEvent(new Event(CONTACT_US_OPEN_EVENT));
}

export function urlRequestsContactUsDialog(): boolean {
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).get(CONTACT_US_QUERY_KEY) ===
    CONTACT_US_QUERY_VALUE
  );
}

export function clearContactUsQuery(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(CONTACT_US_QUERY_KEY) !== CONTACT_US_QUERY_VALUE) {
    return;
  }
  url.searchParams.delete(CONTACT_US_QUERY_KEY);
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}
