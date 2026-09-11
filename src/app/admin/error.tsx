"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  const isFetchFailure = /failed to fetch|timed out|timeout|aborted/i.test(
    error.message,
  );

  return (
    <div className="space-y-4">
      <Alert
        variant="destructive"
        className="border-destructive/40 bg-destructive/10 px-3 py-3"
      >
        <CircleAlert aria-hidden />
        <AlertTitle>
          {isFetchFailure ? "Admin page lost its connection" : "Something went wrong"}
        </AlertTitle>
        <AlertDescription className="text-destructive/90">
          {isFetchFailure
            ? "A long SerpApi lookup or network drop interrupted this page. Try again. If Spotlight lookup is still running, wait a moment before retrying so the previous request can finish."
            : error.message || "An unexpected error occurred in admin."}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/admin/overview"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Admin overview
        </Link>
      </div>
    </div>
  );
}
