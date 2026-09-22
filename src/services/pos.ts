import { repos, transaction } from "@/data";
import type { Design, InventoryItem, Order, PaymentMethod } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { isAvailableNow, isHeldBy, unavailableReason } from "@/domain/rules/inventory";
import { effectivePrice } from "@/domain/rules/pricing";
import { changeItems } from "./inventory-core";
import { getCatalog } from "./catalog";
import { currentActor, now } from "./context";
import { recomputeCustomerStatsInTx, upsertCustomerInTx } from "./customers";
import { notify } from "./notifications";
import { createOrderInTx, type PaymentInput } from "./orders";
import { getHeldLines, holdItem, holdNextAvailable, releaseHolder, releaseItem } from "./reservations";
import { getSettings } from "./settings";

/** The demo has one billing counter. Items in its cart are held so no other channel can sell them. */
export const POS_TERMINAL_ID = "pos-counter-1";

async function holdOptions() {
  const settings = await getSettings();
  return { holderId: POS_TERMINAL_ID, kind: "HOLD" as const, channel: "SHOP" as const, ttlMinutes: settings.store.posHoldMinutes };
}

export async function posAddBySku(sku: string): Promise<InventoryItem> {
  assertPermission(currentActor(), "pos:use");
  const code = sku.trim().toUpperCase();
  if (!code) throw new DomainError("Scan or type a SKU");
  const item = await repos().inventory.findBySku(code);
  if (!item) throw new DomainError(`No saree found with SKU ${code}`, "NOT_FOUND");
  if (isHeldBy(item, POS_TERMINAL_ID, now())) throw new DomainError(`${item.sku} is already in the cart`, "DUPLICATE");
  return holdItem(item.id, await holdOptions());
}

export async function posAddItem(itemId: string): Promise<InventoryItem> {
  assertPermission(currentActor(), "pos:use");
  return holdItem(itemId, await holdOptions());
}

/** Adds another piece of the same design and colour (quantity + 1), oldest stock first. */
export async function posAddAnother(designId: string, colourId: string): Promise<InventoryItem> {
  assertPermission(currentActor(), "pos:use");
  return holdNextAvailable(designId, colourId, await holdOptions());
}

export function posRemove(itemId: string): Promise<void> {
  return releaseItem(itemId, POS_TERMINAL_ID, "Removed from POS cart");
}

export function posClear(): Promise<void> {
  return releaseHolder(POS_TERMINAL_ID, "POS cart cleared");
}

export function getPosCart() {
  return getHeldLines(POS_TERMINAL_ID);
}

export interface PosCatalogEntry {
  design: Design;
  fabricName: string;
  categoryName: string;
  available: number;
  minPrice: number;
  maxPrice: number;
  imageId: string | null;
  pieces: { item: InventoryItem; price: number; colourName: string; colourHex: string; blockedReason: string | null }[];
}

/** Browsable catalogue for the POS. Includes unavailable pieces so staff see why they cannot sell them. */
export async function searchPosCatalog(input: { q?: string; categoryId?: string | null; fabricId?: string | null; limit?: number }): Promise<{ entries: PosCatalogEntry[]; skuMatch: InventoryItem | null }> {
  const r = repos();
  const [designs, items, catalog] = await Promise.all([r.designs.list(), r.inventory.list(), getCatalog()]);
  const q = input.q?.trim().toLowerCase() ?? "";
  const t = now();
  const skuMatch = q ? items.find((i) => i.sku.toLowerCase() === q) ?? null : null;
  const byDesign = new Map<string, InventoryItem[]>();
  for (const i of items) {
    if (i.status === "SOLD") continue;
    const list = byDesign.get(i.designId) ?? [];
    list.push(i);
    byDesign.set(i.designId, list);
  }
  const entries: PosCatalogEntry[] = [];
  for (const design of designs) {
    if (input.categoryId && design.categoryId !== input.categoryId) continue;
    if (input.fabricId && design.fabricId !== input.fabricId) continue;
    const pieces = byDesign.get(design.id) ?? [];
    const fabricName = catalog.fabricById.get(design.fabricId)?.name ?? "";
    if (q) {
      const hay = `${design.name} ${design.code} ${fabricName} ${pieces.map((p) => `${p.sku} ${catalog.colourById.get(p.colourId)?.name ?? ""}`).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    const sellable = pieces.filter((p) => isAvailableNow(p, t));
    if (sellable.length === 0 && !q) continue;
    const prices = sellable.map((p) => effectivePrice(p, design));
    entries.push({
      design,
      fabricName,
      categoryName: catalog.categoryById.get(design.categoryId)?.name ?? "",
      available: sellable.length,
      minPrice: prices.length ? Math.min(...prices) : design.price,
      maxPrice: prices.length ? Math.max(...prices) : design.price,
      imageId: design.imageIds[0] ?? pieces.find((p) => p.imageIds.length)?.imageIds[0] ?? null,
      pieces: pieces
        .sort((a, b) => a.receivedAt - b.receivedAt)
        .map((item) => {
          const colour = catalog.colourById.get(item.colourId);
          return {
            item,
            price: effectivePrice(item, design),
            colourName: colour?.name ?? "",
            colourHex: colour?.hex ?? "#999",
            blockedReason: isHeldBy(item, POS_TERMINAL_ID, t) ? "In this cart" : unavailableReason(item, t),
          };
        }),
    });
  }
  entries.sort((a, b) => b.available - a.available || a.design.name.localeCompare(b.design.name));
  return { entries: entries.slice(0, input.limit ?? 60), skuMatch };
}

export interface PosSaleInput {
  lineDiscounts: Record<string, number>;
  orderDiscount: number;
  customer: { id: string } | { name: string; phone: string } | null;
  payments: { method: PaymentMethod; amount: number; reference?: string }[];
  notes?: string;
  sendReceipt?: boolean;
}

/**
 * Completes a counter sale: re-validates every piece, writes the order with price snapshots,
 * marks pieces SOLD with movements and updates the customer, all in one transaction.
 */
export async function completePosSale(input: PosSaleInput): Promise<Order> {
  const actor = currentActor();
  assertPermission(actor, "pos:use");
  return transaction(async () => {
    const r = repos();
    const t = now();
    const items = (await r.inventory.listByHolder(POS_TERMINAL_ID)).filter((i) => i.status === "RESERVED");
    if (items.length === 0) throw new DomainError("The cart is empty");
    for (const item of items) {
      if (!isHeldBy(item, POS_TERMINAL_ID, t)) throw new DomainError(`The counter hold on ${item.sku} expired. Scan it again.`);
    }

    let customer = null;
    if (input.customer && "id" in input.customer) {
      customer = (await r.customers.get(input.customer.id)) ?? null;
    } else if (input.customer) {
      customer = await upsertCustomerInTx({ ...input.customer, source: "SHOP" });
    }

    const payments: PaymentInput[] = input.payments.filter((p) => p.amount > 0);
    const methods = new Set(payments.map((p) => p.method));
    const { order } = await createOrderInTx({
      channel: "SHOP",
      items,
      lineDiscounts: input.lineDiscounts,
      orderDiscount: input.orderDiscount,
      customer,
      shippingAddress: null,
      fulfilment: "IN_STORE",
      status: "DELIVERED",
      paymentStatus: "PAID",
      payments,
      events: [
        { label: "Order placed at counter", status: "CONFIRMED" },
        { label: "Payment received", status: null, note: [...methods].join(" + ") },
        { label: "Handed over to customer", status: "DELIVERED" },
      ],
      notes: input.notes,
      actor,
    });

    await changeItems(items, {
      type: "SOLD",
      status: "SOLD",
      reservation: null,
      soldOrderId: order.id,
      channel: "SHOP",
      refType: "ORDER",
      refId: order.id,
      refLabel: `#${order.number}`,
      note: "Sold at counter",
    }, actor);
    await recomputeCustomerStatsInTx(customer?.id ?? null);
    if (customer && input.sendReceipt) await notify("PAYMENT_RECEIVED", { order, customer, vars: {} });
    return order;
  });
}
