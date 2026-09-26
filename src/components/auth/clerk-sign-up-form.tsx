"use client";

import { useAuth, useClerk, useSignUp } from "@clerk/nextjs";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthModalBack } from "@/components/auth/auth-modal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function clerkErrorText(
  error: { longMessage?: string; message?: string } | null | undefined,
): string | null {
  const text = error?.longMessage?.trim() || error?.message?.trim();
  return text || null;
}

function clerkAlreadySignedIn(
  error: { code?: string; message?: string; longMessage?: string } | null,
): boolean {
  if (!error) return false;
  const text =
    `${error.code ?? ""} ${error.message ?? ""} ${error.longMessage ?? ""}`.toLowerCase();
  return (
    text.includes("already signed in") ||
    text.includes("session_exists") ||
    error.code === "identifier_already_signed_in"
  );
}

function isClerkTestEmail(value: string): boolean {
  return /\+clerk_test@/i.test(value);
}

function clerkNameParamRejected(
  error: { code?: string; message?: string; longMessage?: string } | null,
): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.longMessage ?? ""}`.toLowerCase();
  return (
    text.includes("first_name") ||
    text.includes("last_name") ||
    text.includes("first name") ||
    text.includes("last name")
  );
}

function PasswordVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      onClick={onToggle}
    >
      {visible ?
        <EyeOffIcon className="size-4" />
      : <EyeIcon className="size-4" />}
    </Button>
  );
}

export function ClerkSignUpForm() {
  const router = useRouter();
  const clerk = useClerk();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [code, setCode] = useState("");
  const [pendingVerify, setPendingVerify] = useState(false);
  /** User left the email-code step; keep showing the filled create-account form. */
  const [dismissedVerify, setDismissedVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);
  /** Clerk restores an in-progress sign-up on the client only — wait until after
   *  hydration before switching to the email-code step. */
  const [hasMounted, setHasMounted] = useState(false);
  const justSentCodeRef = useRef(false);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    router.push("/welcome");
    router.refresh();
  }, [authLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!hasMounted) return;
    const clerkEmail = signUp?.emailAddress?.trim();
    const clerkFirst = signUp?.firstName?.trim();
    const clerkLast = signUp?.lastName?.trim();
    if (!email.trim() && clerkEmail) setEmail(clerkEmail);
    if (!firstName.trim() && clerkFirst) setFirstName(clerkFirst);
    if (!lastName.trim() && clerkLast) setLastName(clerkLast);
  }, [
    email,
    firstName,
    hasMounted,
    lastName,
    signUp?.emailAddress,
    signUp?.firstName,
    signUp?.lastName,
  ]);

  const givenName = firstName.trim();
  const familyName = lastName.trim();

  async function navigateAfterAuth(decorateUrl: (path: string) => string) {
    const url = decorateUrl("/welcome");
    if (url.startsWith("http")) {
      window.location.href = url;
      return;
    }
    router.push(url);
    router.refresh();
  }

  async function applyCollectedNames() {
    try {
      await clerk.user?.update({
        firstName: givenName,
        lastName: familyName,
      });
    } catch {
      // Name attributes may be disabled on this Clerk instance.
    }
  }

  async function finishIfComplete(): Promise<boolean> {
    if (!signUp || signUp.status !== "complete") return false;
    const { error: finalizeError } = await signUp.finalize({
      navigate: async ({ decorateUrl }) => {
        await navigateAfterAuth(decorateUrl);
      },
    });
    if (finalizeError) {
      if (clerkAlreadySignedIn(finalizeError)) {
        await navigateAfterAuth((path) => path);
        return true;
      }
      setError(clerkErrorText(finalizeError) ?? "Could not finish sign-up.");
      return false;
    }
    await applyCollectedNames();
    return true;
  }

  async function sendVerificationCode(): Promise<boolean> {
    if (!signUp || sendInFlightRef.current) return false;
    sendInFlightRef.current = true;
    setSendingCode(true);
    try {
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) {
        setError(
          clerkErrorText(sent.error) ?? "Could not send a verification code.",
        );
        return false;
      }
      justSentCodeRef.current = true;
      setResendWait(30);
      setError(null);
      return true;
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Could not send a verification code.",
      );
      return false;
    } finally {
      sendInFlightRef.current = false;
      setSendingCode(false);
    }
  }

  async function onCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const emailAddress = email.trim();
    try {
      const sameEmailPendingVerify =
        signUp.status === "missing_requirements" &&
        signUp.unverifiedFields.includes("email_address") &&
        signUp.missingFields.length === 0 &&
        (signUp.emailAddress?.trim() ?? "") === emailAddress;
      if (sameEmailPendingVerify) {
        const ok = await sendVerificationCode();
        if (!ok) return;
        setDismissedVerify(false);
        setPendingVerify(true);
        return;
      }
      let created = await signUp.password({
        firstName: givenName,
        lastName: familyName,
        emailAddress,
        password,
      });
      if (created.error && clerkNameParamRejected(created.error)) {
        created = await signUp.password({
          emailAddress,
          password,
          unsafeMetadata: { firstName: givenName, lastName: familyName },
        });
      }
      if (created.error) {
        setError(clerkErrorText(created.error) ?? "Could not create your account. Try again.");
        return;
      }
      if (await finishIfComplete()) return;
      if (signUp.unverifiedFields.includes("email_address")) {
        const ok = await sendVerificationCode();
        if (!ok) return;
        setDismissedVerify(false);
        setPendingVerify(true);
        return;
      }
      setError("Account created, but sign-in did not finish. Try Sign in.");
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Could not create your account. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setError(null);
    setSubmitting(true);
    try {
      const verified = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (verified.error) {
        if (clerkAlreadySignedIn(verified.error)) {
          await navigateAfterAuth((path) => path);
          return;
        }
        setError(clerkErrorText(verified.error) ?? "Verification did not complete.");
        return;
      }
      if (await finishIfComplete()) return;
      setError("Verification did not complete. Check the code and try again.");
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Verification did not complete. Check the code and try again.";
      if (clerkAlreadySignedIn({ message })) {
        await navigateAfterAuth((path) => path);
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const glass =
    "mx-auto w-full max-w-[420px] rounded-xl bg-background/35 p-6 shadow-xl ring-1 ring-white/15 backdrop-blur-md";
  const field =
    "h-9 bg-background/45 backdrop-blur-sm dark:bg-background/45";
  const busy = !signUp || fetchStatus === "fetching" || submitting;
  const fieldError =
    clerkErrorText(errors.fields.firstName) ||
    clerkErrorText(errors.fields.lastName) ||
    clerkErrorText(errors.fields.emailAddress) ||
    clerkErrorText(errors.fields.password) ||
    clerkErrorText(errors.fields.code) ||
    clerkErrorText(errors.fields.captcha) ||
    clerkErrorText(errors.global?.[0]);
  const alert = error || fieldError;
  const clerkNeedsEmailVerify =
    signUp?.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;
  const needsEmailVerify =
    !dismissedVerify &&
    (pendingVerify || (hasMounted && clerkNeedsEmailVerify));

  const goBackToSignUp = useCallback(() => {
    setDismissedVerify(true);
    setPendingVerify(false);
    setCode("");
    setError(null);
    justSentCodeRef.current = false;
    setResendWait(0);
  }, []);

  useAuthModalBack(
    needsEmailVerify && !isSignedIn ?
      { label: "Back to sign up", onBack: goBackToSignUp }
    : null,
  );

  useEffect(() => {
    if (!needsEmailVerify || !signUp || !hasMounted || isSignedIn) return;
    if (justSentCodeRef.current || sendInFlightRef.current) return;
    void sendVerificationCode();
  }, [hasMounted, isSignedIn, needsEmailVerify, signUp]);

  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = window.setTimeout(() => setResendWait((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendWait]);

  if (authLoaded && isSignedIn) {
    return (
      <div className={glass}>
        <h1 className="text-xl font-semibold tracking-tight">You are signed in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Continuing to your account…
        </p>
      </div>
    );
  }

  if (needsEmailVerify) {
    return (
      <form onSubmit={onVerify} className={glass}>
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isClerkTestEmail(email) ?
            <>
              This is a Clerk test address. Enter <span className="font-medium text-foreground">424242</span>
              {" "}— Clerk does not send a real email.
            </>
          : <>
              Enter the verification code we sent to {email.trim() || "your email"}.
              Check junk if it is missing. iCloud addresses often never receive Clerk
              development mail.
            </>}
        </p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="signup-code">Verification code</Label>
          <Input
            id="signup-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={field}
            value={code}
            onChange={(ev) => setCode(ev.target.value)}
            required
          />
        </div>
        {alert ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {alert}
          </p>
        ) : null}
        <Button type="submit" className="mt-4 w-full" size="lg" disabled={busy}>
          {submitting || fetchStatus === "fetching" ? "Verifying…" : "Verify email"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full"
          disabled={busy || sendingCode || resendWait > 0}
          onClick={() => {
            void sendVerificationCode();
          }}
        >
          {sendingCode ?
            "Sending…"
          : resendWait > 0 ?
            `Resend code in ${resendWait}s`
          : "Resend code"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onCreateAccount} className={glass}>
      <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Welcome! Fill in your details to get started.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="signup-first-name">First name</Label>
          <Input
            id="signup-first-name"
            name="firstName"
            autoComplete="given-name"
            placeholder="First name"
            className={field}
            value={firstName}
            onChange={(ev) => setFirstName(ev.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signup-last-name">Last name</Label>
          <Input
            id="signup-last-name"
            name="lastName"
            autoComplete="family-name"
            placeholder="Last name"
            className={field}
            value={lastName}
            onChange={(ev) => setLastName(ev.target.value)}
            required
          />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="signup-email">Email address</Label>
        <Input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email address"
          className={field}
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
          required
        />
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative">
          <Input
            id="signup-password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a password"
            className={cn(field, "pr-10")}
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            required
            minLength={8}
          />
          <PasswordVisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((open) => !open)}
          />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="signup-confirm-password">Confirm password</Label>
        <div className="relative">
          <Input
            id="signup-confirm-password"
            name="confirmPassword"
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Confirm your password"
            className={cn(field, "pr-10")}
            value={confirmPassword}
            onChange={(ev) => setConfirmPassword(ev.target.value)}
            required
            minLength={8}
            aria-invalid={
              confirmPassword.length > 0 && confirmPassword !== password
            }
          />
          <PasswordVisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((open) => !open)}
          />
        </div>
        {confirmPassword.length > 0 && confirmPassword !== password ? (
          <p className="text-sm text-destructive">Passwords do not match.</p>
        ) : null}
      </div>
      <div id="clerk-captcha" className="mt-3" />
      {alert ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {alert}
        </p>
      ) : null}
      <Button type="submit" className="mt-4 w-full" size="lg" disabled={busy}>
        {submitting || fetchStatus === "fetching" ? "Creating account…" : "Continue"}
      </Button>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
