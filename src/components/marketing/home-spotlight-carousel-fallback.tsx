/** Placeholder while spotlight catalog data loads on the home page. */
export function HomeSpotlightCarouselFallback() {
  return (
    <section className="space-y-5" aria-busy="true" aria-label="Loading featured products">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 max-w-full animate-pulse rounded-md bg-muted/80" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-md bg-muted/80" />
      </div>
      <div className="h-[22rem] animate-pulse rounded-2xl border border-border/70 bg-muted/40 sm:h-[24rem]" />
    </section>
  );
}
