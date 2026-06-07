export type ParsedBatchEstimateAuditMemo = {
  audience: string;
  estimateRowId: string | null;
  batchNumber: string | null;
  rows: { label: string; value: string }[];
};

const BATCH_MEMO_MARKERS = ["Audience:", "Merchandise (batch sum):"] as const;

export function parseBatchEstimateAuditMemo(
  memo: string | null | undefined,
): ParsedBatchEstimateAuditMemo | null {
  const trimmed = memo?.trim();
  if (!trimmed) return null;
  if (!BATCH_MEMO_MARKERS.every((marker) => trimmed.includes(marker))) {
    return null;
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const audienceLine = lines.find((line) => line.startsWith("Audience:"));
  if (!audienceLine) return null;

  const audience = audienceLine.replace(/^Audience:\s*/, "").trim();
  let estimateRowId: string | null = null;
  let batchNumber: string | null = null;
  const rows: { label: string; value: string }[] = [];

  for (const line of lines) {
    if (line.startsWith("Audience:")) continue;
    if (line.startsWith("Batch estimate row:")) {
      estimateRowId = line.replace(/^Batch estimate row:\s*/, "").trim() || null;
      continue;
    }
    if (line.startsWith("Batch ")) {
      batchNumber = line.replace(/^Batch\s+/, "").trim() || null;
      continue;
    }
    const colonIdx = line.indexOf(": ");
    if (colonIdx === -1) continue;
    rows.push({
      label: line.slice(0, colonIdx).trim(),
      value: line.slice(colonIdx + 2).trim(),
    });
  }

  if (rows.length === 0) return null;

  return { audience, estimateRowId, batchNumber, rows };
}

export type BatchEstimateAuditMemoSection = {
  title: string;
  rows: { label: string; value: string }[];
};

export function batchEstimateAuditMemoSections(
  parsed: ParsedBatchEstimateAuditMemo,
): BatchEstimateAuditMemoSection[] {
  const byLabel = new Map(parsed.rows.map((row) => [row.label, row]));

  const pick = (...labels: string[]) =>
    labels
      .map((label) => byLabel.get(label))
      .filter((row): row is { label: string; value: string } => row != null);

  const sections: BatchEstimateAuditMemoSection[] = [
    { title: "Merchandise", rows: pick(
      "Merchandise (batch sum)",
      "Site merchandise (customer pays)",
      "Item discount",
    ) },
    { title: "Service & shipping", rows: pick(
      "Service & handling (batch sum)",
      "Shipping batch total",
      "Site shipping",
      "Shipping discount",
    ) },
    { title: "Tax", rows: pick(
      "Batch sale tax",
      "Site sale tax",
      "Sale tax discount",
    ) },
  ].filter((section) => section.rows.length > 0);

  const subtotal = byLabel.get("Subtotal sent to customer");
  if (subtotal) {
    sections.push({ title: "Customer subtotal", rows: [subtotal] });
  }

  return sections;
}
