"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Cart2BarrelLoadingScreen } from "@/components/brand/cart2barrel-loading-screen";
import { cn } from "@/lib/utils";

const JOURNEY_MS = 1500;
const SUCCESS_MS = 1200;
const FADE_MS = 500;

type PostLoginWelcomeClientProps = {
  redirectTo: string;
};

/** Short branded interstitial after Clerk sign-in / sign-up. */
export function PostLoginWelcomeClient({ redirectTo }: PostLoginWelcomeClientProps) {
  const router = useRouter();
  const [variant, setVariant] = useState<"loading" | "welcome">("loading");
  const [phase, setPhase] = useState<"playing" | "fading">("playing");

  useEffect(() => {
    const successTimer = window.setTimeout(() => {
      setVariant("welcome");
    }, JOURNEY_MS);

    const fadeTimer = window.setTimeout(() => {
      setPhase("fading");
    }, JOURNEY_MS + SUCCESS_MS);

    const redirectTimer = window.setTimeout(() => {
      router.replace(redirectTo);
    }, JOURNEY_MS + SUCCESS_MS + FADE_MS);

    return () => {
      window.clearTimeout(successTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(redirectTimer);
    };
  }, [redirectTo, router]);

  return (
    <div
      className={cn(
        "transition-opacity duration-500 ease-out",
        phase === "fading" ? "opacity-0" : "opacity-100",
      )}
    >
      <Cart2BarrelLoadingScreen variant={variant} layout="fullscreen" />
    </div>
  );
}
