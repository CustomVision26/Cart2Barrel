"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { switchBarrelShippingIntakeToOwnTransportAction } from "@/actions/barrel-shipping-intake";
import { Button } from "@/components/ui/button";

export function DeclineCourierButton({
  intakeId,
  className,
}: {
  intakeId: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      disabled={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          const res = await switchBarrelShippingIntakeToOwnTransportAction({
            intakeId,
          });
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          toast.success(res.message);
          router.refresh();
        });
      }}
    >
      {pending ? "Updating…" : "Don't use local courier"}
    </Button>
  );
}
