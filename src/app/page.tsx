import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getProfileByClerkId,
  isProfileComplete,
} from "@/data/profiles";
import { UserButton } from "@clerk/nextjs";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (!profile || !isProfileComplete(profile)) {
      redirect("/onboarding");
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border/80 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Cart2Barrel
          </Link>
          <nav className="flex items-center gap-3">
            {userId ? (
              <UserButton />
            ) : (
              <>
                <Button variant="ghost" nativeButton={false} render={<Link href="/sign-in" />}>
                  Sign in
                </Button>
                <Button nativeButton={false} render={<Link href="/sign-up" />}>
                  Sign up
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Ship more home for less
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
            Browse and request items with agreed estimates, pay at checkout, and
            we purchase on your behalf. Your goods arrive for barrel packing and
            delivery to your address in Jamaica.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quotes &amp; cart</CardTitle>
              <CardDescription>
                Add vetted items once you accept an estimate; checkout when you are
                ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Catalog, pricing, and cart flows come next on top of this account
                profile.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Barrel consolidation</CardTitle>
              <CardDescription>
                We receive at our hub, pack, and ship to the Jamaican address on
                your profile.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your saved delivery details are used for every order after you
                complete onboarding.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
