import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { PostLoginWelcomeClient } from "@/components/auth/post-login-welcome-client";

export default async function WelcomePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  return <PostLoginWelcomeClient redirectTo="/" />;
}
