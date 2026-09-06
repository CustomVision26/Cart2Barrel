"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateMerchantPackingBarrelFeesAction } from "@/actions/update-merchant-pricing-settings";
import type { ContainerPackingRates } from "@/lib/container-packing-fee";
import {
  barrelPackingFeeCents,
  binPackingFeeCents,
} from "@/lib/container-packing-fee";
import {
  containerRatesToFormState,
  formStateToContainerRates,
} from "@/lib/admin-pricing-form-utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const fieldClassName = cn(
  "h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
);

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, cents) / 100);
}

type AdminGeneralPackageFeePanelProps = {
  initialContainerPackingRates: ContainerPackingRates;
};

export function AdminGeneralPackageFeePanel({
  initialContainerPackingRates,
}: AdminGeneralPackageFeePanelProps) {
  const router = useRouter();
  const [containerForm, setContainerForm] = useState(() =>
    containerRatesToFormState(initialContainerPackingRates),
  );
  const [pending, startTransition] = useTransition();
  const saveStartedRef = useRef(false);

  const containerRatesPreview = useMemo(
    () => formStateToContainerRates(containerForm),
    [containerForm],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Packing &amp; container combinations</CardTitle>
          <CardDescription>
            Default container packing fees for all customers unless they have a custom package.
            The cart sums barrel and bin quantities separately—1 barrel uses the single-barrel
            rate; 2+ barrels use per-barrel × count (same for bins).
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-4xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5">
              <p className="text-sm font-medium text-foreground">Barrels</p>
              <div className="space-y-2">
                <Label htmlFor="single-barrel-usd">Exactly 1 barrel (USD)</Label>
                <Input
                  id="single-barrel-usd"
                  inputMode="decimal"
                  value={containerForm.singleBarrelDollars}
                  onChange={(e) =>
                    setContainerForm((f) => ({ ...f, singleBarrelDollars: e.target.value }))
                  }
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="multi-barrel-usd">Each barrel when 2+ in cart (USD)</Label>
                <Input
                  id="multi-barrel-usd"
                  inputMode="decimal"
                  value={containerForm.multiBarrelDollars}
                  onChange={(e) =>
                    setContainerForm((f) => ({ ...f, multiBarrelDollars: e.target.value }))
                  }
                  className={fieldClassName}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Preview: 4 barrels → 4 ×{" "}
                {formatUsdFromCents(containerRatesPreview.multiBarrelPackingPerUnitCents)} ={" "}
                {formatUsdFromCents(barrelPackingFeeCents(4, containerRatesPreview))}
              </p>
            </div>
            <div className="space-y-3 rounded-lg border border-border/80 bg-card p-4 ring-1 ring-foreground/5">
              <p className="text-sm font-medium text-foreground">Bins</p>
              <div className="space-y-2">
                <Label htmlFor="single-bin-usd">Exactly 1 bin (USD)</Label>
                <Input
                  id="single-bin-usd"
                  inputMode="decimal"
                  value={containerForm.singleBinDollars}
                  onChange={(e) =>
                    setContainerForm((f) => ({ ...f, singleBinDollars: e.target.value }))
                  }
                  className={fieldClassName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="multi-bin-usd">Each bin when 2+ in cart (USD)</Label>
                <Input
                  id="multi-bin-usd"
                  inputMode="decimal"
                  value={containerForm.multiBinDollars}
                  onChange={(e) =>
                    setContainerForm((f) => ({ ...f, multiBinDollars: e.target.value }))
                  }
                  className={fieldClassName}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Preview: 3 bins → 3 ×{" "}
                {formatUsdFromCents(containerRatesPreview.multiBinPackingPerUnitCents)} ={" "}
                {formatUsdFromCents(binPackingFeeCents(3, containerRatesPreview))}
              </p>
            </div>
          </div>

          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              if (pending || saveStartedRef.current) return;
              saveStartedRef.current = true;
              startTransition(async () => {
                try {
                const res = await updateMerchantPackingBarrelFeesAction({
                  packingFeePerLineCents: 0,
                  containerPackingRates: containerRatesPreview,
                });
                  if (!res.ok) {
                    toast.error(res.message, { id: "admin-packing-fees" });
                    return;
                  }
                  toast.success(res.message, { id: "admin-packing-fees" });
                  router.refresh();
                } finally {
                  saveStartedRef.current = false;
                }
              });
            }}
          >
            Save packing &amp; container fees
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
