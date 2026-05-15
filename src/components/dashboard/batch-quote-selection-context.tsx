"use client";

import {
  createContext,
  useContext,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

type BatchQuoteSelectionContextValue = {
  batchSelectedIds: Set<string>;
  setBatchSelectedIds: Dispatch<SetStateAction<Set<string>>>;
};

const BatchQuoteSelectionContext =
  createContext<BatchQuoteSelectionContextValue | null>(null);

export function BatchQuoteSelectionProvider({ children }: { children: ReactNode }) {
  const [batchSelectedIds, setBatchSelectedIds] = useState(
    (): Set<string> => new Set()
  );

  return (
    <BatchQuoteSelectionContext.Provider
      value={{ batchSelectedIds, setBatchSelectedIds }}
    >
      {children}
    </BatchQuoteSelectionContext.Provider>
  );
}

export function useBatchQuoteSelection(): BatchQuoteSelectionContextValue {
  const ctx = useContext(BatchQuoteSelectionContext);
  if (!ctx) {
    throw new Error(
      "useBatchQuoteSelection must be used within BatchQuoteSelectionProvider."
    );
  }
  return ctx;
}
