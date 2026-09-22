/**
 * Returns and exchanges. Returned pieces come back as RETURNED and must pass quality check
 * before they can be sold again (GOOD → AVAILABLE, DAMAGED → DAMAGED).
 */
import { repos, transaction } from "@/data";
import type { Actor, InventoryItem, Order, OrderItem, PaymentMethod, ReturnRequest, ReturnStatus } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { isAvailableNow } from "@/domain/rules/inventory";
import { effectivePrice } from "@/domain/rules/pricing";
import { newId } from "@/lib/id";
import { formatINR } from "@/lib/format";
import { recordAudit } from "./audit";
import { getCatalog } from "./catalog";
import { DAY_MS, WEBSITE_ACTOR, currentActor, now } from "./context";
import { changeItems, loadItemsOrThrow } from "./inventory-core";
import { recomputeCustomerStatsInTx } from "./customers";
import { notify } from "./notifications";
import { createOrderInTx, loadOrder, setOrderStatusInTx, type PaymentInput } from "./orders";
import { getSettings } from "./settings";

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved · awaiting parcel",
  REJECTED: "Rejected",
  RECEIVED: "Parcel received",
  QC_COMPLETED: "Quality checked",
  REFUNDED: "Refunded",
  EXCHANGED: "Exchanged",
};

const OPEN: ReturnStatus[] = ["REQUESTED", "APPROVED", "RECEIVED", "QC_COMPLETED"];

async function loadReturn(returnId: string): Promise<ReturnRequest> {
  const ret = await repos().returns.get(returnId);
  if (!ret) throw new DomainError("Return not found");
  return ret;
}

async function saveReturn(ret: ReturnRequest, status: ReturnStatus, label: string, actor: Actor, extra: Partial<ReturnRequest> = {}): Promise<ReturnRequest> {
  const updated: ReturnRequest = {
    ...ret,
    ...extra,
    status,
    timeline: [...ret.timeline, { label, actorName: actor.name, at: now() }],
    updatedAt: now(),
  };
  await repos().returns.put(updated);
  await recordAudit({
    action: "RETURN_UPDATED",
    entityType: "RETURN",
    entityId: ret.id,
    entityLabel: `${ret.number} (order #${ret.orderNumber})`,
    summary: label,
    before: ret.status,
    after: status,
    actor,
  });
  return updated;
}

async function notifyReturn(ret: ReturnRequest, order: Order): Promise<void> {
  await notify("RETURN_UPDATE", { order, vars: { returnNumber: ret.number, returnStatus: RETURN_STATUS_LABELS[ret.status].toLowerCase() } });
}

export interface ReturnRequestInput {
  orderId: string;
  orderItemIds: string[];
  type: "RETURN" | "EXCHANGE";
  reason: string;
}

export async function requestReturnInTx(input: ReturnRequestInput, actor: Actor): Promise<ReturnRequest> {
  const r = repos();
  const order = await loadOrder(input.orderId);
  if (order.status !== "DELIVERED") throw new DomainError("Returns can be requested only for delivered orders");
  const settings = await getSettings();
  const shipment = await r.shipments.findByOrder(order.id);
  const deliveredAt = shipment?.deliveredAt ?? order.updatedAt;
  if (actor === WEBSITE_ACTOR && now() - deliveredAt > settings.store.returnWindowDays * DAY_MS) {
    throw new DomainError(`The ${settings.store.returnWindowDays}-day return window for this order has closed`);
  }
  const open = (await r.returns.listByOrder(order.id)).find((x) => OPEN.includes(x.status));
  if (open) throw new DomainError(`Return ${open.number} is already open for this order`);
  const orderItems = (await r.orderItems.listByOrder(order.id)).filter((oi) => oi.status === "ACTIVE" && input.orderItemIds.includes(oi.id));
  if (orderItems.length === 0) throw new DomainError("Choose at least one saree to return");
  if (!input.reason.trim()) throw new DomainError("Tell us the reason for the return");

  const seq = await r.counters.next("return");
  const t = now();
  const ret: ReturnRequest = {
    id: newId("ret"),
    number: `RET-${String(seq).padStart(4, "0")}`,
    orderId: order.id,
    orderNumber: order.number,
    customerId: order.customerId,
    customerName: order.customer.name,
    type: input.type,
    status: "REQUESTED",
    reason: input.reason.trim(),
    lines: orderItems.map((oi) => ({
      orderItemId: oi.id,
      inventoryItemId: oi.inventoryItemId,
      sku: oi.sku,
      designName: oi.designName,
      colourName: oi.colourName,
      unitPrice: oi.lineTotal,
      qc: "PENDING",
    })),
    refundAmount: orderItems.reduce((s, oi) => s + oi.lineTotal, 0),
    exchange: null,
    timeline: [{ label: `${input.type === "EXCHANGE" ? "Exchange" : "Return"} requested`, actorName: actor.name, at: t }],
    createdAt: t,
    updatedAt: t,
  };
  await r.returns.add(ret);
  await setOrderStatusInTx(order, "RETURN_REQUESTED", `${input.type === "EXCHANGE" ? "Exchange" : "Return"} requested (${ret.number})`, actor, {}, ret.reason);
  await notifyReturn(ret, order);
  return ret;
}

export function requestReturn(input: ReturnRequestInput, fromStore = false): Promise<ReturnRequest> {
  const actor = fromStore ? WEBSITE_ACTOR : currentActor();
  if (!fromStore) assertPermission(actor, "returns:manage");
  return transaction(() => requestReturnInTx(input, actor));
}

function guard(): Actor {
  const actor = currentActor();
  assertPermission(actor, "returns:manage");
  return actor;
}

export async function approveReturn(returnId: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const ret = await loadReturn(returnId);
    if (ret.status !== "REQUESTED") throw new DomainError(`${ret.number} is not awaiting approval`);
    const updated = await saveReturn(ret, "APPROVED", "Approved · reverse pickup scheduled", actor);
    await notifyReturn(updated, await loadOrder(ret.orderId));
  });
}

export async function rejectReturn(returnId: string, reason: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const ret = await loadReturn(returnId);
    if (ret.status !== "REQUESTED") throw new DomainError(`${ret.number} can no longer be rejected`);
    const updated = await saveReturn(ret, "REJECTED", `Rejected: ${reason || "does not meet return policy"}`, actor);
    const order = await loadOrder(ret.orderId);
    await setOrderStatusInTx(order, "DELIVERED", `Return ${ret.number} rejected`, actor, {}, reason);
    await notifyReturn(updated, order);
  });
}

/** Parcel is back at the shop. Pieces become RETURNED and wait for quality check. */
export async function receiveReturn(returnId: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const ret = await loadReturn(returnId);
    if (ret.status !== "APPROVED") throw new DomainError(`${ret.number} must be approved before receiving`);
    const order = await loadOrder(ret.orderId);
    const items = await loadItemsOrThrow(ret.lines.map((l) => l.inventoryItemId));
    await changeItems(items, {
      type: "RETURN_RECEIVED",
      status: "RETURNED",
      reservation: null,
      channel: order.channel,
      refType: "RETURN",
      refId: ret.id,
      refLabel: ret.number,
      note: `Returned from order #${order.number}: ${ret.reason}`,
    }, actor);
    const updated = await saveReturn(ret, "RECEIVED", "Parcel received at shop", actor);
    await notifyReturn(updated, order);
  });
}

/** Records quality check per piece. Good pieces go back on sale; damaged ones are set aside. */
export async function completeQualityCheck(returnId: string, results: Record<string, "GOOD" | "DAMAGED">, location: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const ret = await loadReturn(returnId);
    if (ret.status !== "RECEIVED") throw new DomainError(`${ret.number} must be received before quality check`);
    const missing = ret.lines.find((l) => !results[l.inventoryItemId]);
    if (missing) throw new DomainError(`Record a result for ${missing.sku}`);
    const items = await loadItemsOrThrow(ret.lines.map((l) => l.inventoryItemId));
    const good = items.filter((i) => results[i.id] === "GOOD");
    const damaged = items.filter((i) => results[i.id] === "DAMAGED");
    await changeItems(good, { type: "QC_PASSED", status: "AVAILABLE", location: location.trim() || undefined, refType: "RETURN", refId: ret.id, refLabel: ret.number, note: "Quality check passed, back on sale" }, actor);
    await changeItems(damaged, { type: "QC_FAILED", status: "DAMAGED", refType: "RETURN", refId: ret.id, refLabel: ret.number, note: "Quality check failed" }, actor);
    await saveReturn(ret, "QC_COMPLETED", `Quality check: ${good.length} good, ${damaged.length} damaged`, actor, {
      lines: ret.lines.map((l) => ({ ...l, qc: results[l.inventoryItemId]! })),
    });
  });
}

async function markOrderItems(ret: ReturnRequest, status: OrderItem["status"]): Promise<void> {
  const r = repos();
  const items = await r.orderItems.getMany(ret.lines.map((l) => l.orderItemId));
  await r.orderItems.bulkPut(items.map((i) => ({ ...i, status })));
}

export async function refundReturn(returnId: string, method: PaymentMethod): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const r = repos();
    const ret = await loadReturn(returnId);
    if (ret.type !== "RETURN") throw new DomainError(`${ret.number} is an exchange`);
    if (ret.status !== "QC_COMPLETED") throw new DomainError(`${ret.number} needs quality check before refund`);
    let order = await loadOrder(ret.orderId);
    await r.payments.add({ id: newId("pay"), orderId: order.id, kind: "REFUND", method, amount: ret.refundAmount, reference: `RFND-${ret.number}`, createdAt: now() });
    await markOrderItems(ret, "RETURNED");
    const remaining = (await r.orderItems.listByOrder(order.id)).filter((i) => i.status === "ACTIVE");
    const fullyReturned = remaining.length === 0;
    order = await setOrderStatusInTx(order, fullyReturned ? "RETURNED" : "DELIVERED", `Return ${ret.number} received`, actor);
    if (fullyReturned) {
      order = await setOrderStatusInTx(order, "REFUNDED", `Refunded ${formatINR(ret.refundAmount)}`, actor, { paymentStatus: "REFUNDED" });
    } else {
      order = { ...order, paymentStatus: "PARTIALLY_REFUNDED", updatedAt: now() };
      await r.orders.put(order);
    }
    const updated = await saveReturn(ret, "REFUNDED", `Refunded ${formatINR(ret.refundAmount)} via ${method}`, actor);
    await recomputeCustomerStatsInTx(order.customerId);
    await notifyReturn(updated, order);
  });
}

export interface ExchangeCandidate {
  item: InventoryItem;
  designName: string;
  colourName: string;
  price: number;
}

export async function findExchangeCandidates(q: string): Promise<ExchangeCandidate[]> {
  const r = repos();
  const [items, designs, catalog] = await Promise.all([r.inventory.listByStatus("AVAILABLE"), r.designs.list(), getCatalog()]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const needle = q.trim().toLowerCase();
  return items
    .map((item) => {
      const design = designById.get(item.designId)!;
      return { item, designName: design.name, colourName: catalog.colourById.get(item.colourId)?.name ?? "", price: effectivePrice(item, design) };
    })
    .filter((c) => !needle || `${c.item.sku} ${c.designName} ${c.colourName}`.toLowerCase().includes(needle))
    .slice(0, 30);
}

/**
 * Completes an exchange: the returned piece has passed QC, the replacement is sold on a new
 * order paid with exchange credit, and the price difference is collected or refunded.
 */
export async function completeExchange(returnId: string, newItemId: string, settlementMethod: PaymentMethod): Promise<Order> {
  const actor = guard();
  return transaction(async () => {
    const r = repos();
    const ret = await loadReturn(returnId);
    if (ret.type !== "EXCHANGE") throw new DomainError(`${ret.number} is a return, not an exchange`);
    if (ret.status !== "QC_COMPLETED") throw new DomainError(`${ret.number} needs quality check first`);
    const original = await loadOrder(ret.orderId);
    const [newItem] = await loadItemsOrThrow([newItemId]);
    if (!isAvailableNow(newItem!, now())) throw new DomainError(`${newItem!.sku} is not available`);
    const design = (await r.designs.get(newItem!.designId))!;
    const newPrice = effectivePrice(newItem!, design);
    const credit = ret.refundAmount;
    const difference = newPrice - credit;

    const payments: PaymentInput[] = [{ method: "STORE_CREDIT", amount: Math.min(credit, newPrice), reference: ret.number }];
    if (difference > 0) payments.push({ method: settlementMethod, amount: difference, reference: `EXCH-${ret.number}` });
    const shipping = original.fulfilment === "SHIPPING";
    const { order } = await createOrderInTx({
      channel: original.channel,
      items: [newItem!],
      customer: original.customerId ? ((await r.customers.get(original.customerId)) ?? null) : null,
      customerSnapshot: original.customer,
      shippingAddress: original.shippingAddress,
      fulfilment: original.fulfilment,
      status: shipping ? "RESERVED" : "DELIVERED",
      paymentStatus: "PAID",
      payments,
      unitPrices: { [newItem!.id]: newPrice },
      events: [
        { label: `Exchange for order #${original.number}`, status: "CONFIRMED", note: ret.number },
        { label: shipping ? "Items reserved" : "Handed over to customer", status: shipping ? "RESERVED" : "DELIVERED" },
      ],
      exchangeOfOrderId: original.id,
      actor,
    });
    if (difference < 0) {
      await r.payments.add({ id: newId("pay"), orderId: original.id, kind: "REFUND", method: settlementMethod, amount: -difference, reference: `EXCH-${ret.number}`, createdAt: now() });
    }
    await changeItems([newItem!], shipping
      ? { type: "RESERVED", status: "RESERVED", reservation: { kind: "ORDER", holderId: order.id, channel: order.channel, orderId: order.id, reservedAt: now(), expiresAt: null }, channel: order.channel, refType: "ORDER", refId: order.id, refLabel: `#${order.number}`, note: `Exchange for ${ret.number}` }
      : { type: "SOLD", status: "SOLD", reservation: null, soldOrderId: order.id, channel: order.channel, refType: "ORDER", refId: order.id, refLabel: `#${order.number}`, note: `Exchange for ${ret.number}` },
      actor);
    await markOrderItems(ret, "EXCHANGED");
    await setOrderStatusInTx(original, "DELIVERED", `Exchanged via ${ret.number} → order #${order.number}`, actor, difference < 0 ? { paymentStatus: "PARTIALLY_REFUNDED" } : {});
    const updated = await saveReturn(ret, "EXCHANGED", `Exchanged for ${newItem!.sku} (${difference === 0 ? "no difference" : difference > 0 ? `collected ${formatINR(difference)}` : `refunded ${formatINR(-difference)}`})`, actor, {
      exchange: { newInventoryItemId: newItem!.id, newSku: newItem!.sku, newDesignName: design.name, newPrice, priceDifference: difference, newOrderId: order.id },
    });
    await recomputeCustomerStatsInTx(original.customerId);
    await notifyReturn(updated, original);
    return order;
  });
}

export async function listReturns(): Promise<ReturnRequest[]> {
  return (await repos().returns.list()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getReturn(returnId: string): Promise<ReturnRequest | undefined> {
  return repos().returns.get(returnId);
}
