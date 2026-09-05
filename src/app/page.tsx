import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { HomePageContent } from "@/components/marketing/home-page-content";
import { getProfileByClerkId, isOnboardingComplete } from "@/data/profiles";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (!profile || !(await isOnboardingComplete(userId, profile))) {
      redirect("/onboarding");
    }
  }

  return <HomePageContent userId={userId} />;
}
