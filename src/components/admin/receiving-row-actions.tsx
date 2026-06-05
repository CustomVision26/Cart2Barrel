"use client";

import { useId, useRef, useState } from "react";
import { CameraIcon, MapPinIcon, ScanBarcodeIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";
import { WAREHOUSE_RECEIVE_CONDITION_OPTIONS } from "@/lib/warehouse-receive-condition";

export type { WarehouseReceiveCondition } from "@/lib/warehouse-receive-condition";

export const CONDITION_OPTIONS = WAREHOUSE_RECEIVE_CONDITION_OPTIONS;

export const receivingConditionSelectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-muted px-2 py-1 text-sm text-foreground outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/25 dark:bg-secondary",
);

export function ReceivingRowActions({
  lineLabel,
  shelfLocation,
  proofFileCount,
  onShelfAssigned,
  onProofFilesAdded,
  onBarcodeApplied,
  showProofPhotos = true,
}: {
  lineLabel: string;
  shelfLocation: string;
  proofFileCount: number;
  onShelfAssigned: (shelf: string) => void;
  onProofFilesAdded: (count: number) => void;
  onBarcodeApplied?: (value: string) => void;
  /** When false, use `WarehouseProofPhotosField` for uploads instead. */
  showProofPhotos?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [draftShelf, setDraftShelf] = useState(shelfLocation);

  const baseId = useId();

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const n = e.target.files?.length ?? 0;
    if (n > 0) onProofFilesAdded(n);
    e.target.value = "";
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {showProofPhotos ?
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onFilesSelected}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => fileInputRef.current?.click()}
          >
            <CameraIcon />
            Photos
            {proofFileCount > 0 ?
              <span className="tabular-nums text-muted-foreground">
                ({proofFileCount})
              </span>
            : null}
          </Button>
        </>
      : null}

      <Dialog open={barcodeOpen} onOpenChange={setBarcodeOpen}>
        <DialogTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1",
          )}
        >
          <ScanBarcodeIcon />
          Barcode
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan barcode</DialogTitle>
            <DialogDescription>
              Scan or type the SKU / package barcode for{" "}
              <span className="font-medium text-foreground">{lineLabel}</span>.
              Scanner or camera integration can be wired here later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-barcode`}>Barcode value</Label>
            <Input
              id={`${baseId}-barcode`}
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              placeholder="Scan or enter code"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBarcodeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onBarcodeApplied?.(barcodeValue.trim());
                setBarcodeOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={shelfOpen}
        onOpenChange={(open) => {
          setShelfOpen(open);
          if (open) setDraftShelf(shelfLocation);
        }}
      >
        <DialogTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-1",
          )}
        >
          <MapPinIcon />
          Shelf / bin
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign warehouse shelf / bin</DialogTitle>
            <DialogDescription>
              Enter aisle, shelf, and bin so pickers can find this receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-shelf`}>Location</Label>
            <Input
              id={`${baseId}-shelf`}
              value={draftShelf}
              onChange={(e) => setDraftShelf(e.target.value)}
              placeholder="e.g. A-12-03 / BIN-4421"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShelfOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onShelfAssigned(draftShelf.trim());
                setShelfOpen(false);
              }}
            >
              Save location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
