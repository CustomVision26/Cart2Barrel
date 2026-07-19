const WINDOW_DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

/** Shopper-facing start–end label for a timed special feature. */
export function formatSpecialFeatureWindowLabel(
  startsAt: string,
  endsAt: string,
): string | null {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const startLabel = start.toLocaleString(undefined, WINDOW_DATE_TIME_FORMAT);
  const endLabel = end.toLocaleString(undefined, WINDOW_DATE_TIME_FORMAT);
  return `${startLabel} – ${endLabel}`;
}
