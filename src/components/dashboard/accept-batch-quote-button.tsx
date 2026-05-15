"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import { approveBatchEstimateAction } from "@/actions/approve-batch-estimate";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type AcceptBatchQuoteButtonProps = {
  batchSessionId: string;
};

export function AcceptBatchQuoteButton({ batchSessionId }: AcceptBatchQuoteButtonProps) {
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
            const res = await approveBatchEstimateAction({ batchSessionId });
            if (res.ok) {
              toast.success(res.message ?? "Added to cart.");
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
        <p className="max-w-[16rem] text-right text-xs text-destructive">{message}</p>
      ) : null}
    </div>
  );
}
