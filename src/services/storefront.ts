/**
 * Customer website. Reads the same designs, pieces, prices and photos as the admin, so a
 * piece sold at the counter disappears here immediately and price changes show up at once.
 */
import { repos, transaction } from "@/data";
import type { Address, Colour, Design, InventoryItem, Order, PaymentMethod, Review, Shipment } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { rankSimilar } from "@/domain/rules/catalog";
import { isAvailableNow, isHeldBy } from "@/domain/rules/inventory";
import { discountPercent, effectiveMrp, effectivePrice } from "@/domain/rules/pricing";
import { maskPhone, normalizePhone } from "@/domain/rules/customers";
import { newId } from "@/lib/id";
import { formatINR } from "@/lib/format";
import { getCatalog } from "./catalog";
import { DAY_MS, WEBSITE_ACTOR, now } from "./context";
import { changeItems } from "./inventory-core";
import { recomputeCustomerStatsInTx, upsertCustomerInTx } from "./customers";
import { notify } from "./notifications";
import { createOrderInTx } from "./orders";
import { getHeldLines, holdNextAvailable, releaseHolder, releaseItem } from "./reservations";
import { getSettings } from "./settings";
import { linkWishlistToCustomer } from "./wishlist";

export interface StoreColour {
  colour: Colour;
  available: number;
  imageIds: string[];
}

export interface StoreProduct {
  design: Design;
  fabricName: string;
  categoryName: string;
  collectionNames: string[];
  price: number;
  mrp: number;
  discount: number;
  available: number;
  colours: StoreColour[];
  imageId: string | null;
  hoverImageId: string | null;
  newestReceivedAt: number;
  unitsSold60d: number;
}

interface StoreData {
  products: StoreProduct[];
  bySlug: Map<string, StoreProduct>;
}

async function loadStoreData(): Promise<StoreData> {
  const r = repos();
  const t = now();
  const [designs, items, catalog, recentSales] = await Promise.all([
    r.designs.listPublished(),
    r.inventory.list(),
    getCatalog(),
    r.orderItems.listSince(t - 60 * DAY_MS),
  ]);
  const sold = new Map<string, number>();
  for (const s of recentSales) sold.set(s.designId, (sold.get(s.designId) ?? 0) + 1);
  const available = new Map<string, InventoryItem[]>();
  for (const i of items) {
    if (!isAvailableNow(i, t)) continue;
    const list = available.get(i.designId) ?? [];
    list.push(i);
    available.set(i.designId, list);
  }

  const products = designs.map((design) => {
    const pieces = (available.get(design.id) ?? []).sort((a, b) => a.receivedAt - b.receivedAt);
    const colours = new Map<string, StoreColour>();
    for (const p of pieces) {
      const colour = catalog.colourById.get(p.colourId);
      if (!colour) continue;
      const entry = colours.get(colour.id) ?? { colour, available: 0, imageIds: [] };
      entry.available++;
      for (const img of p.imageIds) if (!entry.imageIds.includes(img)) entry.imageIds.push(img);
      colours.set(colour.id, entry);
    }
    const prices = pieces.map((p) => effectivePrice(p, design));
    const price = prices.length ? Math.min(...prices) : design.price;
    const cheapest = pieces.find((p) => effectivePrice(p, design) === price);
    const mrp = cheapest ? effectiveMrp(cheapest, design) : design.mrp;
    const pieceImages = [...colours.values()].flatMap((c) => c.imageIds);
    const primary = design.imageIds[0] ?? pieceImages[0] ?? null;
    return {
      design,
      fabricName: catalog.fabricById.get(design.fabricId)?.name ?? "",
      categoryName: catalog.categoryById.get(design.categoryId)?.name ?? "",
      collectionNames: design.collectionIds.map((id) => catalog.collectionById.get(id)?.name ?? "").filter(Boolean),
      price,
      mrp,
      discount: discountPercent(mrp, price),
      available: pieces.length,
      colours: [...colours.values()].sort((a, b) => b.available - a.available),
      imageId: primary,
      hoverImageId: design.imageIds[1] ?? pieceImages.find((id) => id !== primary) ?? null,
      newestReceivedAt: pieces.length ? Math.max(...pieces.map((p) => p.receivedAt)) : design.createdAt,
      unitsSold60d: sold.get(design.id) ?? 0,
    } satisfies StoreProduct;
  });
  return { products, bySlug: new Map(products.map((p) => [p.design.slug, p])) };
}

export type StoreSort = "featured" | "newest" | "price-asc" | "price-desc" | "bestselling";

export interface StoreFilter {
  q?: string;
  fabricIds?: string[];
  collectionSlug?: string | null;
  colourIds?: string[];
  categoryId?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStockOnly?: boolean;
  sort?: StoreSort;
}

export async function listStoreProducts(filter: StoreFilter = {}): Promise<StoreProduct[]> {
  const [{ products }, catalog] = await Promise.all([loadStoreData(), getCatalog()]);
  const collection = filter.collectionSlug ? catalog.collections.find((c) => c.slug === filter.collectionSlug) : null;
  const q = filter.q?.trim().toLowerCase() ?? "";
  const rows = products.filter((p) => {
    if (filter.inStockOnly !== false && p.available === 0) return false;
    if (filter.fabricIds?.length && !filter.fabricIds.includes(p.design.fabricId)) return false;
    if (collection && !p.design.collectionIds.includes(collection.id)) return false;
    if (filter.categoryId && p.design.categoryId !== filter.categoryId) return false;
    if (filter.colourIds?.length && !p.colours.some((c) => filter.colourIds!.includes(c.colour.id))) return false;
    if (filter.minPrice != null && p.price < filter.minPrice) return false;
    if (filter.maxPrice != null && p.price > filter.maxPrice) return false;
    if (q && !`${p.design.name} ${p.fabricName} ${p.collectionNames.join(" ")} ${p.colours.map((c) => c.colour.name).join(" ")}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const sort = filter.sort ?? "featured";
  rows.sort((a, b) => {
    switch (sort) {
      case "newest": return b.newestReceivedAt - a.newestReceivedAt;
      case "price-asc": return a.price - b.price;
      case "price-desc": return b.price - a.price;
      case "bestselling": return b.unitsSold60d - a.unitsSold60d;
      default: return b.unitsSold60d * 2 + (b.newestReceivedAt > now() - 30 * DAY_MS ? 5 : 0) - (a.unitsSold60d * 2 + (a.newestReceivedAt > now() - 30 * DAY_MS ? 5 : 0));
    }
  });
  return rows;
}

export interface StoreHome {
  newArrivals: StoreProduct[];
  wedding: StoreProduct[];
  silk: StoreProduct[];
  bestSellers: StoreProduct[];
  recentlyAdded: StoreProduct[];
  reviews: Review[];
  collections: { name: string; slug: string; description: string; count: number; imageId: string | null }[];
}

export async function getStoreHome(): Promise<StoreHome> {
  const [{ products }, catalog, reviews] = await Promise.all([loadStoreData(), getCatalog(), repos().reviews.listRecent(12)]);
  const inStock = products.filter((p) => p.available > 0);
  const byCollection = (name: string) => {
    const c = catalog.collections.find((x) => x.name.toLowerCase() === name.toLowerCase());
    return c ? inStock.filter((p) => p.design.collectionIds.includes(c.id)) : [];
  };
  const silkFabricIds = new Set(catalog.fabrics.filter((f) => /silk|kanchipuram|banarasi/i.test(f.name)).map((f) => f.id));
  const newest = [...inStock].sort((a, b) => b.newestReceivedAt - a.newestReceivedAt);
  return {
    newArrivals: newest.slice(0, 8),
    wedding: byCollection("Wedding").sort((a, b) => b.unitsSold60d - a.unitsSold60d).slice(0, 8),
    silk: inStock.filter((p) => silkFabricIds.has(p.design.fabricId)).sort((a, b) => b.price - a.price).slice(0, 8),
    bestSellers: [...inStock].sort((a, b) => b.unitsSold60d - a.unitsSold60d).slice(0, 8),
    recentlyAdded: [...products].sort((a, b) => b.design.createdAt - a.design.createdAt).filter((p) => p.available > 0).slice(0, 4),
    reviews: reviews.filter((r) => r.rating >= 4).slice(0, 6),
    collections: catalog.collections.map((c) => {
      const members = inStock.filter((p) => p.design.collectionIds.includes(c.id));
      return { name: c.name, slug: c.slug, description: c.description, count: members.length, imageId: members.sort((a, b) => b.price - a.price)[0]?.imageId ?? null };
    }),
  };
}

export interface StoreProductDetail extends StoreProduct {
  fabricCare: string;
  similar: StoreProduct[];
  reviews: Review[];
  scarcityThreshold: number;
  /** Pieces currently held in someone's cart or on a counter/WhatsApp hold (not expired). */
  reservedCount: number;
}

export async function getStoreProduct(slug: string): Promise<StoreProductDetail | null> {
  const [{ products, bySlug }, catalog, settings] = await Promise.all([loadStoreData(), getCatalog(), getSettings()]);
  const product = bySlug.get(slug);
  if (!product) return null;
  const candidates = products.filter((p) => p.available > 0).map((p) => p.design);
  const similar = rankSimilar(product.design, candidates, 8).map((d) => bySlug.get(d.slug)!).filter(Boolean);
  const t = now();
  const pieces = await repos().inventory.listByDesign(product.design.id);
  const reservedCount = pieces.filter((i) => i.status === "RESERVED" && i.reservation?.kind !== "ORDER" && !isAvailableNow(i, t)).length;
  return {
    reservedCount,
    ...product,
    fabricCare: catalog.fabricById.get(product.design.fabricId)?.care ?? "",
    similar,
    reviews: await repos().reviews.listByDesign(product.design.id),
    scarcityThreshold: settings.store.scarcityThreshold,
  };
}

/** Saved designs for a shopper with live availability, newest saved first. */
export async function getShopperWishlist(ownerId: string): Promise<StoreProduct[]> {
  const [{ products }, entries] = await Promise.all([loadStoreData(), repos().wishlists.listByOwner(ownerId)]);
  const byDesign = new Map(products.map((p) => [p.design.id, p]));
  return entries
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((e) => byDesign.get(e.designId))
    .filter((p): p is StoreProduct => Boolean(p));
}

/* ------------------------------------------------------------------ */
/* Cart and checkout                                                   */
/* ------------------------------------------------------------------ */

export async function addToCart(shopperId: string, designId: string, colourId: string | null): Promise<InventoryItem> {
  const settings = await getSettings();
  return holdNextAvailable(designId, colourId, {
    holderId: shopperId,
    kind: "CART",
    channel: "WEBSITE",
    ttlMinutes: settings.store.cartReservationMinutes,
    actor: WEBSITE_ACTOR,
  });
}

export function removeFromCart(shopperId: string, itemId: string): Promise<void> {
  return releaseItem(itemId, shopperId, "Removed from website cart", WEBSITE_ACTOR);
}

export function clearCart(shopperId: string): Promise<void> {
  return releaseHolder(shopperId, "Website cart cleared", WEBSITE_ACTOR);
}

export async function getCart(shopperId: string) {
  const [lines, settings] = await Promise.all([getHeldLines(shopperId), getSettings()]);
  const subtotal = lines.reduce((s, l) => s + l.price, 0);
  const shippingFee = subtotal === 0 || subtotal >= settings.shipping.freeAbove ? 0 : settings.shipping.flatFee;
  return { lines, subtotal, shippingFee, total: subtotal + shippingFee, freeShippingAbove: settings.shipping.freeAbove };
}

export interface CheckoutInput {
  name: string;
  phone: string;
  email: string;
  address: Omit<Address, "id" | "label" | "name" | "phone">;
  paymentMethod: Extract<PaymentMethod, "UPI" | "CARD" | "NETBANKING">;
}

/** Simulated successful payment: creates the order and converts cart holds into order reservations. */
export async function placeWebsiteOrder(shopperId: string, input: CheckoutInput): Promise<Order> {
  if (!/^\d{6}$/.test(input.address.pincode.trim())) throw new DomainError("Enter a valid 6-digit pincode");
  return transaction(async () => {
    const r = repos();
    const t = now();
    const settings = await getSettings();
    const held = (await r.inventory.listByHolder(shopperId)).filter((i) => i.status === "RESERVED");
    const expired = held.filter((i) => !isHeldBy(i, shopperId, t));
    if (expired.length) throw new DomainError(`Your reservation for ${expired.map((i) => i.sku).join(", ")} expired. Please add it again.`);
    if (held.length === 0) throw new DomainError("Your cart is empty");

    const address: Omit<Address, "id"> = { label: "Home", name: input.name.trim(), phone: normalizePhone(input.phone), ...input.address };
    const customer = await upsertCustomerInTx({ name: input.name, phone: input.phone, email: input.email, address, source: "WEBSITE" });
    const designs = await r.designs.getMany([...new Set(held.map((i) => i.designId))]);
    const designById = new Map(designs.map((d) => [d.id, d]));
    const subtotal = held.reduce((s, i) => s + effectivePrice(i, designById.get(i.designId)!), 0);
    const shippingFee = subtotal >= settings.shipping.freeAbove ? 0 : settings.shipping.flatFee;
    const reference = `pay_${newId().slice(-12).toUpperCase()}`;

    const { order } = await createOrderInTx({
      channel: "WEBSITE",
      items: held,
      shippingFee,
      customer,
      customerSnapshot: { name: customer.name, phone: customer.phone, email: input.email.trim() || customer.email },
      shippingAddress: { ...address, id: newId("adr") },
      fulfilment: "SHIPPING",
      status: "RESERVED",
      paymentStatus: "PAID",
      payments: [{ method: input.paymentMethod, amount: subtotal + shippingFee, reference }],
      events: [
        { label: "Order placed on website", status: "NEW" },
        { label: "Payment confirmed", status: "CONFIRMED", note: `${input.paymentMethod} · ${reference}` },
        { label: "Items reserved", status: "RESERVED", note: `${held.length} piece${held.length === 1 ? "" : "s"} allocated` },
      ],
      actor: WEBSITE_ACTOR,
    });

    await changeItems(held, {
      type: "RESERVED",
      status: "RESERVED",
      reservation: { kind: "ORDER", holderId: order.id, channel: "WEBSITE", orderId: order.id, reservedAt: t, expiresAt: null },
      channel: "WEBSITE",
      refType: "ORDER",
      refId: order.id,
      refLabel: `#${order.number}`,
      note: "Cart converted to paid order",
    }, WEBSITE_ACTOR);
    await recomputeCustomerStatsInTx(customer.id);
    await linkWishlistToCustomer(shopperId, customer.id);
    await notify("ORDER_CONFIRMED", { order, customer });
    return order;
  });
}

/* ------------------------------------------------------------------ */
/* Tracking and reviews                                                */
/* ------------------------------------------------------------------ */

export interface TrackingView {
  order: Order;
  storeName: string;
  storePhone: string;
  lines: { designName: string; colourName: string; fabricName: string; imageId: string | null; unitPrice: number; lineTotal: number; designId: string; orderItemId: string; status: string }[];
  shipment: Shipment | undefined;
  maskedPhone: string;
  city: string;
  messages: { id: string; message: string; createdAt: number; event: string }[];
  reviewedDesignIds: string[];
  canRequestReturn: boolean;
  returnWindowDays: number;
  openReturn: { number: string; status: string } | null;
}

export async function getTrackingView(orderId: string): Promise<TrackingView | null> {
  const r = repos();
  const order = await r.orders.get(orderId);
  if (!order) return null;
  const [items, shipment, notifications, reviews, returns, settings] = await Promise.all([
    r.orderItems.listByOrder(order.id),
    r.shipments.findByOrder(order.id),
    r.notifications.listByOrder(order.id),
    r.reviews.findByOrder(order.id),
    r.returns.listByOrder(order.id),
    getSettings(),
  ]);
  const deliveredAt = shipment?.deliveredAt ?? (order.status === "DELIVERED" ? order.updatedAt : null);
  const open = returns.find((x) => !["REJECTED", "REFUNDED", "EXCHANGED"].includes(x.status));
  return {
    order,
    storeName: settings.business.name,
    storePhone: settings.business.whatsapp,
    lines: items.map((i) => ({
      designName: i.designName,
      colourName: i.colourName,
      fabricName: i.fabricName,
      imageId: i.imageId,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      designId: i.designId,
      orderItemId: i.id,
      status: i.status,
    })),
    shipment,
    maskedPhone: maskPhone(order.customer.phone),
    city: order.shippingAddress ? `${order.shippingAddress.city}, ${order.shippingAddress.state}` : "",
    messages: notifications.map((n) => ({ id: n.id, message: n.message, createdAt: n.createdAt, event: n.event })).reverse(),
    reviewedDesignIds: reviews.map((x) => x.designId),
    canRequestReturn:
      order.status === "DELIVERED" &&
      order.channel !== "SHOP" &&
      !open &&
      deliveredAt !== null &&
      now() - deliveredAt <= settings.store.returnWindowDays * DAY_MS,
    returnWindowDays: settings.store.returnWindowDays,
    openReturn: open ? { number: open.number, status: open.status } : null,
  };
}

export async function submitReview(orderId: string, designId: string, rating: number, body: string): Promise<void> {
  if (rating < 1 || rating > 5) throw new DomainError("Choose a rating from 1 to 5");
  await transaction(async () => {
    const r = repos();
    const order = await r.orders.get(orderId);
    if (!order) throw new DomainError("Order not found");
    if (order.status !== "DELIVERED" && order.status !== "RETURN_REQUESTED") throw new DomainError("You can review once your order is delivered");
    const existing = await r.reviews.findByOrder(orderId);
    if (existing.some((x) => x.designId === designId)) throw new DomainError("You have already reviewed this saree");
    await r.reviews.add({
      id: newId("rev"),
      orderId,
      designId,
      customerName: order.customer.name.split(" ")[0] + (order.customer.name.includes(" ") ? ` ${order.customer.name.split(" ").pop()![0]}.` : ""),
      city: order.shippingAddress?.city ?? "",
      rating,
      body: body.trim(),
      createdAt: now(),
    });
  });
}

export async function findOrderForTracking(orderNumber: string, phone: string): Promise<string | null> {
  const n = Number(orderNumber.replace(/[^\d]/g, ""));
  if (!Number.isInteger(n) || n <= 0) return null;
  const order = await repos().orders.findByNumber(n);
  if (!order || normalizePhone(order.customer.phone) !== normalizePhone(phone)) return null;
  return order.id;
}

export function formatShareMessage(input: { name: string; price: number; description: string; available: number; url: string }): string {
  const availability = input.available === 0 ? "Currently sold out" : input.available === 1 ? "Available: 1 piece" : `Available: ${input.available} pieces`;
  return [`*${input.name}*`, formatINR(input.price), input.description, availability, `View product: ${input.url}`].join("\n");
}
