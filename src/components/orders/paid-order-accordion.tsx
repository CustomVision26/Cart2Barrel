"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type PaidOrderAccordionContextValue = {
  openOrderId: string | null;
  /** Pass `null` to collapse every order. Pass an id to expand that order (others collapse). */
  setExpandedOrderId: (orderId: string | null) => void;
};

const PaidOrderAccordionContext =
  createContext<PaidOrderAccordionContextValue | null>(null);

/**
 * Enables accordion behavior across multiple {@link CollapsibleOrderTableSection} tbodies inside
 * the same orders table — only one order’s lines open at a time.
 */
export function PaidOrderAccordionRoot({
  resetKey,
  initialExpandedOrderId,
  children,
}: {
  /** Change when paging / sorting / filters so expansion resets to {@link initialExpandedOrderId}. */
  resetKey: string;
  initialExpandedOrderId: string | null;
  children: ReactNode;
}) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(
    initialExpandedOrderId ?? null,
  );

  useEffect(() => {
    setOpenOrderId(initialExpandedOrderId ?? null);
  }, [resetKey, initialExpandedOrderId]);

  const setExpandedOrderId = useCallback((orderId: string | null) => {
    setOpenOrderId(orderId);
  }, []);

  const value = useMemo(
    (): PaidOrderAccordionContextValue => ({
      openOrderId,
      setExpandedOrderId,
    }),
    [openOrderId, setExpandedOrderId],
  );

  return (
    <PaidOrderAccordionContext.Provider value={value}>
      {children}
    </PaidOrderAccordionContext.Provider>
  );
}

export function usePaidOrderAccordionOptional(): PaidOrderAccordionContextValue | null {
  return useContext(PaidOrderAccordionContext);
}
