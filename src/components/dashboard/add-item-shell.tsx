"use client";

import type { ReactNode } from "react";

import type { AddItemPagePayload } from "./add-item-payload-context";
import { AddItemPayloadProvider } from "./add-item-payload-context";
import { BatchQuoteSelectionProvider } from "./batch-quote-selection-context";
import { ItemsNewTabNav } from "./items-new-tab-nav";

type AddItemShellProps = {
  payload: AddItemPagePayload;
  children: ReactNode;
};

export function AddItemShell({ payload, children }: AddItemShellProps) {
  return (
    <AddItemPayloadProvider value={payload}>
      <BatchQuoteSelectionProvider>
        <div className="space-y-4">
          <ItemsNewTabNav />
          <div role="tabpanel" className="space-y-4" aria-live="polite">
            {children}
          </div>
        </div>
      </BatchQuoteSelectionProvider>
    </AddItemPayloadProvider>
  );
}
