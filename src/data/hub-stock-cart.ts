import { and, desc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  hubStockCartItems,
  hubStockOrderItems,
  hubStockProducts,
  itemQuotes,
  itemRequests,
  type HubStockCartItem,
  type HubStockProduct,
} from "@/db/schema";
import { quoteHubStockUsBundleShipping } from "@/data/hub-stock-shipping";
import { getShippingAddressForUser } from "@/data/addresses";
import type { CheckoutOrderLineInput, StripeCheckoutPriceDataLine } from "@/data/cart";
import { insertItemQuoteForRequest } from "@/data/item-quotes";
import { ensureHubStockSchemaEnums } from "@/data/ensure-hub-stock-schema";
import {
  listHubStockImageUrlsByProductIds,
  sumPendingHubStockOrderQty,
} from "@/data/hub-stock-products";
import {
  HUB_STOCK_SITE_NAME,
  hubStockLineNote,
  hubStockProductUrl,
  hubStockUsShipToKey,
  savedAddressToHubStockUsAddress,
  usDeliveryAddressPrompt,
} from "@/lib/hub-stock";
import type { HubStockDestinationInput } from "@/lib/validations/hub-stock";
import { allocateCentsByWeight } from "@/lib/allocate-cents";

export type HubStockCartLine = {
  cartItem: HubStockCartItem;
  product: HubStockProduct;
  imageUrl: string | null;
};

export async function listHubStockCartLinesForUser(
  clerkUserId: string,
): Promise<HubStockCartLine[]> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const rows = await db
    .select({
      cartItem: hubStockCartItems,
      product: hubStockProducts,
    })
    .from(hubStockCartItems)
    .innerJoin(
      hubStockProducts,
      eq(hubStockCartItems.productId, hubStockProducts.id),
    )
    .where(eq(hubStockCartItems.clerkUserId, clerkUserId))
    .orderBy(desc(hubStockCartItems.updatedAt));
  const images = await listHubStockImageUrlsByProductIds(
    rows.map((row) => row.product.id),
  );
  return rows.map((row) => ({
    ...row,
    imageUrl: images.get(row.product.id)?.[0] ?? null,
  }));
}

export async function countHubStockCartLineRows(
  clerkUserId: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: hubStockCartItems.id })
    .from(hubStockCartItems)
    .where(eq(hubStockCartItems.clerkUserId, clerkUserId));
  return rows.length;
}

export function sumHubStockCartLinesCents(lines: HubStockCartLine[]): number {
  return lines.reduce((sum, line) => {
    const productCents = line.product.priceUsdCents * line.cartItem.quantity;
    const shippingCents =
      line.cartItem.destination === "us_address" ? line.cartItem.shippingCents : 0;
    return sum + productCents + shippingCents;
  }, 0);
}

export { hubStockUsShipToKey };

export type HubStockCartPackage = {
  key: string;
  destination: HubStockDestinationInput;
  lines: HubStockCartLine[];
  shippingCents: number;
  shippingCarrier: string | null;
  shippingService: string | null;
};

export function groupHubStockCartPackages(
  lines: HubStockCartLine[],
): HubStockCartPackage[] {
  const usGroups = new Map<string, HubStockCartLine[]>();
  const overseas: HubStockCartLine[] = [];
  for (const line of lines) {
    if (line.cartItem.destination !== "us_address") {
      overseas.push(line);
      continue;
    }
    const key = hubStockUsShipToKey(line.cartItem) ?? `incomplete:${line.cartItem.id}`;
    const group = usGroups.get(key) ?? [];
    group.push(line);
    usGroups.set(key, group);
  }

  const packages: HubStockCartPackage[] = [];
  for (const [key, group] of usGroups) {
    const shippingCents = group.reduce(
      (sum, line) => sum + hubStockLineShippingCents(line),
      0,
    );
    const rated = group.find((line) => line.cartItem.shippingCarrier);
    packages.push({
      key: `us:${key}`,
      destination: "us_address",
      lines: group,
      shippingCents,
      shippingCarrier: rated?.cartItem.shippingCarrier ?? null,
      shippingService: rated?.cartItem.shippingService ?? null,
    });
  }
  if (overseas.length > 0) {
    packages.push({
      key: "overseas",
      destination: "overseas_container",
      lines: overseas,
      shippingCents: 0,
      shippingCarrier: null,
      shippingService: null,
    });
  }
  return packages;
}

export function hubStockLineMerchandiseCents(line: HubStockCartLine): number {
  return line.product.priceUsdCents * line.cartItem.quantity;
}

export function hubStockLineShippingCents(line: HubStockCartLine): number {
  return line.cartItem.destination === "us_address" ? line.cartItem.shippingCents : 0;
}

export async function availableHubStockQty(
  productId: string,
  options?: { excludeCartItemId?: string },
): Promise<number> {
  const db = getDb();
  const [product] = await db
    .select({ stockQty: hubStockProducts.stockQty })
    .from(hubStockProducts)
    .where(eq(hubStockProducts.id, productId))
    .limit(1);
  if (!product) return 0;

  const cartRows = await db
    .select({
      id: hubStockCartItems.id,
      quantity: hubStockCartItems.quantity,
    })
    .from(hubStockCartItems)
    .where(eq(hubStockCartItems.productId, productId));

  const cartReserved = cartRows.reduce((sum, row) => {
    if (options?.excludeCartItemId && row.id === options.excludeCartItemId) {
      return sum;
    }
    return sum + row.quantity;
  }, 0);

  const pendingReserved = await sumPendingHubStockOrderQty(productId);
  return Math.max(0, product.stockQty - cartReserved - pendingReserved);
}

export async function upsertHubStockCartItem(input: {
  clerkUserId: string;
  productId: string;
  quantity: number;
  destination: HubStockDestinationInput;
  usAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const [product] = await db
    .select()
    .from(hubStockProducts)
    .where(
      and(
        eq(hubStockProducts.id, input.productId),
        eq(hubStockProducts.isActive, true),
      ),
    )
    .limit(1);

  if (!product) {
    return { ok: false, message: "That in-hub product is not available." };
  }
  if (product.stockQty < 1) {
    return { ok: false, message: "That product is out of stock." };
  }

  const [existing] = await db
    .select()
    .from(hubStockCartItems)
    .where(
      and(
        eq(hubStockCartItems.clerkUserId, input.clerkUserId),
        eq(hubStockCartItems.productId, input.productId),
        eq(hubStockCartItems.destination, input.destination),
      ),
    )
    .limit(1);

  const nextQty = (existing?.quantity ?? 0) + input.quantity;
  const available = await availableHubStockQty(input.productId, {
    excludeCartItemId: existing?.id,
  });
  if (nextQty > available) {
    return {
      ok: false,
      message:
        available < 1
          ? "That product is out of stock."
          : `Only ${available} left in stock.`,
    };
  }

  const now = new Date().toISOString();
  const ship =
    input.destination === "us_address" && input.usAddress
      ? {
          shipLine1: input.usAddress.line1,
          shipLine2: input.usAddress.line2?.trim() || null,
          shipCity: input.usAddress.city,
          shipState: input.usAddress.state,
          shipPostalCode: input.usAddress.postalCode,
          shipCountry: "United States",
        }
      : {
          shipLine1: null,
          shipLine2: null,
          shipCity: null,
          shipState: null,
          shipPostalCode: null,
          shipCountry: null,
        };

  let shippingCents = 0;
  let shippingCarrier: string | null = null;
  let shippingService: string | null = null;

  if (existing) {
    await db
      .update(hubStockCartItems)
      .set({
        quantity: nextQty,
        ...ship,
        shippingCents,
        shippingCarrier,
        shippingService,
        updatedAt: now,
      })
      .where(eq(hubStockCartItems.id, existing.id));
  } else {
    await db.insert(hubStockCartItems).values({
      clerkUserId: input.clerkUserId,
      productId: input.productId,
      quantity: input.quantity,
      destination: input.destination,
      ...ship,
      shippingCents,
      shippingCarrier,
      shippingService,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (input.destination === "us_address") {
    return refreshHubStockCartShippingForUser(input.clerkUserId);
  }
  return { ok: true };
}

export async function updateHubStockCartItemShipAddress(input: {
  clerkUserId: string;
  cartItemId: string;
  addressId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await ensureHubStockSchemaEnums();
  const db = getDb();
  const [cartItem] = await db
    .select()
    .from(hubStockCartItems)
    .where(
      and(
        eq(hubStockCartItems.id, input.cartItemId),
        eq(hubStockCartItems.clerkUserId, input.clerkUserId),
      ),
    )
    .limit(1);
  if (!cartItem) {
    return { ok: false, message: "Cart item not found." };
  }
  if (cartItem.destination !== "us_address") {
    return { ok: false, message: "This line does not ship to a US address." };
  }

  const address = await getShippingAddressForUser(
    input.clerkUserId,
    input.addressId,
  );
  const mapped = address ? savedAddressToHubStockUsAddress(address) : null;
  if (!mapped) {
    return {
      ok: false,
      message:
        usDeliveryAddressPrompt(address) ??
        "Select a United States shipping address.",
    };
  }

  const groupKey = hubStockUsShipToKey(cartItem);
  const siblings = await db
    .select()
    .from(hubStockCartItems)
    .where(
      and(
        eq(hubStockCartItems.clerkUserId, input.clerkUserId),
        eq(hubStockCartItems.destination, "us_address"),
      ),
    );
  const targetIds = siblings
    .filter((row) => (groupKey ? hubStockUsShipToKey(row) === groupKey : row.id === cartItem.id))
    .map((row) => row.id);

  const now = new Date().toISOString();
  await db
    .update(hubStockCartItems)
    .set({
      shipLine1: mapped.line1,
      shipLine2: mapped.line2?.trim() || null,
      shipCity: mapped.city,
      shipState: mapped.state,
      shipPostalCode: mapped.postalCode,
      shipCountry: "United States",
      updatedAt: now,
    })
    .where(
      and(
        eq(hubStockCartItems.clerkUserId, input.clerkUserId),
        inArray(hubStockCartItems.id, targetIds),
      ),
    );

  return refreshHubStockCartShippingForUser(input.clerkUserId);
}

export async function refreshHubStockCartShippingForUser(
  clerkUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const lines = await listHubStockCartLinesForUser(clerkUserId);
  const db = getDb();
  const now = new Date().toISOString();
  const packages = groupHubStockCartPackages(lines);

  for (const pkg of packages) {
    if (pkg.destination !== "us_address") {
      for (const line of pkg.lines) {
        await db
          .update(hubStockCartItems)
          .set({
            shippingCents: 0,
            shippingCarrier: null,
            shippingService: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(hubStockCartItems.id, line.cartItem.id),
              eq(hubStockCartItems.clerkUserId, clerkUserId),
            ),
          );
      }
      continue;
    }

    const sample = pkg.lines[0]?.cartItem;
    if (
      !sample?.shipLine1 ||
      !sample.shipCity ||
      !sample.shipState ||
      !sample.shipPostalCode
    ) {
      return {
        ok: false,
        message: `${pkg.lines[0]?.product.name ?? "An in-hub product"} needs a US shipping address before checkout.`,
      };
    }

    const quote = await quoteHubStockUsBundleShipping({
      products: pkg.lines.map((line) => ({
        product: line.product,
        quantity: line.cartItem.quantity,
        name: line.product.name,
      })),
      to: {
        line1: sample.shipLine1,
        line2: sample.shipLine2,
        city: sample.shipCity,
        state: sample.shipState,
        postalCode: sample.shipPostalCode,
      },
    });
    if (!quote.ok) {
      return {
        ok: false,
        message:
          pkg.lines.length > 1 ?
            `Warehouse package: ${quote.message}`
          : `${pkg.lines[0]?.product.name}: ${quote.message}`,
      };
    }

    const ordered = [...pkg.lines].sort((a, b) =>
      a.cartItem.id.localeCompare(b.cartItem.id),
    );
    const shippingShares = allocateCentsByWeight(
      quote.rate.cents,
      ordered.map((line) => hubStockLineMerchandiseCents(line)),
    );
    for (const [index, line] of ordered.entries()) {
      await db
        .update(hubStockCartItems)
        .set({
          shippingCents: shippingShares[index] ?? 0,
          shippingCarrier: quote.rate.carrier,
          shippingService: quote.rate.service,
          updatedAt: now,
        })
        .where(
          and(
            eq(hubStockCartItems.id, line.cartItem.id),
            eq(hubStockCartItems.clerkUserId, clerkUserId),
          ),
        );
    }
  }
  return { ok: true };
}

export async function removeHubStockCartItemForUser(
  clerkUserId: string,
  cartItemId: string,
): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(hubStockCartItems)
    .where(
      and(
        eq(hubStockCartItems.id, cartItemId),
        eq(hubStockCartItems.clerkUserId, clerkUserId),
      ),
    )
    .returning({ id: hubStockCartItems.id });
  return deleted.length > 0;
}

export async function clearHubStockCartForUser(clerkUserId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(hubStockCartItems)
    .where(eq(hubStockCartItems.clerkUserId, clerkUserId));
}

export function buildStripeLineItemsFromHubStockCart(
  lines: HubStockCartLine[],
): StripeCheckoutPriceDataLine[] {
  return lines.map((line) => {
    const { cartItem, product } = line;
    const productCents = hubStockLineMerchandiseCents(line);
    const shippingCents = hubStockLineShippingCents(line);
    const destLabel =
      cartItem.destination === "us_address"
        ? shippingCents > 0
          ? `Warehouse package · ${cartItem.shippingCarrier ?? "Carrier"} ${cartItem.shippingService ?? ""}`.trim()
          : "Ship to US address"
        : "Pack for overseas container";
    const variant = [product.sizeLabel, product.colorLabel]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" · ");
    const shippingNote =
      shippingCents > 0 ?
        ` · Package shipping ${formatUsdForStripe(shippingCents)}`
      : "";
    return {
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: productCents + shippingCents,
        product_data: {
          name: product.name,
          description: `In-hub · ${variant} · Qty ${cartItem.quantity} · ${destLabel}${shippingNote}`,
        },
      },
    };
  });
}

function formatUsdForStripe(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export type ReservedHubStockCheckoutLine = {
  itemRequestId: string;
  cartLine: HubStockCartLine;
  orderLine: CheckoutOrderLineInput;
};

/**
 * Creates synthetic approved item requests + quotes so in-hub cart lines can
 * ride the existing `order_items` checkout pipeline. Caller must insert order
 * items, then `insertHubStockOrderSnapshots`.
 */
export async function reserveHubStockCartForCheckout(
  clerkUserId: string,
  lines: HubStockCartLine[],
): Promise<
  | { ok: true; reserved: ReservedHubStockCheckoutLine[] }
  | { ok: false; message: string }
> {
  await ensureHubStockSchemaEnums();
  const reserved: ReservedHubStockCheckoutLine[] = [];

  try {
    for (const line of lines) {
      const available = await availableHubStockQty(line.product.id, {
        excludeCartItemId: line.cartItem.id,
      });
      if (line.cartItem.quantity > available || line.cartItem.quantity > line.product.stockQty) {
        await deleteReservedHubStockItemRequests(reserved.map((r) => r.itemRequestId));
        return {
          ok: false,
          message: `${line.product.name} no longer has enough stock. Refresh your cart.`,
        };
      }

      const db = getDb();
      const note = hubStockLineNote({
        destination: line.cartItem.destination,
        shipLine1: line.cartItem.shipLine1,
        shipLine2: line.cartItem.shipLine2,
        shipCity: line.cartItem.shipCity,
        shipState: line.cartItem.shipState,
        shipPostalCode: line.cartItem.shipPostalCode,
        shipCountry: line.cartItem.shipCountry,
      });
      const productCents = line.product.priceUsdCents * line.cartItem.quantity;
      const shippingCents = hubStockLineShippingCents(line);
      const lineTotal = productCents + shippingCents;
      const [request] = await db
        .insert(itemRequests)
        .values({
          clerkUserId,
          productUrl: hubStockProductUrl(line.product.id),
          productName: line.product.name,
          productSize: line.product.sizeLabel,
          productColor: line.product.colorLabel,
          quantity: line.cartItem.quantity,
          note,
          siteName: HUB_STOCK_SITE_NAME,
          status: "approved",
          source: "hub_stock",
          productImageUrl: line.imageUrl?.trim() || null,
        })
        .returning({ id: itemRequests.id });
      if (!request) {
        await deleteReservedHubStockItemRequests(reserved.map((r) => r.itemRequestId));
        return { ok: false, message: "Could not reserve in-hub cart lines." };
      }

      await insertItemQuoteForRequest(request.id, {
        itemCost: productCents,
        serviceFee: 0,
        packingFeeCents: 0,
        estimatedShipping: shippingCents,
        totalPrice: lineTotal,
        requestQuantity: line.cartItem.quantity,
        requestProductSize: line.product.sizeLabel,
        requestProductColor: line.product.colorLabel,
        requestProductName: line.product.name,
        staffNote:
          shippingCents > 0
            ? `In-hub catalog price plus this SKU's share of warehouse package shipping ${line.cartItem.shippingCarrier ?? ""} ${line.cartItem.shippingService ?? ""}`.trim()
            : "In-hub catalog price (no estimate).",
      });

      reserved.push({
        itemRequestId: request.id,
        cartLine: line,
        orderLine: {
          itemRequestId: request.id,
          quantity: line.cartItem.quantity,
          priceCents: lineTotal,
        },
      });
    }
    return { ok: true, reserved };
  } catch (e) {
    await deleteReservedHubStockItemRequests(reserved.map((r) => r.itemRequestId));
    throw e;
  }
}

export async function deleteReservedHubStockItemRequests(
  itemRequestIds: string[],
): Promise<void> {
  if (itemRequestIds.length === 0) return;
  const db = getDb();
  await db.delete(itemQuotes).where(inArray(itemQuotes.itemRequestId, itemRequestIds));
  await db.delete(itemRequests).where(inArray(itemRequests.id, itemRequestIds));
}

export async function insertHubStockOrderSnapshots(
  orderId: string,
  reserved: ReservedHubStockCheckoutLine[],
  orderItemIdByRequestId: Map<string, string>,
): Promise<{ ok: true } | { ok: false; cause: unknown }> {
  if (reserved.length === 0) return { ok: true };
  const db = getDb();
  try {
    await db.insert(hubStockOrderItems).values(
      reserved.map((row) => {
        const orderItemId = orderItemIdByRequestId.get(row.itemRequestId);
        if (!orderItemId) {
          throw new Error("Missing order item for in-hub reservation.");
        }
        const { cartItem, product } = row.cartLine;
        return {
          orderId,
          orderItemId,
          itemRequestId: row.itemRequestId,
          productId: product.id,
          destination: cartItem.destination,
          quantity: cartItem.quantity,
          unitPriceCents: product.priceUsdCents,
          lineTotalCents: product.priceUsdCents * cartItem.quantity + (cartItem.shippingCents ?? 0),
          nameSnapshot: product.name,
          sizeSnapshot: product.sizeLabel,
          colorSnapshot: product.colorLabel,
          shipLine1: cartItem.shipLine1,
          shipLine2: cartItem.shipLine2,
          shipCity: cartItem.shipCity,
          shipState: cartItem.shipState,
          shipPostalCode: cartItem.shipPostalCode,
          shipCountry: cartItem.shipCountry,
          shippingCents: cartItem.shippingCents ?? 0,
          shippingCarrier: cartItem.shippingCarrier,
          shippingService: cartItem.shippingService,
          parcelWeightOz: product.parcelWeightOz,
          parcelLengthIn: product.parcelLengthIn,
          parcelWidthIn: product.parcelWidthIn,
          parcelHeightIn: product.parcelHeightIn,
        };
      }),
    );
    return { ok: true };
  } catch (cause) {
    return { ok: false, cause };
  }
}

export async function restoreHubStockCartFromPendingOrder(
  clerkUserId: string,
  orderId: string,
): Promise<string[]> {
  const db = getDb();
  const snapshots = await db
    .select()
    .from(hubStockOrderItems)
    .where(eq(hubStockOrderItems.orderId, orderId));

  const itemRequestIds = snapshots.map((row) => row.itemRequestId);

  for (const snap of snapshots) {
    if (!snap.productId) continue;
    const [existing] = await db
      .select()
      .from(hubStockCartItems)
      .where(
        and(
          eq(hubStockCartItems.clerkUserId, clerkUserId),
          eq(hubStockCartItems.productId, snap.productId),
          eq(hubStockCartItems.destination, snap.destination),
        ),
      )
      .limit(1);
    const now = new Date().toISOString();
    if (existing) {
      await db
        .update(hubStockCartItems)
        .set({
          quantity: existing.quantity + snap.quantity,
          shipLine1: snap.shipLine1,
          shipLine2: snap.shipLine2,
          shipCity: snap.shipCity,
          shipState: snap.shipState,
          shipPostalCode: snap.shipPostalCode,
          shipCountry: snap.shipCountry,
          shippingCents: snap.shippingCents ?? 0,
          shippingCarrier: snap.shippingCarrier,
          shippingService: snap.shippingService,
          updatedAt: now,
        })
        .where(eq(hubStockCartItems.id, existing.id));
    } else {
      await db.insert(hubStockCartItems).values({
        clerkUserId,
        productId: snap.productId,
        quantity: snap.quantity,
        destination: snap.destination,
        shipLine1: snap.shipLine1,
        shipLine2: snap.shipLine2,
        shipCity: snap.shipCity,
        shipState: snap.shipState,
        shipPostalCode: snap.shipPostalCode,
        shipCountry: snap.shipCountry,
        shippingCents: snap.shippingCents ?? 0,
        shippingCarrier: snap.shippingCarrier,
        shippingService: snap.shippingService,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return itemRequestIds;
}

export async function listHubStockOrderItemsByOrderItemIds(
  orderItemIds: string[],
): Promise<Map<string, typeof hubStockOrderItems.$inferSelect>> {
  const map = new Map<string, typeof hubStockOrderItems.$inferSelect>();
  if (orderItemIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select()
    .from(hubStockOrderItems)
    .where(inArray(hubStockOrderItems.orderItemId, orderItemIds));
  for (const row of rows) {
    map.set(row.orderItemId, row);
  }
  return map;
}

export async function listHubStockOrderItemsByOrderId(
  orderId: string,
): Promise<(typeof hubStockOrderItems.$inferSelect)[]> {
  const db = getDb();
  return db
    .select()
    .from(hubStockOrderItems)
    .where(eq(hubStockOrderItems.orderId, orderId));
}

export async function getHubStockOrderItemByOrderItemId(
  orderItemId: string,
): Promise<typeof hubStockOrderItems.$inferSelect | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(hubStockOrderItems)
    .where(eq(hubStockOrderItems.orderItemId, orderItemId))
    .limit(1);
  return row;
}
