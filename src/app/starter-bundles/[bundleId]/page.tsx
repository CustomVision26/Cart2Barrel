import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { HomePageHeader } from "@/components/marketing/home-page-header";
import { SiteContactFooter } from "@/components/marketing/site-contact-footer";
import { StarterBundleRequestForm } from "@/components/marketing/starter-bundle-request-form";
import { getStarterBundleDetailForViewer } from "@/data/starter-bundles";
import { isClerkAdmin } from "@/lib/is-clerk-admin";
import { STARTER_BUNDLES_ROUTES } from "@/lib/starter-bundles";

export const dynamic = "force-dynamic";

export default async function StarterBundleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ bundleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();
  const { bundleId } = await params;
  const raw = (await searchParams) ?? {};
  const previewRaw = Array.isArray(raw.preview) ? raw.preview[0] : raw.preview;
  const previewRequested = previewRaw === "1" || previewRaw === "true";
  const user = previewRequested ? await currentUser() : null;
  const allowPreview = previewRequested && isClerkAdmin(user);

  const result = await getStarterBundleDetailForViewer({
    id: bundleId,
    allowUnpublishedPreview: allowPreview,
  });

  if (!result.ok) {
    if (result.reason === "archived") {
      redirect(`${STARTER_BUNDLES_ROUTES.listing}?notice=archived`);
    }
    notFound();
  }

  return (
    <div className="amani-storefront flex min-h-full flex-1 flex-col">
      <HomePageHeader userId={userId} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 md:py-14">
        <StarterBundleRequestForm
          initialBundle={result.detail}
          isSignedIn={Boolean(userId)}
          preview={allowPreview && result.status !== "published"}
        />
      </main>
      <Suspense fallback={null}>
        <SiteContactFooter />
      </Suspense>
    </div>
  );
}
