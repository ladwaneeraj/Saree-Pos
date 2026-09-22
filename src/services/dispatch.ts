import { repos, transaction } from "@/data";
import type { Actor, Order, OrderItem, Shipment, ShipmentEvent, ShipmentStatus } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { newId } from "@/lib/id";
import { DAY_MS, currentActor, now } from "./context";
import { changeItems } from "./inventory-core";
import { notify } from "./notifications";
import { loadOrder, orderReservedItems, setOrderStatusInTx } from "./orders";
import { getSettings } from "./settings";

export type DispatchColumn = "TO_PACK" | "READY" | "DISPATCHED" | "IN_TRANSIT" | "DELIVERED";

export interface DispatchCard {
  order: Order;
  items: OrderItem[];
  locations: string[];
  shipment: Shipment | undefined;
}

export type DispatchBoard = Record<DispatchColumn, DispatchCard[]>;

const COLUMN_OF: Partial<Record<Order["status"], DispatchColumn>> = {
  CONFIRMED: "TO_PACK",
  RESERVED: "TO_PACK",
  PACKING: "TO_PACK",
  READY_TO_DISPATCH: "READY",
  DISPATCHED: "DISPATCHED",
  IN_TRANSIT: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
};

/** Orders that ship to customers, grouped by stage. Delivered shows the last 7 days. */
export async function getDispatchBoard(): Promise<DispatchBoard> {
  const r = repos();
  const orders = (await r.orders.listByStatuses(Object.keys(COLUMN_OF) as Order["status"][])).filter(
    (o) => o.fulfilment === "SHIPPING" && (o.status !== "DELIVERED" || o.updatedAt > now() - 7 * DAY_MS),
  );
  const [items, shipments] = await Promise.all([r.orderItems.listByOrders(orders.map((o) => o.id)), r.shipments.listByOrders(orders.map((o) => o.id))]);
  const inventory = await r.inventory.getMany(items.map((i) => i.inventoryItemId));
  const locationByItem = new Map(inventory.map((i) => [i.id, i.location]));
  const board: DispatchBoard = { TO_PACK: [], READY: [], DISPATCHED: [], IN_TRANSIT: [], DELIVERED: [] };
  for (const order of orders.sort((a, b) => a.createdAt - b.createdAt)) {
    const orderItems = items.filter((i) => i.orderId === order.id);
    board[COLUMN_OF[order.status]!].push({
      order,
      items: orderItems,
      locations: orderItems.map((i) => locationByItem.get(i.inventoryItemId) ?? ""),
      shipment: shipments.find((s) => s.orderId === order.id),
    });
  }
  board.DELIVERED.reverse();
  return board;
}

function guard(): Actor {
  const actor = currentActor();
  assertPermission(actor, "dispatch:manage");
  return actor;
}

export async function startPacking(orderId: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    let order = await loadOrder(orderId);
    if (order.status === "CONFIRMED") order = await setOrderStatusInTx(order, "RESERVED", "Items reserved", actor);
    await setOrderStatusInTx(order, "PACKING", "Packing started", actor);
  });
}

export async function markReadyToDispatch(orderId: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    let order = await loadOrder(orderId);
    if (order.status === "RESERVED") order = await setOrderStatusInTx(order, "PACKING", "Packing started", actor);
    order = await setOrderStatusInTx(order, "READY_TO_DISPATCH", "Packed and ready to dispatch", actor);
    await notify("ORDER_PACKED", { order });
  });
}

const AWB_FORMATS: Record<string, () => string> = {
  DTDC: () => `D${randomDigits(9)}`,
  Delhivery: () => randomDigits(14),
  "Blue Dart": () => randomDigits(11),
  "India Post": () => `EK${randomDigits(9)}IN`,
  Xpressbees: () => `XB${randomDigits(12)}`,
};

function randomDigits(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b, i) => (i === 0 ? (b % 9) + 1 : b % 10)).join("");
}

export function suggestAwb(courier: string): string {
  return (AWB_FORMATS[courier] ?? (() => randomDigits(12)))();
}

export interface DispatchInput {
  courier: string;
  awb: string;
  dispatchedAt: number;
}

/** Hands the parcel to the courier: creates the shipment and marks the pieces SOLD. */
export async function dispatchOrder(orderId: string, input: DispatchInput): Promise<void> {
  const actor = guard();
  const awb = input.awb.trim().toUpperCase();
  if (!input.courier) throw new DomainError("Choose a courier");
  if (awb.length < 6) throw new DomainError("Enter the AWB / tracking number");
  await transaction(async () => {
    const r = repos();
    const order = await loadOrder(orderId);
    if (order.status !== "READY_TO_DISPATCH") throw new DomainError(`Order #${order.number} must be packed and ready before dispatch`);
    if (await r.shipments.findByOrder(orderId)) throw new DomainError(`Order #${order.number} already has a shipment`);
    const settings = await getSettings();
    const t = now();
    const origin = settings.business.city;
    const shipment: Shipment = {
      id: newId("shp"),
      orderId,
      courier: input.courier,
      awb,
      status: "DISPATCHED",
      dispatchedAt: input.dispatchedAt,
      expectedDeliveryAt: input.dispatchedAt + settings.shipping.defaultTransitDays * DAY_MS,
      deliveredAt: null,
      events: [{ status: "DISPATCHED", location: origin, description: `Picked up by ${input.courier}`, at: input.dispatchedAt }],
      createdAt: t,
      updatedAt: t,
    };
    await r.shipments.add(shipment);
    const items = await orderReservedItems(order);
    await changeItems(items, {
      type: "SOLD",
      status: "SOLD",
      reservation: null,
      soldOrderId: order.id,
      channel: order.channel,
      refType: "ORDER",
      refId: order.id,
      refLabel: `#${order.number}`,
      note: `Dispatched via ${input.courier} (${awb})`,
    }, actor);
    const updated = await setOrderStatusInTx(order, "DISPATCHED", `Dispatched via ${input.courier}`, actor, {}, `AWB ${awb}`);
    await notify("ORDER_DISPATCHED", { order: updated, vars: { courier: input.courier, awb } });
  });
}

const NEXT_SHIPMENT_STATUS: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
  DISPATCHED: "IN_TRANSIT",
  IN_TRANSIT: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

function simulatedEvent(status: ShipmentStatus, order: Order, courier: string, origin: string): ShipmentEvent {
  const city = order.shippingAddress?.city ?? "Destination";
  const hub = city === origin ? `${city} Hub` : `${city} Hub`;
  const describe: Record<ShipmentStatus, [string, string]> = {
    DISPATCHED: [origin, `Picked up by ${courier}`],
    IN_TRANSIT: [hub, "Arrived at destination hub"],
    OUT_FOR_DELIVERY: [city, "Out for delivery with courier executive"],
    DELIVERED: [city, `Delivered to ${order.customer.name.split(" ")[0]}`],
  };
  const [location, description] = describe[status];
  return { status, location, description, at: now() };
}

/** Demo helper: moves a shipment to its next tracking checkpoint. */
export async function advanceShipment(orderId: string): Promise<ShipmentStatus> {
  const actor = guard();
  return transaction(async () => {
    const r = repos();
    let order = await loadOrder(orderId);
    const shipment = await r.shipments.findByOrder(orderId);
    if (!shipment) throw new DomainError(`Order #${order.number} has not been dispatched`);
    const next = NEXT_SHIPMENT_STATUS[shipment.status];
    if (!next) throw new DomainError(`Order #${order.number} is already delivered`);
    const settings = await getSettings();
    const event = simulatedEvent(next, order, shipment.courier, settings.business.city);
    await r.shipments.put({
      ...shipment,
      status: next,
      events: [...shipment.events, event],
      deliveredAt: next === "DELIVERED" ? event.at : null,
      updatedAt: event.at,
    });
    if (next === "IN_TRANSIT") order = await setOrderStatusInTx(order, "IN_TRANSIT", "In transit", actor, {}, event.location);
    if (next === "OUT_FOR_DELIVERY") {
      const touched = { ...order, updatedAt: event.at };
      await r.orders.put(touched);
    }
    if (next === "DELIVERED") await deliverInTx(order, actor);
    return next;
  });
}

async function deliverInTx(order: Order, actor: Actor): Promise<void> {
  const updated = await setOrderStatusInTx(order, "DELIVERED", "Delivered", actor);
  const items = await repos().orderItems.listByOrder(order.id);
  await notify("ORDER_DELIVERED", { order: updated });
  await notify("REVIEW_REQUEST", { order: updated, vars: { design: items[0]?.designName ?? "saree" } });
}

export async function markDelivered(orderId: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const r = repos();
    const order = await loadOrder(orderId);
    const shipment = await r.shipments.findByOrder(orderId);
    if (shipment && shipment.status !== "DELIVERED") {
      const settings = await getSettings();
      const event = simulatedEvent("DELIVERED", order, shipment.courier, settings.business.city);
      await r.shipments.put({ ...shipment, status: "DELIVERED", deliveredAt: event.at, events: [...shipment.events, event], updatedAt: event.at });
    }
    await deliverInTx(order, actor);
  });
}

/** For WhatsApp orders collected at the shop instead of shipped. */
export async function handOverAtStore(orderId: string): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "orders:manage");
  await transaction(async () => {
    const order = await loadOrder(orderId);
    if (order.status !== "RESERVED") throw new DomainError(`Order #${order.number} must be paid and reserved first`);
    const items = await orderReservedItems(order);
    await changeItems(items, {
      type: "SOLD",
      status: "SOLD",
      reservation: null,
      soldOrderId: order.id,
      channel: order.channel,
      refType: "ORDER",
      refId: order.id,
      refLabel: `#${order.number}`,
      note: "Collected at store",
    }, actor);
    await setOrderStatusInTx(order, "DELIVERED", "Collected at store", actor);
  });
}

export const COURIER_TRACKING_HINT = "Live courier tracking connects when a courier API is configured.";
