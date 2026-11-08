import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { HomePageHeader } from "@/components/marketing/home-page-header";
import { SiteContactFooter } from "@/components/marketing/site-contact-footer";
import { StarterBundlesListing } from "@/components/marketing/starter-bundles-listing";
import { listPublishedStarterBundles } from "@/data/starter-bundles";

export const dynamic = "force-dynamic";

function noticeFromParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "archived") {
    return "That starter bundle is no longer available. Choose another published bundle, or upload your own list from Requested items → Shopping list.";
  }
  return null;
}

export default async function StarterBundlesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  const raw = (await searchParams) ?? {};
  const bundles = await listPublishedStarterBundles();

  return (
    <div className="amani-storefront flex min-h-full flex-1 flex-col">
      <HomePageHeader userId={userId} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 md:py-14">
        <StarterBundlesListing
          bundles={bundles}
          notice={noticeFromParam(raw.notice)}
        />
      </main>
      <Suspense fallback={null}>
        <SiteContactFooter />
      </Suspense>
    </div>
  );
}
