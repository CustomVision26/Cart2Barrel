"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { submitBarrelShippingIntakeAction } from "@/actions/barrel-shipping-intake";
import { ExpectedShippingChargesNotice } from "@/components/shipping/expected-shipping-charges-notice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Address } from "@/db/schema";
import { DASHBOARD_SHIPPING_ROUTES } from "@/lib/dashboard-shipping-routes";
import {
  containerFullnessLabel,
  type BarrelShippingIntakeContainerRow,
} from "@/lib/barrel-shipping-intake";
import { containerOfferingKindLabel } from "@/lib/validations/container-offering";

type BarrelShippingIntakeFormProps = {
  container: BarrelShippingIntakeContainerRow;
  shippingAddress: Address | undefined;
};

export function BarrelShippingIntakeForm({
  container,
  shippingAddress,
}: BarrelShippingIntakeFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function submit() {
    startTransition(async () => {
      const res = await submitBarrelShippingIntakeAction({
        barrelId: container.barrelId,
      });

      if (res.ok) {
        setConfirmOpen(false);
        toast.success(res.message);
        router.push(DASHBOARD_SHIPPING_ROUTES.pricing);
        router.refresh();
        return;
      }

      toast.error(res.message);
    });
  }

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">
          {container.alias} — {container.slotLabel}
        </CardTitle>
        <CardDescription>
          {containerOfferingKindLabel(container.kind)} ·{" "}
          {container.itemCount} item{container.itemCount === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-amber-600 dark:text-amber-400">
            {containerFullnessLabel(container)}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ExpectedShippingChargesNotice
          destinationCountry={shippingAddress?.country ?? "Jamaica"}
        />

        <p className="text-sm text-muted-foreground">
          Your container is full and ready for outbound shipping. Continue to the{" "}
          <span className="font-medium text-foreground">Pricing</span> tab to review
          freight, customs, and pickup charges when staff publish your quote.
        </p>
      </CardContent>
      <CardFooter className="border-t border-border/60 pt-6">
        <Button
          type="button"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
        >
          Continue to pricing
        </Button>
      </CardFooter>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Continue to shipping pricing?</DialogTitle>
            <DialogDescription>
              You are confirming that{" "}
              <span className="font-medium text-foreground">
                {container.alias}
              </span>{" "}
              is ready for outbound shipping. You will open the Pricing tab to view
              freight, customs, and pickup charges when staff publish your quote.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/80 bg-muted p-4 text-sm">
            <p className="font-medium text-foreground">
              {container.alias} — {container.slotLabel}
            </p>
            <p className="mt-1 text-muted-foreground">
              {containerOfferingKindLabel(container.kind)} ·{" "}
              {containerFullnessLabel(container)}
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={pending} onClick={submit}>
              {pending ? "Continuing…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
