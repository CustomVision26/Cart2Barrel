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
 * `/admin` redirects to `/admin/overview` so Summary and Finance live under a stable path.
 */
export default async function AdminRootRedirect({ searchParams }: PageProps) {
  const rawSp = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  const tabRaw = first(rawSp.tab)?.toLowerCase();
  qs.set("tab", tabRaw === "finance" || tabRaw === "summary" ? tabRaw : "summary");
  const from = first(rawSp.from)?.trim();
  const to = first(rawSp.to)?.trim();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  redirect(`/admin/overview?${qs.toString()}`);
}
