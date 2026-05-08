"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { approveItemQuoteAction } from "@/actions/approve-item-quote";
import { Button } from "@/components/ui/button";

type AcceptQuoteButtonProps = {
  itemRequestId: string;
};

export function AcceptQuoteButton({ itemRequestId }: AcceptQuoteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const res = await approveItemQuoteAction({ itemRequestId });
            if (res.ok) {
              router.refresh();
            } else {
              setMessage(res.message ?? "Something went wrong.");
            }
          });
        }}
      >
        {isPending ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
            Adding…
          </>
        ) : (
          "Accept estimate"
        )}
      </Button>
      {message ? (
        <p className="text-xs text-destructive">{message}</p>
      ) : null}
    </div>
  );
}
