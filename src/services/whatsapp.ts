/**
 * Simulated WhatsApp sales desk. Conversations and messages live locally; the send/receive
 * functions are the seam where the WhatsApp Business API would plug in later.
 */
import { repos, transaction } from "@/data";
import type { Address, Actor, Order, WaConversation, WaMessage, WaMessageKind } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { isValidIndianMobile, normalizePhone } from "@/domain/rules/customers";
import { effectivePrice } from "@/domain/rules/pricing";
import { isAvailableNow } from "@/domain/rules/inventory";
import { newId } from "@/lib/id";
import { formatDateTime, formatINR } from "@/lib/format";
import { currentActor, now } from "./context";
import { changeItems } from "./inventory-core";
import { recomputeCustomerStatsInTx, upsertCustomerInTx } from "./customers";
import { notify, productUrl } from "./notifications";
import { confirmPaymentInTx, createOrderInTx, loadOrder, type CreatedOrder } from "./orders";
import { getHeldLines, holdItem, holdNextAvailable, releaseItem } from "./reservations";
import { getSettings } from "./settings";
import { formatShareMessage } from "./storefront";
import { getDesignStock } from "./inventory";
import type { PaymentMethod } from "@/domain/types";

function guard(): Actor {
  const actor = currentActor();
  assertPermission(actor, "whatsapp:use");
  return actor;
}

async function addMessageInTx(conversationId: string, message: Omit<WaMessage, "id" | "conversationId" | "createdAt"> & { createdAt?: number }): Promise<WaMessage> {
  const r = repos();
  const conversation = await r.conversations.get(conversationId);
  if (!conversation) throw new DomainError("Conversation not found");
  const msg: WaMessage = { ...message, id: newId("wam"), conversationId, createdAt: message.createdAt ?? now() };
  await r.messages.add(msg);
  await r.conversations.update(conversationId, {
    lastMessageAt: msg.createdAt,
    lastMessagePreview: msg.text.split("\n")[0]!.slice(0, 80),
    unreadCount: msg.direction === "IN" ? conversation.unreadCount + 1 : conversation.unreadCount,
  });
  return msg;
}

function message(direction: "IN" | "OUT", kind: WaMessageKind, text: string, extra: Partial<Pick<WaMessage, "designId" | "orderId" | "amount">> = {}) {
  return { direction, kind, text, designId: extra.designId ?? null, orderId: extra.orderId ?? null, amount: extra.amount ?? null };
}

export async function listConversations(): Promise<WaConversation[]> {
  return repos().conversations.listRecent();
}

export async function getConversation(conversationId: string) {
  const r = repos();
  const conversation = await r.conversations.get(conversationId);
  if (!conversation) return null;
  const [messages, held, orders, customer] = await Promise.all([
    r.messages.listByConversation(conversationId),
    getHeldLines(conversationId),
    r.orders.getMany(conversation.orderIds),
    conversation.customerId ? r.customers.get(conversation.customerId) : Promise.resolve(undefined),
  ]);
  const products = await liveProductCards([...new Set(messages.flatMap((m) => (m.designId ? [m.designId] : [])))]);
  return { conversation, messages, held, orders: orders.sort((a, b) => b.createdAt - a.createdAt), customer, products };
}

export interface WaProductCard {
  designId: string;
  name: string;
  slug: string;
  imageId: string | null;
  /** Lowest price among pieces that can be sold right now (design price when none). */
  price: number;
  available: number;
}

/** Product cards in a chat always show today's price and stock, not the values when they were sent. */
async function liveProductCards(designIds: string[]): Promise<Record<string, WaProductCard>> {
  if (designIds.length === 0) return {};
  const r = repos();
  const t = now();
  const designs = await r.designs.getMany(designIds);
  const out: Record<string, WaProductCard> = {};
  for (const design of designs) {
    const sellable = (await r.inventory.listByDesign(design.id)).filter((i) => isAvailableNow(i, t));
    out[design.id] = {
      designId: design.id,
      name: design.name,
      slug: design.slug,
      imageId: design.imageIds[0] ?? sellable.find((i) => i.imageIds.length)?.imageIds[0] ?? null,
      price: sellable.length ? Math.min(...sellable.map((i) => effectivePrice(i, design))) : design.price,
      available: sellable.length,
    };
  }
  return out;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  await repos().conversations.update(conversationId, { unreadCount: 0 });
}

export async function startConversation(name: string, phone: string): Promise<WaConversation> {
  guard();
  const p = normalizePhone(phone);
  if (!isValidIndianMobile(p)) throw new DomainError("Enter a valid 10-digit mobile number");
  return transaction(async () => {
    const r = repos();
    const existing = (await r.conversations.list()).find((c) => c.phone === p);
    if (existing) return existing;
    const customer = await r.customers.findByPhone(p);
    const t = now();
    const conversation: WaConversation = {
      id: newId("wac"),
      customerId: customer?.id ?? null,
      name: customer?.name ?? name.trim(),
      phone: p,
      lastMessageAt: t,
      lastMessagePreview: "New conversation",
      unreadCount: 0,
      orderIds: [],
      createdAt: t,
    };
    await r.conversations.add(conversation);
    return conversation;
  });
}

export async function sendText(conversationId: string, text: string): Promise<void> {
  guard();
  if (!text.trim()) return;
  await transaction(() => addMessageInTx(conversationId, message("OUT", "TEXT", text.trim())));
}

/** Demo control: adds a message as if the customer typed it. */
export async function simulateCustomerMessage(conversationId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  await transaction(() => addMessageInTx(conversationId, message("IN", "TEXT", text.trim())));
}

export async function buildProductShareMessage(designId: string): Promise<string> {
  const r = repos();
  const design = await r.designs.get(designId);
  if (!design) throw new DomainError("Design not found");
  const stock = await getDesignStock(designId);
  const available = (await r.inventory.listByDesignAndStatus(designId, "AVAILABLE"));
  const price = available.length ? Math.min(...available.map((i) => effectivePrice(i, design))) : design.price;
  return formatShareMessage({ name: design.name, price, description: design.description, available: stock.available, url: productUrl(design.slug) });
}

export async function sendProduct(conversationId: string, designId: string): Promise<void> {
  guard();
  const text = await buildProductShareMessage(designId);
  await transaction(() => addMessageInTx(conversationId, message("OUT", "PRODUCT", text, { designId })));
}

async function holdOptions(conversationId: string) {
  const settings = await getSettings();
  return { holderId: conversationId, kind: "HOLD" as const, channel: "WHATSAPP" as const, ttlMinutes: settings.store.whatsappHoldHours * 60 };
}

export async function holdForConversation(conversationId: string, target: { itemId: string } | { designId: string; colourId: string | null }) {
  guard();
  const opts = await holdOptions(conversationId);
  return "itemId" in target ? holdItem(target.itemId, opts) : holdNextAvailable(target.designId, target.colourId, opts);
}

export function releaseFromConversation(conversationId: string, itemId: string) {
  return releaseItem(itemId, conversationId, "Removed from WhatsApp hold");
}

export interface WhatsAppOrderInput {
  fulfilment: "SHIPPING" | "IN_STORE";
  address: Omit<Address, "id" | "label" | "name" | "phone"> | null;
  discount: number;
  name: string;
}

/** Turns the held pieces into an order awaiting payment. Pieces stay reserved until the payment deadline. */
export async function createWhatsAppOrder(conversationId: string, input: WhatsAppOrderInput): Promise<Order> {
  const actor = guard();
  return transaction(async () => {
    const r = repos();
    const conversation = await r.conversations.get(conversationId);
    if (!conversation) throw new DomainError("Conversation not found");
    const lines = await getHeldLines(conversationId);
    if (lines.length === 0) throw new DomainError("Hold at least one saree for this customer first");
    if (input.fulfilment === "SHIPPING" && (!input.address || !/^\d{6}$/.test(input.address.pincode))) {
      throw new DomainError("Enter the delivery address with a 6-digit pincode");
    }
    const settings = await getSettings();
    const address = input.fulfilment === "SHIPPING" && input.address
      ? { ...input.address, label: "Home", name: input.name || conversation.name, phone: conversation.phone }
      : undefined;
    const customer = await upsertCustomerInTx({ name: input.name || conversation.name, phone: conversation.phone, address, source: "WHATSAPP" });
    const subtotal = lines.reduce((s, l) => s + l.price, 0);
    const shippingFee = input.fulfilment === "SHIPPING" && subtotal < settings.shipping.freeAbove ? settings.shipping.flatFee : 0;
    const dueAt = now() + settings.store.whatsappHoldHours * 3_600_000;
    const created: CreatedOrder = await createOrderInTx({
      channel: "WHATSAPP",
      items: lines.map((l) => l.item),
      orderDiscount: input.discount,
      shippingFee,
      customer,
      shippingAddress: address ? { ...address, id: newId("adr") } : null,
      fulfilment: input.fulfilment,
      status: "PAYMENT_PENDING",
      paymentStatus: "PENDING",
      payments: [],
      paymentDueAt: dueAt,
      events: [
        { label: "Order created from WhatsApp chat", status: "NEW" },
        { label: "Awaiting payment", status: "PAYMENT_PENDING", note: `Pieces held until ${formatDateTime(dueAt)}` },
      ],
      actor,
    });
    const { order } = created;
    await changeItems(lines.map((l) => l.item), {
      type: "RESERVED",
      reservation: { kind: "ORDER", holderId: order.id, channel: "WHATSAPP", orderId: order.id, reservedAt: now(), expiresAt: dueAt },
      channel: "WHATSAPP",
      refType: "ORDER",
      refId: order.id,
      refLabel: `#${order.number}`,
      note: "WhatsApp hold converted to order (awaiting payment)",
    }, actor);
    await r.conversations.update(conversationId, { customerId: customer.id, name: customer.name, orderIds: [...conversation.orderIds, order.id] });
    await addMessageInTx(conversationId, message("OUT", "ORDER", `Order #${order.number} created · ${order.itemCount} saree${order.itemCount === 1 ? "" : "s"} · ${formatINR(order.total)}`, { orderId: order.id, amount: order.total }));
    await recomputeCustomerStatsInTx(customer.id);
    return order;
  });
}

/** Demo UPI ID of the shop. A real deployment reads this from payment settings. */
export const SHOP_UPI_ID = "dhanvisilks@okhdfc";

export function upiLink(order: Order, payee: string, vpa = SHOP_UPI_ID): string {
  return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payee)}&am=${order.total}&cu=INR&tn=${encodeURIComponent(`Order ${order.number}`)}`;
}

export async function sendPaymentRequest(conversationId: string, orderId: string): Promise<void> {
  guard();
  await transaction(async () => {
    const order = await loadOrder(orderId);
    if (order.paymentStatus !== "PENDING") throw new DomainError(`Order #${order.number} is already paid`);
    const settings = await getSettings();
    const link = upiLink(order, settings.business.name);
    const due = order.paymentDueAt ? formatDateTime(order.paymentDueAt) : "";
    await addMessageInTx(conversationId, message("OUT", "PAYMENT_REQUEST", `Payment request for order #${order.number}: ${formatINR(order.total)}. Pay via UPI: ${link}`, { orderId, amount: order.total }));
    await notify("PAYMENT_REQUEST", { order, vars: { amount: formatINR(order.total), paymentLink: link, dueTime: due } });
  });
}

export async function markWhatsAppPaid(conversationId: string, orderId: string, method: PaymentMethod, reference: string): Promise<void> {
  const actor = guard();
  await transaction(async () => {
    const order = await loadOrder(orderId);
    await confirmPaymentInTx(order, { method, reference }, actor);
    await addMessageInTx(conversationId, message("OUT", "SYSTEM", `Payment of ${formatINR(order.total)} received for order #${order.number}. Thank you!`, { orderId }));
  });
}
