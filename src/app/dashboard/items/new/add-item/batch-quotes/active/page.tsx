import { z } from "zod";

import { DashboardAddItemBatchQuotesPanel } from "@/components/dashboard/dashboard-add-item-batch-quotes-panel";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const createdSessionIdSchema = z.string().uuid();

function parseCreatedBatchSessionId(
  raw: string | string[] | undefined,
): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = createdSessionIdSchema.safeParse(value?.trim());
  return parsed.success ? parsed.data : undefined;
}

export default async function DashboardAddItemBatchQuotesActivePage({
  searchParams,
}: PageProps) {
  const rawSp = (await searchParams) ?? {};
  const createdBatchSessionId = parseCreatedBatchSessionId(rawSp.created);

  return (
    <DashboardAddItemBatchQuotesPanel
      createdBatchSessionId={createdBatchSessionId}
    />
  );
}
