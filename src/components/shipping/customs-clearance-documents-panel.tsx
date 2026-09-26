"use client";

import type { ReactNode } from "react";

import { CustomsClearanceForm } from "@/components/shipping/customs-clearance-form";
import { CustomsClearancePackActions } from "@/components/shipping/customs-clearance-pack-actions";

function DocumentRow({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2.5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium tracking-tight text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
    </li>
  );
}

export function CustomsClearanceDocumentsPanel({
  barrelId,
  published,
  customsFormUrl,
  containerName,
}: {
  barrelId: string;
  published: boolean;
  customsFormUrl?: string | null;
  containerName?: string;
}) {
  const formUrl = customsFormUrl?.trim() || null;

  return (
    <section className="overflow-hidden rounded-md border border-border/70 bg-muted/30">
      <header className="border-b border-border/60 px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Customs documentation
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Official documents issued for this shipment's destination customs clearance.
        </p>
      </header>
      <ul className="divide-y divide-border/60">
        <DocumentRow
          title="Customs clearance pack"
          description="Consolidated letter covering sender, freight, consignee, and packed contents."
          actions={
            published ?
              <CustomsClearancePackActions
                barrelId={barrelId}
                published
                compact
              />
            : <p className="text-xs text-muted-foreground">Awaiting publication</p>
          }
        />
        {formUrl ?
          <DocumentRow
            title="Customs declaration form"
            description="Declaration form held on file for this container."
            actions={
              <CustomsClearanceForm
                url={formUrl}
                containerName={containerName}
                compact
              />
            }
          />
        : null}
      </ul>
    </section>
  );
}
