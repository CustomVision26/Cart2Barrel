import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ProfileForm } from "@/components/profile-form";
import {
  getOrCreateProfile,
  isProfileComplete,
} from "@/data/profiles";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    null;

  const profile = await getOrCreateProfile(userId, email);

  if (isProfileComplete(profile)) {
    redirect("/");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col items-center bg-background px-4 py-12">
      <ProfileForm profile={profile} />
    </div>
  );
}
