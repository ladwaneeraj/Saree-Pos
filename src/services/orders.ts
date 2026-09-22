import { repos, transaction } from "@/data";
import type {
  Actor,
  Address,
  Customer,
  CustomerSnapshot,
  Design,
  Fulfilment,
  InventoryItem,
  Notification,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  ReturnRequest,
  SalesChannel,
  Shipment,
} from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { CANCELLABLE_STATUSES, assertOrderTransition } from "@/domain/rules/orders";
import { effectiveMrp, effectivePrice, splitInclusiveTax } from "@/domain/rules/pricing";
import { newId } from "@/lib/id";
import { formatINR } from "@/lib/format";
import { recordAudit } from "./audit";
import { getCatalog } from "./catalog";
import { currentActor, now } from "./context";
import { changeItems } from "./inventory-core";
import { recomputeCustomerStatsInTx } from "./customers";
import { notify } from "./notifications";
import { getSettings } from "./settings";

export const CHANNEL_LABELS: Record<SalesChannel, string> = { SHOP: "Shop", WEBSITE: "Website", WHATSAPP: "WhatsApp" };
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  NETBANKING: "Net banking",
  STORE_CREDIT: "Exchange credit",
};

export function orderEvent(label: string, status: OrderStatus | null, actor: Actor, at = now(), note = ""): OrderEvent {
  return { id: newId("evt"), label, status, note, actorName: actor.name, at };
}

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface CreateOrderSpec {
  channel: SalesChannel;
  items: InventoryItem[];
  lineDiscounts?: Record<string, number>;
  orderDiscount?: number;
  shippingFee?: number;
  customer: Customer | null;
  customerSnapshot?: CustomerSnapshot;
  shippingAddress: Address | null;
  fulfilment: Fulfilment;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payments: PaymentInput[];
  events: { label: string; status: OrderStatus | null; note?: string }[];
  notes?: string;
  paymentDueAt?: number | null;
  exchangeOfOrderId?: string | null;
  /** Price override per item id (exchanges, seeded history). Defaults to the current effective price. */
  unitPrices?: Record<string, number>;
  actor: Actor;
  at?: number;
}

export interface CreatedOrder {
  order: Order;
  orderItems: OrderItem[];
}

/** Writes an order with price snapshots. Callers handle inventory side effects. Inside a transaction. */
export async function createOrderInTx(spec: CreateOrderSpec): Promise<CreatedOrder> {
  const r = repos();
  if (spec.items.length === 0) throw new DomainError("Add at least one saree to the order");
  const t = spec.at ?? now();
  const [designs, catalog, settings] = await Promise.all([
    r.designs.getMany([...new Set(spec.items.map((i) => i.designId))]),
    getCatalog(),
    getSettings(),
  ]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const orderId = newId("ord");

  const orderItems: OrderItem[] = spec.items.map((item) => {
    const design = designById.get(item.designId) as Design;
    const unitPrice = spec.unitPrices?.[item.id] ?? effectivePrice(item, design);
    const discount = Math.max(0, Math.min(Math.round(spec.lineDiscounts?.[item.id] ?? 0), unitPrice));
    return {
      id: newId("oit"),
      orderId,
      inventoryItemId: item.id,
      sku: item.sku,
      designId: design.id,
      designName: design.name,
      colourName: catalog.colourById.get(item.colourId)?.name ?? "",
      fabricName: catalog.fabricById.get(design.fabricId)?.name ?? "",
      imageId: item.imageIds[0] ?? design.imageIds[0] ?? null,
      mrp: effectiveMrp(item, design),
      unitPrice,
      discount,
      lineTotal: unitPrice - discount,
      cost: item.cost,
      status: "ACTIVE",
      createdAt: t,
    };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.lineTotal, 0);
  const discount = Math.max(0, Math.min(Math.round(spec.orderDiscount ?? 0), subtotal));
  const shippingFee = Math.max(0, Math.round(spec.shippingFee ?? 0));
  const total = subtotal - discount + shippingFee;
  const paid = spec.payments.reduce((s, p) => s + p.amount, 0);
  if (spec.paymentStatus === "PAID" && paid !== total) {
    throw new DomainError(`Payments (${formatINR(paid)}) must equal the order total (${formatINR(total)})`);
  }

  const number = await r.counters.next("order");
  const snapshot = spec.customerSnapshot ?? {
    name: spec.customer?.name ?? "Walk-in customer",
    phone: spec.customer?.phone ?? "",
    email: spec.customer?.email ?? "",
  };
  const order: Order = {
    id: orderId,
    number,
    channel: spec.channel,
    status: spec.status,
    paymentStatus: spec.paymentStatus,
    fulfilment: spec.fulfilment,
    customerId: spec.customer?.id ?? null,
    customer: snapshot,
    shippingAddress: spec.shippingAddress,
    itemCount: orderItems.length,
    subtotal,
    discount,
    shippingFee,
    total,
    taxRate: settings.tax.gstRate,
    taxAmount: splitInclusiveTax(total - shippingFee, settings.tax.gstRate).tax,
    notes: spec.notes ?? "",
    paymentDueAt: spec.paymentDueAt ?? null,
    timeline: spec.events.map((e, i) => orderEvent(e.label, e.status, spec.actor, t + i, e.note)),
    exchangeOfOrderId: spec.exchangeOfOrderId ?? null,
    createdBy: spec.actor.name,
    createdAt: t,
    updatedAt: t,
  };
  const payments: Payment[] = spec.payments
    .filter((p) => p.amount > 0)
    .map((p) => ({
      id: newId("pay"),
      orderId,
      kind: "PAYMENT",
      method: p.method,
      amount: Math.round(p.amount),
      reference: p.reference ?? "",
      createdAt: t,
    }));

  await r.orders.add(order);
  await r.orderItems.bulkAdd(orderItems);
  await r.payments.bulkAdd(payments);
  await recordAudit({
    action: "ORDER_CREATED",
    entityType: "ORDER",
    entityId: order.id,
    entityLabel: `#${order.number}`,
    summary: `${CHANNEL_LABELS[order.channel]} order for ${formatINR(order.total)} (${order.itemCount} item${order.itemCount === 1 ? "" : "s"})`,
    actor: spec.actor,
  });
  return { order, orderItems };
}

/** Moves an order to a new status with a timeline event and audit record. Inside a transaction. */
export async function setOrderStatusInTx(
  order: Order,
  to: OrderStatus,
  label: string,
  actor: Actor,
  extra: Partial<Order> = {},
  note = "",
): Promise<Order> {
  assertOrderTransition(order, to);
  const updated: Order = {
    ...order,
    ...extra,
    status: to,
    timeline: [...order.timeline, orderEvent(label, to, actor, now(), note)],
    updatedAt: now(),
  };
  await repos().orders.put(updated);
  await recordAudit({
    action: "ORDER_STATUS_CHANGED",
    entityType: "ORDER",
    entityId: order.id,
    entityLabel: `#${order.number}`,
    summary: `${label}`,
    before: order.status,
    after: to,
    actor,
  });
  return updated;
}

export async function appendOrderEventInTx(order: Order, label: string, actor: Actor, note = ""): Promise<Order> {
  const updated = { ...order, timeline: [...order.timeline, orderEvent(label, null, actor, now(), note)], updatedAt: now() };
  await repos().orders.put(updated);
  return updated;
}

/** Pieces allocated to this order that are still in the shop. */
export async function orderReservedItems(order: Order): Promise<InventoryItem[]> {
  const orderItems = await repos().orderItems.listByOrder(order.id);
  const items = await repos().inventory.getMany(orderItems.filter((oi) => oi.status === "ACTIVE").map((oi) => oi.inventoryItemId));
  return items.filter((i) => i.status === "RESERVED" && i.reservation?.orderId === order.id);
}

export async function loadOrder(orderId: string): Promise<Order> {
  const order = await repos().orders.get(orderId);
  if (!order) throw new DomainError("Order not found");
  return order;
}

/* ------------------------------------------------------------------ */
/* Payments and cancellation                                           */
/* ------------------------------------------------------------------ */

export async function confirmPaymentInTx(order: Order, input: { method: PaymentMethod; reference?: string }, actor: Actor): Promise<Order> {
  if (order.status !== "PAYMENT_PENDING" && order.status !== "NEW") throw new DomainError(`Order #${order.number} is not awaiting payment`);
  const r = repos();
  const t = now();
  await r.payments.add({
    id: newId("pay"),
    orderId: order.id,
    kind: "PAYMENT",
    method: input.method,
    amount: order.total,
    reference: input.reference ?? "",
    createdAt: t,
  });
  let updated = await setOrderStatusInTx(order, "CONFIRMED", "Payment confirmed", actor, { paymentStatus: "PAID", paymentDueAt: null }, `${PAYMENT_METHOD_LABELS[input.method]} ${formatINR(order.total)}`);
  const held = await orderReservedItems(updated);
  await r.inventory.bulkPut(held.map((i) => ({ ...i, reservation: { ...i.reservation!, expiresAt: null }, updatedAt: t })));
  updated = await setOrderStatusInTx(updated, "RESERVED", "Items reserved", actor, {}, `${held.length} piece${held.length === 1 ? "" : "s"} allocated`);
  await recordAudit({
    action: "PAYMENT_RECORDED",
    entityType: "ORDER",
    entityId: order.id,
    entityLabel: `#${order.number}`,
    summary: `${PAYMENT_METHOD_LABELS[input.method]} payment of ${formatINR(order.total)} received`,
    actor,
  });
  await notify("PAYMENT_RECEIVED", { order: updated, vars: { amount: formatINR(order.total) } });
  await recomputeCustomerStatsInTx(order.customerId);
  return updated;
}

export async function confirmPayment(orderId: string, input: { method: PaymentMethod; reference?: string }): Promise<Order> {
  const actor = currentActor();
  assertPermission(actor, "orders:manage");
  return transaction(async () => confirmPaymentInTx(await loadOrder(orderId), input, actor));
}

export async function cancelOrderInTx(order: Order, reason: string, actor: Actor): Promise<Order> {
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new DomainError(`Order #${order.number} has left the shop and cannot be cancelled. Create a return instead.`);
  }
  const r = repos();
  const held = await orderReservedItems(order);
  await changeItems(held, {
    type: "RESERVATION_RELEASED",
    status: "AVAILABLE",
    reservation: null,
    channel: order.channel,
    refType: "ORDER",
    refId: order.id,
    refLabel: `#${order.number}`,
    note: `Order cancelled: ${reason}`,
  }, actor);

  let paymentStatus = order.paymentStatus;
  let refundNote = "";
  if (order.paymentStatus === "PAID") {
    const payments = await r.payments.listByOrder(order.id);
    const method = payments.find((p) => p.kind === "PAYMENT")?.method ?? "UPI";
    await r.payments.add({
      id: newId("pay"),
      orderId: order.id,
      kind: "REFUND",
      method,
      amount: order.total,
      reference: `RFND-${order.number}`,
      createdAt: now(),
    });
    paymentStatus = "REFUNDED";
    refundNote = `A refund of ${formatINR(order.total)} has been initiated to your original payment method.`;
  }
  const updated = await setOrderStatusInTx(order, "CANCELLED", "Order cancelled", actor, { paymentStatus, paymentDueAt: null }, reason);
  await recordAudit({
    action: "ORDER_CANCELLED",
    entityType: "ORDER",
    entityId: order.id,
    entityLabel: `#${order.number}`,
    summary: `Cancelled: ${reason}${refundNote ? " · refunded" : ""}`,
    actor,
  });
  await notify("ORDER_CANCELLED", { order: updated, vars: { refundNote } });
  await recomputeCustomerStatsInTx(order.customerId);
  return updated;
}

export async function cancelOrder(orderId: string, reason: string): Promise<Order> {
  const actor = currentActor();
  assertPermission(actor, "orders:manage");
  return transaction(async () => cancelOrderInTx(await loadOrder(orderId), reason.trim() || "Cancelled by staff", actor));
}

export async function addOrderNote(orderId: string, note: string): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "orders:manage");
  if (!note.trim()) return;
  await transaction(async () => {
    await appendOrderEventInTx(await loadOrder(orderId), "Note added", actor, note.trim());
  });
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

export type OrderTab = "ALL" | "ATTENTION" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "CLOSED";

export const ORDER_TAB_STATUSES: Record<Exclude<OrderTab, "ALL">, readonly OrderStatus[]> = {
  ATTENTION: ["NEW", "PAYMENT_PENDING", "RETURN_REQUESTED"],
  PROCESSING: ["CONFIRMED", "RESERVED", "PACKING", "READY_TO_DISPATCH"],
  SHIPPED: ["DISPATCHED", "IN_TRANSIT"],
  COMPLETED: ["DELIVERED"],
  CLOSED: ["CANCELLED", "RETURNED", "REFUNDED"],
};

export interface OrderQuery {
  q?: string;
  tab?: OrderTab;
  channel?: SalesChannel | "ALL";
  from?: number | null;
  to?: number | null;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderRow {
  order: Order;
  firstImageId: string | null;
  firstItemName: string;
}

export interface OrderPage {
  rows: OrderRow[];
  total: number;
  tabCounts: Record<OrderTab, number>;
}

export async function searchOrders(query: OrderQuery): Promise<OrderPage> {
  const r = repos();
  const all = query.customerId ? await r.orders.listByCustomer(query.customerId) : await r.orders.list();
  const q = query.q?.trim().toLowerCase().replace(/^#/, "") ?? "";
  const base = all.filter((o) => {
    if (query.channel && query.channel !== "ALL" && o.channel !== query.channel) return false;
    if (query.from && o.createdAt < query.from) return false;
    if (query.to && o.createdAt > query.to) return false;
    if (q) {
      const hay = `${o.number} ${o.customer.name} ${o.customer.phone} ${o.shippingAddress?.city ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const tabCounts: Record<OrderTab, number> = { ALL: base.length, ATTENTION: 0, PROCESSING: 0, SHIPPED: 0, COMPLETED: 0, CLOSED: 0 };
  for (const o of base) {
    for (const [tab, statuses] of Object.entries(ORDER_TAB_STATUSES)) if (statuses.includes(o.status)) tabCounts[tab as OrderTab]++;
  }
  const tab = query.tab ?? "ALL";
  const filtered = (tab === "ALL" ? base : base.filter((o) => ORDER_TAB_STATUSES[tab].includes(o.status))).sort((a, b) => b.createdAt - a.createdAt);
  const pageSize = query.pageSize ?? 25;
  const page = Math.max(1, query.page ?? 1);
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const items = await r.orderItems.listByOrders(pageRows.map((o) => o.id));
  const firstByOrder = new Map<string, OrderItem>();
  for (const it of items) if (!firstByOrder.has(it.orderId)) firstByOrder.set(it.orderId, it);
  return {
    rows: pageRows.map((order) => ({
      order,
      firstImageId: firstByOrder.get(order.id)?.imageId ?? null,
      firstItemName: firstByOrder.get(order.id)?.designName ?? "",
    })),
    total: filtered.length,
    tabCounts,
  };
}

export interface OrderLine extends OrderItem {
  /** Today's price for the same piece, shown to prove history does not change. */
  currentPrice: number | null;
  currentStatus: InventoryItem["status"] | null;
  location: string | null;
}

export interface OrderDetail {
  order: Order;
  lines: OrderLine[];
  payments: Payment[];
  paid: number;
  refunded: number;
  shipment: Shipment | undefined;
  returns: ReturnRequest[];
  notifications: Notification[];
  customer: Customer | undefined;
}

export async function getOrderDetail(idOrNumber: string): Promise<OrderDetail | null> {
  const r = repos();
  const asNumber = Number(idOrNumber.replace(/^#/, ""));
  const order = (await r.orders.get(idOrNumber)) ?? (Number.isInteger(asNumber) ? await r.orders.findByNumber(asNumber) : undefined);
  if (!order) return null;
  const [orderItems, payments, shipment, returns, notifications, customer] = await Promise.all([
    r.orderItems.listByOrder(order.id),
    r.payments.listByOrder(order.id),
    r.shipments.findByOrder(order.id),
    r.returns.listByOrder(order.id),
    r.notifications.listByOrder(order.id),
    order.customerId ? r.customers.get(order.customerId) : Promise.resolve(undefined),
  ]);
  const items = await r.inventory.getMany(orderItems.map((oi) => oi.inventoryItemId));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const designs = await r.designs.getMany([...new Set(items.map((i) => i.designId))]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  return {
    order,
    lines: orderItems.map((oi) => {
      const item = itemById.get(oi.inventoryItemId);
      const design = item ? designById.get(item.designId) : undefined;
      return {
        ...oi,
        currentPrice: item && design ? effectivePrice(item, design) : null,
        currentStatus: item?.status ?? null,
        location: item?.location ?? null,
      };
    }),
    payments,
    paid: payments.filter((p) => p.kind === "PAYMENT").reduce((s, p) => s + p.amount, 0),
    refunded: payments.filter((p) => p.kind === "REFUND").reduce((s, p) => s + p.amount, 0),
    shipment,
    returns,
    notifications,
    customer,
  };
}
