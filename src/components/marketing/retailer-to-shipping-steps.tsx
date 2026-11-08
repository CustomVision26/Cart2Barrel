import Image from "next/image";

import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "1",
    title: "Send a retailer link",
    body: "Paste a product link or upload your shopping list.",
    src: "/marketing/step-send-retailer-link-cut.png",
    alt: "Hand holding a phone with a product link",
  },
  {
    n: "2",
    title: "Review and pay",
    body: "Approve your quote and pay so we can buy your items.",
    src: "/marketing/step-review-and-pay-cut.png",
    alt: "Quote document with an approved checkmark",
  },
  {
    n: "3",
    title: "We receive and pack",
    body: "We pack your items in a barrel or cargo box.",
    src: "/marketing/step-receive-and-pack-cut.png",
    alt: "Blue shipping barrel beside a cardboard cargo box",
  },
  {
    n: "4",
    title: "We arrange shipping",
    body: "Our freight partners ship your container overseas.",
    src: "/marketing/step-arrange-shipping-theme.png",
    alt: "Cargo ship carrying containers overseas",
  },
] as const;

type RetailerToShippingStepsProps = {
  className?: string;
  heading?: string;
};

/** Shared four-step journey for Home and How it works. */
export function RetailerToShippingSteps({
  className,
  heading = "From retailer link to shipping",
}: RetailerToShippingStepsProps) {
  return (
    <section
      id="from-retailer-link-to-shipping"
      className={cn("space-y-6", className)}
      aria-labelledby="retailer-to-shipping-heading"
    >
      <h2
        id="retailer-to-shipping-heading"
        className="text-center font-heading text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
        style={{ fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif" }}
      >
        {heading}
      </h2>
      <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-stretch">
        {STEPS.flatMap((step, index) => {
          const card = (
            <li key={step.n} className="min-w-0">
              <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
                <div className="relative flex items-start gap-2 bg-card px-4 pt-4">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground">
                    {step.n}
                  </span>
                  <div className="relative h-28 flex-1 overflow-hidden bg-card sm:h-32">
                    <Image
                      src={step.src}
                      alt={step.alt}
                      fill
                      sizes="(max-width: 1280px) 45vw, 240px"
                      className="object-contain object-center drop-shadow-[0_6px_14px_rgba(18,59,74,0.18)] dark:drop-shadow-[0_8px_18px_rgba(246,241,232,0.28)]"
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5 px-5 py-4">
                  <h3
                    className="font-heading text-base font-semibold text-foreground"
                    style={{
                      fontFamily:
                        "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    className="font-sans text-sm font-normal leading-snug text-muted-foreground"
                    style={{
                      fontFamily:
                        "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {step.body}
                  </p>
                </div>
              </article>
            </li>
          );
          if (index >= STEPS.length - 1) return [card];
          return [
            card,
            <li
              key={`arrow-${step.n}`}
              aria-hidden
              className="hidden items-center justify-center self-center text-2xl leading-none text-muted-foreground xl:flex"
            >
              →
            </li>,
          ];
        })}
      </ol>
    </section>
  );
}
