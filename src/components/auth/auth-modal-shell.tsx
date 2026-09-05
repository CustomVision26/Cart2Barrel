"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Frosted overlay + card slot. Click outside, Back, or Escape returns to Home. */
export function AuthModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[1] cursor-pointer bg-background/25 backdrop-blur-[2px]"
        aria-label="Close and return to home"
        onClick={() => router.push("/")}
      />
      <div className="pointer-events-none relative z-10 flex min-h-full flex-1 items-center justify-center p-4 sm:p-6">
        <div
          className="pointer-events-auto w-full max-w-[420px] space-y-3"
          role="dialog"
          aria-modal="true"
        >
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/" />}
            className="-ml-2 text-foreground/90"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Button>
          {children}
        </div>
      </div>
    </>
  );
}
