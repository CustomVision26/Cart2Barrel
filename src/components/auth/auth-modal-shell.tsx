"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";

type AuthModalBackOverride = {
  label: string;
  onBack: () => void;
};

const AuthModalBackContext = createContext<{
  setBackOverride: (next: AuthModalBackOverride | null) => void;
} | null>(null);

/** Lets a nested auth form replace Back to home (e.g. email verification → sign up). */
export function useAuthModalBack(override: AuthModalBackOverride | null) {
  const ctx = useContext(AuthModalBackContext);
  const label = override?.label;
  const onBack = override?.onBack;

  useEffect(() => {
    if (!ctx) return;
    if (!label || !onBack) {
      ctx.setBackOverride(null);
      return;
    }
    ctx.setBackOverride({ label, onBack });
    return () => ctx.setBackOverride(null);
  }, [ctx, label, onBack]);
}

/** Frosted overlay + card slot. Click outside, Back, or Escape returns to Home
 *  unless a nested form overrides the Back control. */
export function AuthModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [backOverride, setBackOverride] = useState<AuthModalBackOverride | null>(
    null,
  );
  const ctx = useMemo(() => ({ setBackOverride }), []);

  const goHome = useCallback(() => {
    router.push("/");
  }, [router]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        goHome();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goHome]);

  return (
    <AuthModalBackContext.Provider value={ctx}>
      <button
        type="button"
        className="fixed inset-0 z-[1] cursor-pointer bg-background/25 backdrop-blur-[2px]"
        aria-label="Close and return to home"
        onClick={goHome}
      />
      <div className="pointer-events-none relative z-10 flex min-h-full flex-1 items-center justify-center p-4 sm:p-6">
        <div
          className="pointer-events-auto w-full max-w-[420px] space-y-3"
          role="dialog"
          aria-modal="true"
        >
          {backOverride ?
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 text-foreground/90"
              onClick={backOverride.onBack}
            >
              <ArrowLeft className="size-4" aria-hidden />
              {backOverride.label}
            </Button>
          : <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
              className="-ml-2 text-foreground/90"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to home
            </Button>
          }
          {children}
        </div>
      </div>
    </AuthModalBackContext.Provider>
  );
}
