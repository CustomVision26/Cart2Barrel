import { cn } from "@/lib/utils";

export type Cart2BarrelJourneyVariant = "loading" | "welcome";

type Cart2BarrelJourneyAnimationProps = {
  variant?: Cart2BarrelJourneyVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  showCaption?: boolean;
};

const sizeClasses = {
  sm: "w-44 max-w-full",
  md: "w-64 max-w-full",
  lg: "w-80 max-w-full sm:w-96",
} as const;

/** Shop → ship → deliver loop used for route buffering and post-login welcome. */
export function Cart2BarrelJourneyAnimation({
  variant = "loading",
  size = "md",
  className,
  showCaption = true,
}: Cart2BarrelJourneyAnimationProps) {
  const isWelcome = variant === "welcome";
  const statusLabel =
    isWelcome ? "Signing you in" : "Loading Cart2Barrel";

  return (
    <div
      className={cn(
        "cart2barrel-journey flex flex-col items-center gap-4 text-center",
        `cart2barrel-journey--${variant}`,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy={!isWelcome}
      aria-label={statusLabel}
    >
      <div
        className={cn(
          "cart2barrel-journey__scene relative",
          sizeClasses[size],
        )}
      >
        <svg
          viewBox="0 0 400 220"
          className="cart2barrel-journey__svg h-auto w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="c2b-journey-accent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--brand-logo-halo)" />
              <stop offset="100%" stopColor="var(--brand-logo-glow)" />
            </linearGradient>
            <radialGradient id="c2b-globe-fill" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="color-mix(in oklch, var(--brand-logo-glow) 35%, transparent)" />
              <stop offset="100%" stopColor="color-mix(in oklch, var(--brand-logo-glow) 8%, transparent)" />
            </radialGradient>
            <filter id="c2b-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path
            d="M 88 128 C 130 108, 170 98, 200 98 C 230 98, 270 108, 312 128"
            className="cart2barrel-journey__route"
            fill="none"
            stroke="url(#c2b-journey-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="6 10"
          />

          <g className="cart2barrel-journey__globe" transform="translate(200 108)">
            <circle r="46" fill="url(#c2b-globe-fill)" stroke="url(#c2b-journey-accent)" strokeWidth="1.5" />
            <ellipse rx="46" ry="14" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" />
            <ellipse rx="30" ry="46" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
            <ellipse rx="14" ry="46" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
          </g>

          <g className="cart2barrel-journey__cart" transform="translate(62 132)">
            <rect x="8" y="18" width="34" height="22" rx="4" fill="currentColor" fillOpacity="0.12" stroke="url(#c2b-journey-accent)" strokeWidth="1.5" />
            <path d="M 6 18 L 12 6 L 38 6 L 44 18" fill="none" stroke="url(#c2b-journey-accent)" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="16" cy="44" r="4" fill="currentColor" fillOpacity="0.35" />
            <circle cx="34" cy="44" r="4" fill="currentColor" fillOpacity="0.35" />
          </g>

          <g className="cart2barrel-journey__barrel" transform="translate(318 126)">
            <ellipse cx="18" cy="10" rx="16" ry="5" fill="currentColor" fillOpacity="0.1" stroke="url(#c2b-journey-accent)" strokeWidth="1.5" />
            <path d="M 2 10 L 4 44 C 4 50 32 50 34 44 L 36 10" fill="currentColor" fillOpacity="0.12" stroke="url(#c2b-journey-accent)" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 2 24 L 36 24 M 3 34 L 35 34" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
          </g>

          <g className="cart2barrel-journey__ship" transform="translate(176 168)">
            <path
              d="M 8 24 L 24 8 L 40 24 L 34 30 L 14 30 Z"
              fill="currentColor"
              fillOpacity="0.14"
              stroke="url(#c2b-journey-accent)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M 0 30 L 48 30" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
          </g>

          <g className="cart2barrel-journey__plane-orbit" transform="translate(200 108)">
            <g className="cart2barrel-journey__plane">
              <path
                d="M -10 0 L 8 0 L 14 -4 L 18 0 L 14 4 L 8 0 Z"
                fill="url(#c2b-journey-accent)"
                filter="url(#c2b-soft-glow)"
              />
            </g>
          </g>

          <circle
            className="cart2barrel-journey__packet cart2barrel-journey__packet--a"
            cx="88"
            cy="128"
            r="4"
            fill="var(--brand-logo-glow)"
          />
          <circle
            className="cart2barrel-journey__packet cart2barrel-journey__packet--b"
            cx="88"
            cy="128"
            r="3.5"
            fill="var(--brand-logo-halo)"
          />

          <g className="cart2barrel-journey__success" transform="translate(200 108)">
            <circle r="28" className="cart2barrel-journey__success-ring" fill="none" stroke="url(#c2b-journey-accent)" strokeWidth="2" />
            <path
              d="M -10 0 L -2 8 L 12 -8"
              fill="none"
              stroke="var(--brand-logo-halo)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {showCaption ?
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {isWelcome ? "Welcome aboard" : "Preparing your workspace"}
          </p>
          <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
            Shop · Ship · Deliver
          </p>
          <p className="sr-only">{statusLabel}</p>
        </div>
      : (
        <span className="sr-only">{statusLabel}</span>
      )}
    </div>
  );
}