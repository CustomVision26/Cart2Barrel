import { ExternalLinkIcon, LinkIcon } from "lucide-react";

type SupportTicketMessageProductLinksProps = {
  productLinks: string[];
};

function linkLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const label = `${host}${path}`;
    return label.length > 48 ? `${label.slice(0, 45)}…` : label;
  } catch {
    return url.length > 48 ? `${url.slice(0, 45)}…` : url;
  }
}

export function SupportTicketMessageProductLinks({
  productLinks,
}: SupportTicketMessageProductLinksProps) {
  if (productLinks.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1.5">
      {productLinks.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/80 bg-background/60 px-2 py-1 text-xs text-foreground hover:border-primary/40 hover:text-primary"
          >
            <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{linkLabel(url)}</span>
            <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
