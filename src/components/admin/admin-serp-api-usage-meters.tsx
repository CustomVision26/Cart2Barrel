function UsageMeter({
  label,
  used,
  limit,
  remainingHint,
}: {
  label: string;
  used: number | null;
  limit: number | null;
  remainingHint?: string | null;
}) {
  const safeUsed = used ?? 0;
  const pct =
    limit != null && limit > 0 ? Math.min(100, (safeUsed / limit) * 100) : 0;
  const exhausted = limit != null && limit > 0 && safeUsed >= limit;

  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="font-heading text-base font-medium text-foreground">{label}</h2>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
        {used == null && limit == null ?
          "—"
        : `${safeUsed.toLocaleString()} / ${limit == null ? "—" : limit.toLocaleString()}`}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={exhausted ? "h-full bg-destructive" : "h-full bg-primary"}
          style={{ width: `${pct}%` }}
        />
      </div>
      {remainingHint ?
        <p className="mt-2 text-sm text-muted-foreground">{remainingHint}</p>
      : null}
    </section>
  );
}

export function AdminSerpApiUsageMeters({
  planName,
  searchesPerMonth,
  thisMonthUsage,
  planSearchesLeft,
  thisHourSearches,
  lastHourSearches,
  hourlyLimit,
  planRenewalDate,
  appHourCount,
  appMonthCount,
}: {
  planName: string | null;
  searchesPerMonth: number | null;
  thisMonthUsage: number | null;
  planSearchesLeft: number | null;
  thisHourSearches: number | null;
  lastHourSearches: number | null;
  hourlyLimit: number | null;
  planRenewalDate: string | null;
  appHourCount: number;
  appMonthCount: number;
}) {
  const monthHint =
    planSearchesLeft != null
      ? `${planSearchesLeft.toLocaleString()} searches left on the SerpApi plan${
          planRenewalDate ? ` · renews ${planRenewalDate}` : ""
        }.`
      : "Could not read the live SerpApi plan. Attributed app searches this month are shown in the table and charts.";
  const hourHint =
    lastHourSearches != null
      ? `Previous hour: ${lastHourSearches.toLocaleString()} billed searches.`
      : `Attributed in this app this hour: ${appHourCount.toLocaleString()}.`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <UsageMeter
        label={planName ? `Searches / month (${planName})` : "Searches / month"}
        used={thisMonthUsage ?? appMonthCount}
        limit={searchesPerMonth}
        remainingHint={monthHint}
      />
      <UsageMeter
        label="Searches / hour"
        used={thisHourSearches ?? appHourCount}
        limit={hourlyLimit}
        remainingHint={hourHint}
      />
    </div>
  );
}
