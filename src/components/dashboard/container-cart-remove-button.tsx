"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { removeUserContainerCartLineAction } from "@/actions/user-container-cart";
import { Button } from "@/components/ui/button";

export function ContainerCartRemoveButton({ offeringId }: { offeringId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 shrink-0 text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await removeUserContainerCartLineAction({ offeringId });
          router.refresh();
        });
      }}
    >
      Remove
    </Button>
  );
}
