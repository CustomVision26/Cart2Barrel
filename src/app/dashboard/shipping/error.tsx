"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardShippingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/shipping]", error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Alert
        variant="destructive"
        className="border-destructive/40 bg-destructive/10 px-3 py-3"
      >
        <CircleAlert aria-hidden />
        <AlertTitle>Shipping could not load</AlertTitle>
        <AlertDescription className="text-destructive/90">
          {error.message ||
            "An unexpected error occurred while loading shipment tracking."}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
