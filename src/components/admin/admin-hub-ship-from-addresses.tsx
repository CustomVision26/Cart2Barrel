"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  adminDeleteHubShipFromAction,
  adminSaveHubShipFromAction,
  adminSetHubShipFromPrimaryAction,
} from "@/actions/admin-hub-stock-products";
import { AdminConfirmDialog } from "@/components/admin/admin-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, nativeSelectFieldClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { StatusBadge } from "@/components/ui/status-badge";
import { US_STATES } from "@/lib/us-states";

export type AdminHubShipFromAddressRow = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  isPrimary: boolean;
};

const EMPTY_ADDRESS = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
};

type EditorState =
  | { mode: "create" }
  | { mode: "edit"; address: AdminHubShipFromAddressRow };

export function AdminHubShipFromAddresses({
  addresses = [],
  shippoConfigured,
  pending: parentPending,
}: {
  addresses: AdminHubShipFromAddressRow[];
  shippoConfigured: boolean;
  pending: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const busy = parentPending || pending;

  function openAddress(address: AdminHubShipFromAddressRow) {
    setEditor({ mode: "edit", address });
  }

  return (
    <>
      <Card className="border-border/80">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Hub ship-from addresses</CardTitle>
            <CardDescription>
              Shippo rates US delivery from the primary warehouse to the shopper.{" "}
              {shippoConfigured ?
                "Shippo API key is configured."
              : "Add SHIPPO_API_KEY to the server environment before rates will work."}
            </CardDescription>
          </div>
          <Button type="button" onClick={() => setEditor({ mode: "create" })}>
            Add address
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {addresses.length === 0 ?
            <p className="rounded-lg border border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
              No warehouse addresses yet. Add one so Shippo can rate US delivery.
            </p>
          : (
            <FloatingHorizontalScroll className="rounded-lg border border-border">
              <table className="w-full min-w-[52rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Phone</th>
                    <th className="px-3 py-2.5 font-medium">Street</th>
                    <th className="px-3 py-2.5 font-medium">City</th>
                    <th className="px-3 py-2.5 font-medium">State</th>
                    <th className="px-3 py-2.5 font-medium">ZIP</th>
                    <th className="px-3 py-2.5 font-medium">Primary</th>
                    <th className="px-3 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {addresses.map((address) => (
                    <tr
                      key={address.id}
                      className="cursor-pointer bg-card hover:bg-muted/40"
                      onDoubleClick={() => openAddress(address)}
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {address.name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {address.phone || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {[address.line1, address.line2].filter(Boolean).join(", ") ||
                          "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {address.city || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {address.state || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                        {address.postalCode || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {address.isPrimary ?
                          <StatusBadge kind="fullyReceived">Primary</StatusBadge>
                        : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openAddress(address)}
                          >
                            Open
                          </Button>
                          {!address.isPrimary ?
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => {
                                startTransition(async () => {
                                  const result =
                                    await adminSetHubShipFromPrimaryAction({
                                      id: address.id,
                                    });
                                  if (!result.ok) {
                                    toast.error(result.message);
                                    return;
                                  }
                                  toast.success("Primary ship-from address updated.");
                                  router.refresh();
                                });
                              }}
                            >
                              Set primary
                            </Button>
                          : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setDeleteId(address.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FloatingHorizontalScroll>
          )}
          <p className="text-xs text-muted-foreground">
            Double-click a row or click Open to edit. Only one address can be primary;
            Shippo uses that warehouse for US rates.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={editor != null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Hub ship-from address</DialogTitle>
            <DialogDescription>
              {editor?.mode === "edit" ?
                "Update this warehouse. Shippo rates US delivery from the primary address."
              : "Add a US warehouse. The first address becomes primary for Shippo rates."}
            </DialogDescription>
          </DialogHeader>
          {editor ?
            <HubShipFromForm
              key={editor.mode === "edit" ? editor.address.id : "create"}
              pending={busy}
              initial={
                editor.mode === "edit" ?
                  {
                    id: editor.address.id,
                    name: editor.address.name,
                    phone: editor.address.phone,
                    line1: editor.address.line1,
                    line2: editor.address.line2,
                    city: editor.address.city,
                    state: editor.address.state,
                    postalCode: editor.address.postalCode,
                    isPrimary: editor.address.isPrimary,
                  }
                : { ...EMPTY_ADDRESS, isPrimary: addresses.length === 0 }
              }
              lockPrimary={
                editor.mode === "create" ?
                  addresses.length === 0
                : editor.address.isPrimary
              }
              onSaved={() => {
                setEditor(null);
                router.refresh();
              }}
            />
          : null}
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={deleteId != null}
        title="Delete ship-from address?"
        description="This warehouse will no longer be available for Shippo US rates. If it is primary, another address becomes primary."
        confirmLabel="Delete"
        pending={busy}
        destructive
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (!deleteId) return;
          startTransition(async () => {
            const result = await adminDeleteHubShipFromAction({ id: deleteId });
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success("Ship-from address deleted.");
            setDeleteId(null);
            setEditor(null);
            router.refresh();
          });
        }}
      />
    </>
  );
}

function HubShipFromForm({
  pending,
  initial,
  lockPrimary,
  onSaved,
}: {
  pending: boolean;
  initial: typeof EMPTY_ADDRESS & { id?: string; isPrimary: boolean };
  lockPrimary: boolean;
  onSaved: () => void;
}) {
  const [saving, startSave] = useTransition();
  const [fields, setFields] = useState(initial);
  const busy = pending || saving;
  const fieldId = initial.id ?? "new";

  function setField<K extends keyof typeof fields>(name: K, value: (typeof fields)[K]) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        startSave(async () => {
          const result = await adminSaveHubShipFromAction({
            id: fields.id,
            name: fields.name,
            phone: fields.phone,
            line1: fields.line1,
            line2: fields.line2,
            city: fields.city,
            state: fields.state,
            postalCode: fields.postalCode,
            isPrimary: lockPrimary ? true : fields.isPrimary,
          });
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success("Ship-from address saved.");
          onSaved();
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor={`ship-from-${fieldId}-name`}>Warehouse / company name</Label>
        <Input
          id={`ship-from-${fieldId}-name`}
          name="name"
          value={fields.name}
          onChange={(e) => setField("name", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ship-from-${fieldId}-phone`}>Phone</Label>
        <Input
          id={`ship-from-${fieldId}-phone`}
          name="phone"
          value={fields.phone}
          onChange={(e) => setField("phone", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`ship-from-${fieldId}-line1`}>Street address</Label>
        <Input
          id={`ship-from-${fieldId}-line1`}
          name="line1"
          value={fields.line1}
          onChange={(e) => setField("line1", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`ship-from-${fieldId}-line2`}>
          Address line 2{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`ship-from-${fieldId}-line2`}
          name="line2"
          value={fields.line2}
          onChange={(e) => setField("line2", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ship-from-${fieldId}-city`}>City</Label>
        <Input
          id={`ship-from-${fieldId}-city`}
          name="city"
          value={fields.city}
          onChange={(e) => setField("city", e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ship-from-${fieldId}-state`}>State</Label>
        <select
          id={`ship-from-${fieldId}-state`}
          name="state"
          value={fields.state}
          onChange={(e) => setField("state", e.target.value)}
          required
          className={nativeSelectFieldClassName}
        >
          <option value="">Select state</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`ship-from-${fieldId}-zip`}>ZIP</Label>
        <Input
          id={`ship-from-${fieldId}-zip`}
          name="postalCode"
          value={fields.postalCode}
          onChange={(e) => setField("postalCode", e.target.value)}
          required
          placeholder="12345"
        />
      </div>
      <div className="flex items-end sm:col-span-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPrimary"
            checked={lockPrimary ? true : fields.isPrimary}
            disabled={lockPrimary}
            onChange={(e) => setField("isPrimary", e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          <span>Primary ship-from address</span>
        </label>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save ship-from address"}
        </Button>
      </div>
    </form>
  );
}
