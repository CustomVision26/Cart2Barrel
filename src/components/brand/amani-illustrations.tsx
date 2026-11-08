import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type IllustrationProps = {
  className?: string;
  title?: string;
};

function Frame({
  className,
  title,
  children,
}: IllustrationProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="img"
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("h-28 w-auto text-primary", className)}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** Step 1 — phone with a product link. */
export function IllustrationRetailerLink(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "Send a retailer link"}>
      <rect x="48" y="8" width="64" height="104" rx="12" fill="currentColor" opacity="0.12" />
      <rect x="54" y="18" width="52" height="78" rx="6" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <circle cx="80" cy="102" r="4" fill="currentColor" />
      <path
        d="M70 42h20M66 52h28M70 62h12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="112" cy="36" r="14" fill="#0d7a6c" />
      <path d="M106 36h12M112 30v12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </Frame>
  );
}

/** Step 2 — quote document with a check. */
export function IllustrationReviewPay(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "Review and pay"}>
      <rect x="42" y="12" width="76" height="96" rx="8" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <path d="M58 36h44M58 50h36M58 64h28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="108" cy="86" r="18" fill="#0d7a6c" />
      <path
        d="M100 86l6 6 12-14"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}

/** Step 3 — barrel and cargo box. */
export function IllustrationReceivePack(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "We receive and pack"}>
      <ellipse cx="58" cy="92" rx="28" ry="10" fill="currentColor" opacity="0.2" />
      <rect x="34" y="40" width="48" height="52" rx="8" fill="#1d6fb8" />
      <ellipse cx="58" cy="40" rx="24" ry="9" fill="#2b86d6" />
      <rect x="86" y="52" width="44" height="40" rx="4" fill="#c4a574" />
      <path d="M86 68h44" stroke="#8c7048" strokeWidth="3" />
    </Frame>
  );
}

/** Step 4 / shipping empty — cargo ship. */
export function IllustrationCargoShip(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "We arrange shipping"}>
      <path d="M18 86h124l-14 18H34z" fill="#0d7a6c" />
      <rect x="48" y="48" width="22" height="38" fill="#1d6fb8" />
      <rect x="74" y="36" width="22" height="50" fill="#2b86d6" />
      <rect x="100" y="54" width="22" height="32" fill="#c45c4a" />
      <path d="M12 86c18-8 40-8 58 0s40 8 78 0" fill="none" stroke="#7eb8d4" strokeWidth="4" />
    </Frame>
  );
}

export function IllustrationEmptyCart(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "Empty cart"}>
      <circle cx="62" cy="92" r="8" fill="currentColor" />
      <circle cx="108" cy="92" r="8" fill="currentColor" />
      <path
        d="M28 28h18l14 52h62l12-36H52"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M78 44v18M90 38v18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </Frame>
  );
}

export function IllustrationEmptyOrders(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "No paid orders yet"}>
      <rect x="44" y="22" width="72" height="52" rx="6" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <path d="M58 78h44v18H58z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="3" />
      <path d="M62 42h36M62 54h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </Frame>
  );
}

export function IllustrationShippingHistory(props: IllustrationProps) {
  return (
    <Frame {...props} title={props.title ?? "No shipped containers yet"}>
      <rect x="28" y="28" width="48" height="62" rx="4" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <path d="M38 44h28M38 56h20M38 68h24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="108" cy="62" r="28" fill="#0d7a6c" />
      <path
        d="M96 62l8 8 16-18"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Frame>
  );
}
