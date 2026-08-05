"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { resubmitExpiredQuoteAction } from "@/actions/resubmit-expired-quote";
import { useAddItemPayload } from "@/components/dashboard/add-item-payload-context";
import { QuoteEstimatePreviewDialog } from "@/components/quote-estimate-preview-dialog";
import { ProductRequestThumbnail } from "@/components/product-request-thumbnail";
import { Button } from "@/components/ui/button";
import { FloatingHorizontalScroll } from "@/components/ui/floating-horizontal-scroll";
import { formatUsd } from "@/lib/admin-markup";
import { DASHBOARD_REQUESTED_ITEMS_ROUTE } from "@/lib/dashboard-items-routes";
import {
  effectiveQuoteExpiryMinutes,
  formatItemRequestProductNumber,
  formatQuoteExpiryDateTime,
  getLatestOperationalQuoteIssuedAt,
  getQuoteExpiryCountdown,
  resolveQuoteExpiryClockStart,
} from "@/lib/quote-expiry";
import { isOperationalQuoteRow } from "@/lib/checkout-snapshot-kind";
import {
  dashItemsTableHeadPlain,
  dashItemsTableScroll,
} from "@/lib/app-table-surfaces";

export function ItemsNewExpiredQuotesPanel() {
  const router = useRouter();
  const {
    expiredQuotedRequests,
    quotesByRequestId,
    quoteExpiryMinutes,
  } = useAddItemPayload();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    return [...expiredQuotedRequests]
      .map((request) => {
        const quotes = quotesByRequestId[request.id] ?? [];
        const issuedAt = getLatestOperationalQuoteIssuedAt(quotes);
        const lineMinutes = effectiveQuoteExpiryMinutes(
          quoteExpiryMinutes,
          request.quoteExpiryMinutesOverride,
        ).expiryMinutes;
        const clockStart = resolveQuoteExpiryClockStart({
          quoteIssuedAt: issuedAt,
          productOverrideMinutes: request.quoteExpiryMinutesOverride,
          productOverrideAnchoredAt: request.quoteExpiryOverrideAnchoredAt,
        });
        const countdown = getQuoteExpiryCountdown(clockStart, lineMinutes);
        const activeQuote = quotes.find(
          (q) => !q.voidedAt && isOperationalQuoteRow(q),
        );
        return {
          request,
          issuedAt,
          expiresAt: countdown?.expiresAt ?? null,
          priceCents: activeQuote?.totalPrice ?? null,
        };
      })
      .sort((a, b) => {
        const aMs = a.expiresAt ? new Date(a.expiresAt).getTime() : 0;
        const bMs = b.expiresAt ? new Date(b.expiresAt).getTime() : 0;
        return bMs - aMs;
      });
  }, [expiredQuotedRequests, quotesByRequestId, quoteExpiryMinutes]);

  function handleResubmit(itemRequestId: string) {
    setPendingId(itemRequestId);
    startTransition(async () => {
      const res = await resubmitExpiredQuoteAction({ itemRequestId });
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Quotes that pass the payment window move here from Active. Retailer
          prices change often, so expired estimates are no longer guaranteed—you
          can preview the old quote or resubmit so staff can send a current one.
        </p>
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No expired quotes right now.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These estimates expired before checkout. Expiry protects both sides when
        retailer prices move after we quoted—resubmit for a current estimate, or
        preview the expired quote for reference. Submit brand-new products from{" "}
        <Link
          href={DASHBOARD_REQUESTED_ITEMS_ROUTE}
          className="font-medium text-foreground underline-offset-2 hover:underline"
        >
          Requested items
        </Link>
        .
      </p>
      <FloatingHorizontalScroll viewportClassName={dashItemsTableScroll}>
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className={dashItemsTableHeadPlain}>
            <tr>
              <th className="px-3 py-2.5 font-medium text-foreground">
                Expired
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">
                Product #
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">Photo</th>
              <th className="px-3 py-2.5 font-medium text-foreground">
                Product name
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">
                Retailer
              </th>
              <th className="px-3 py-2.5 font-medium text-foreground">URL</th>
              <th className="px-3 py-2.5 font-medium text-foreground">Price</th>
              <th className="px-3 py-2.5 font-medium text-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ request, expiresAt, priceCents }) => (
              <tr key={request.id} className="align-top">
                <td className="px-3 py-3 text-xs text-muted-foreground tabular-nums">
                  {expiresAt ? formatQuoteExpiryDateTime(expiresAt) : "—"}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-foreground">
                  {formatItemRequestProductNumber(request)}
                </td>
                <td className="px-3 py-3">
                  <ProductRequestThumbnail
                    imageUrl={request.productImageUrl}
                    productLabel={request.productName}
                    variant="admin"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-foreground">
                  {request.productName?.trim() || "Untitled product"}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {request.siteName?.trim() || "—"}
                </td>
                <td className="px-3 py-3">
                  {request.productUrl ?
                    <a
                      href={request.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Product url
                    </a>
                  : "—"}
                </td>
                <td className="px-3 py-3 tabular-nums text-foreground">
                  {priceCents != null ? formatUsd(priceCents) : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex min-w-[11rem] flex-col gap-2">
                    <QuoteEstimatePreviewDialog
                      itemRequestId={request.id}
                      label="Preview expired"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending && pendingId === request.id}
                      onClick={() => handleResubmit(request.id)}
                    >
                      {pending && pendingId === request.id ?
                        "Resubmitting…"
                      : "Resubmit new request"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FloatingHorizontalScroll>
    </div>
  );
}
