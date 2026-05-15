import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { ClerkUserButton } from "@/components/clerk-user-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HowItWorksPage() {
  const { userId } = await auth();

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
              <>
                <span
                  className="px-3 py-2 text-sm font-medium text-foreground"
                  aria-current="page"
                >
                  How it works
                </span>
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  Dashboard
                </Button>
                <ClerkUserButton />
              </>
            ) : (
              <>
                <span
                  className="px-3 py-2 text-sm font-medium text-foreground"
                  aria-current="page"
                >
                  How it works
                </span>
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href="/login" />}
                >
                  Sign in
                </Button>
                <Button nativeButton={false} render={<Link href="/signup" />}>
                  Sign up
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            How it works
          </p>
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
                your saved shipping label.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your shipping address (separate from account contact) is used for
                every order after you complete onboarding.
              </p>
            </CardContent>
          </Card>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Back home
        </Button>
      </main>
    </div>
  );
}
