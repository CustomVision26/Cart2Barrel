export type SpecialFeatureWindowStatus = "Draft" | "Scheduled" | "Live" | "Ended";

/** Draft / scheduled / live / ended from the offer window and publish flag. */
export function getSpecialFeatureWindowStatus(
  startsAt: string,
  endsAt: string,
  isActive: boolean,
): SpecialFeatureWindowStatus {
  if (!isActive) return "Draft";
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "Scheduled";
  if (now < start) return "Scheduled";
  if (now > end) return "Ended";
  return "Live";
}

export type SpecialFeatureContainerFormRef = {
  id: string;
  name: string;
  status: SpecialFeatureWindowStatus;
  priceUsdCents: number;
};

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
