"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardBarrelsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/barrels]", error);
  }, [error]);

  const isFetchFailure = /failed to fetch/i.test(error.message);

  return (
    <div className="space-y-4">
      <Alert
        variant="destructive"
        className="border-destructive/40 bg-destructive/10 px-3 py-3"
      >
        <CircleAlert aria-hidden />
        <AlertTitle>
          {isFetchFailure ?
            "Containers could not be refreshed"
          : "Something went wrong"}
        </AlertTitle>
        <AlertDescription className="text-destructive/90">
          {isFetchFailure ?
            "The page lost its connection while loading container options. This often happens during a slow local compile—try again in a moment."
          : (error.message || "An unexpected error occurred while loading containers.")}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/dashboard/cart"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Go to cart
        </Link>
      </div>
    </div>
  );
}
