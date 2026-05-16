import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(
  param: string | string[] | undefined,
): string | undefined {
  return Array.isArray(param) ? param[0] : param;
}

/**
 * Legacy route: finance UI lives under `/admin/overview?tab=finance`.
 */
export default async function AdminFinanceRedirect({ searchParams }: PageProps) {
  const rawSp = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  qs.set("tab", "finance");
  const from = first(rawSp.from)?.trim();
  const to = first(rawSp.to)?.trim();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  redirect(`/admin/overview?${qs.toString()}`);
}
