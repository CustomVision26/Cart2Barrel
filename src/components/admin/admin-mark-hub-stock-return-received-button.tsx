"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { markHubStockUsReturnReceivedAction } from "@/actions/admin-hub-stock-return";
import { Button } from "@/components/ui/button";

export function AdminMarkHubStockReturnReceivedButton({
  orderItemId,
}: {
  orderItemId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await markHubStockUsReturnReceivedAction({ orderItemId });
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
            return;
          }
          toast.error(result.message);
        });
      }}
    >
      {pending ? "Saving…" : "Mark return received"}
    </Button>
  );
}
