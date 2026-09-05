"use client";

import { useClerk, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function clerkErrorText(
  error: { longMessage?: string; message?: string } | null | undefined,
): string | null {
  const text = error?.longMessage?.trim() || error?.message?.trim();
  return text || null;
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

export function ClerkSignUpForm() {
  const router = useRouter();
  const clerk = useClerk();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerify, setPendingVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setError(clerkErrorText(finalizeError) ?? "Could not finish sign-up.");
      return false;
    }
    await applyCollectedNames();
    return true;
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
        const sent = await signUp.verifications.sendEmailCode();
        if (sent.error) {
          setError(clerkErrorText(sent.error) ?? "Could not send a verification code.");
          return;
        }
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
        setError(clerkErrorText(verified.error) ?? "Verification did not complete.");
        return;
      }
      if (await finishIfComplete()) return;
      setError("Verification did not complete. Check the code and try again.");
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Verification did not complete. Check the code and try again.",
      );
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
  const needsEmailVerify =
    pendingVerify ||
    (signUp?.status === "missing_requirements" &&
      signUp.unverifiedFields.includes("email_address") &&
      signUp.missingFields.length === 0);

  if (needsEmailVerify) {
    return (
      <form onSubmit={onVerify} className={glass}>
        <h1 className="text-xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the verification code we sent to {email.trim() || "your email"}.
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
        <Input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          className={field}
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor="signup-confirm-password">Confirm password</Label>
        <Input
          id="signup-confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Confirm your password"
          className={field}
          value={confirmPassword}
          onChange={(ev) => setConfirmPassword(ev.target.value)}
          required
          minLength={8}
          aria-invalid={
            confirmPassword.length > 0 && confirmPassword !== password
          }
        />
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
