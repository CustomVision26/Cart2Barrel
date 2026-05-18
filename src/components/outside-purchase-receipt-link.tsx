import { ExternalLinkIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type OutsidePurchaseReceiptLinkProps = {
  url: string;
  className?: string;
};

/** Opens staff-uploaded proof-of-purchase in a new tab. */
export function OutsidePurchaseReceiptLink({
  url,
  className,
}: OutsidePurchaseReceiptLinkProps) {
  const href = url.trim();
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline",
        className,
      )}
    >
      <ExternalLinkIcon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      View receipt
    </a>
  );
}
