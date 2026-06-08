import { and, eq, notExists } from "drizzle-orm";

import { getDb } from "@/db";
import { orderItemProductReturnRequests, orderItems } from "@/db/schema";

/** Excludes order lines with a customer return request awaiting staff (`status = submitted`). */
export function excludePendingProductReturnRequestSql() {
  const db = getDb();
  return notExists(
    db
      .select({ id: orderItemProductReturnRequests.id })
      .from(orderItemProductReturnRequests)
      .where(
        and(
          eq(orderItemProductReturnRequests.orderItemId, orderItems.id),
          eq(orderItemProductReturnRequests.status, "submitted"),
        )!,
      ),
  );
}
