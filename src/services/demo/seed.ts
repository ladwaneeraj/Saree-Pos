/**
 * Deterministic demo dataset. Dates are relative to the moment of seeding, so the dashboard
 * always has a "today". Every number shown in the app is derived from these records.
 */
import type {
  Address,
  AuditLog,
  Category,
  Collection,
  Colour,
  Customer,
  Design,
  Fabric,
  InventoryItem,
  InventoryMovement,
  Media,
  MovementType,
  Notification,
  NotificationEvent,
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentMethod,
  Purchase,
  PurchaseItem,
  ReturnRequest,
  Review,
  SalesChannel,
  Shipment,
  ShipmentEvent,
  Supplier,
  WaConversation,
  WaMessage,
  WishlistEntry,
} from "@/domain/types";
import { slugify } from "@/domain/rules/catalog";
import { formatSku } from "@/domain/rules/inventory";
import { splitInclusiveTax } from "@/domain/rules/pricing";
import { formatINR } from "@/lib/format";
import { describeDesign } from "../catalog";
import { DEFAULT_SETTINGS } from "../settings-defaults";
import { renderTemplate } from "../notifications";
import { PHOTOS, photoCredit, unsplashUrl } from "./stock-photos";
import {
  CATEGORIES,
  CITIES,
  COLLECTIONS,
  COLOURS,
  DESIGNS,
  FABRICS,
  FIRST_NAMES_F,
  REVIEW_TEXTS,
  STREETS,
  SUPPLIERS,
  SURNAMES,
  WHATSAPP_SCRIPTS,
  type DesignSeed,
} from "./seed-data";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const TARGET_PIECES = 10_800;

/* ------------------------------------------------------------------ */
/* Deterministic randomness                                            */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private next: () => number;
  private counter = 0;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float() {
    return this.next();
  }
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)]!;
  }
  chance(p: number) {
    return this.next() < p;
  }
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const total = items.reduce((s, i) => s + weight(i), 0);
    let r = this.next() * total;
    for (const i of items) {
      r -= weight(i);
      if (r <= 0) return i;
    }
    return items[items.length - 1]!;
  }
  id(prefix: string) {
    this.counter++;
    return `${prefix}_seed${this.counter.toString(36)}${Math.floor(this.next() * 1e9).toString(36)}`;
  }
  digits(n: number) {
    let s = String(this.int(1, 9));
    while (s.length < n) s += String(this.int(0, 9));
    return s;
  }
}

const roundTo = (n: number, step: number) => Math.round(n / step) * step;
const priceEnding = (n: number) => Math.max(99, Math.round(n / 100) * 100 - 1);

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */

export interface SeedTables {
  categories: Category[];
  collections: Collection[];
  colours: Colour[];
  fabrics: Fabric[];
  suppliers: Supplier[];
  media: Media[];
  designs: Design[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  purchases: Purchase[];
  purchaseItems: PurchaseItem[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: Payment[];
  shipments: Shipment[];
  returns: ReturnRequest[];
  reviews: Review[];
  wishlists: WishlistEntry[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  waConversations: WaConversation[];
  waMessages: WaMessage[];
  counters: { key: string; value: number }[];
}

/* ------------------------------------------------------------------ */
/* Generator                                                           */
/* ------------------------------------------------------------------ */

export function generateDemoData(now: number, origin: string): SeedTables {
  const rng = new Rng(20260922);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const actorNames = DEFAULT_SETTINGS.users.map((u) => u.name);
  const [ownerName, managerName, billingName, packingName] = actorNames as [string, string, string, string];

  /* Masters ---------------------------------------------------------- */
  const categories: Category[] = CATEGORIES.map((c, i) => ({ id: `cat_${c.key}`, name: c.name, slug: slugify(c.name), sortOrder: i }));
  const categoryId = (key: string) => `cat_${key}`;
  const collections: Collection[] = COLLECTIONS.map((c, i) => ({ id: `clc_${c.key}`, name: c.name, slug: slugify(c.name), description: c.description, sortOrder: i }));
  const collectionId = (key: string) => `clc_${key}`;
  const colours: Colour[] = COLOURS.map(([name, hex]) => ({ id: `col_${slugify(name)}`, name, hex }));
  const colourByName = new Map(colours.map((c) => [c.name, c]));
  const fabrics: Fabric[] = FABRICS.map((f) => ({ id: `fab_${slugify(f.name)}`, name: f.name, description: f.description, care: f.care, categoryId: categoryId(f.category) }));
  const fabricByName = new Map(fabrics.map((f) => [f.name, f]));
  const suppliers: Supplier[] = SUPPLIERS.map((s, i) => ({
    id: `sup_${i + 1}`,
    name: s.name,
    code: s.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3),
    contactName: s.contactName,
    phone: `9${rng.digits(9)}`,
    email: `orders@${slugify(s.name).replace(/-/g, "")}.in`,
    city: s.city,
    gstin: `${["33", "09", "29", "24", "23", "36", "29", "19", "37", "10"][i]}AAB${String.fromCharCode(65 + i)}${rng.digits(4)}${String.fromCharCode(70 + i)}1Z${rng.int(1, 9)}`,
    createdAt: now - 500 * DAY,
  }));

  /* Designs and artwork --------------------------------------------- */
  const media: Media[] = [];
  const art = new Map<string, string[]>(); // `${designId}|${colourId}` -> media ids
  const designs: Design[] = [];
  const seedByDesign = new Map<string, DesignSeed>();
  const priceChangedDesigns = new Map<string, { oldPrice: number; changedAt: number }>();

  DESIGNS.forEach((seed, i) => {
    const id = `dsn_${slugify(seed.name)}`;
    const fabric = fabricByName.get(seed.fabric)!;
    const isNew = seed.collections.includes("new");
    const createdAt = isNew ? now - rng.int(6, 24) * DAY : now - rng.int(200, 420) * DAY;
    const mrp = priceEnding(seed.price * (1.28 + rng.float() * 0.18));
    const blouse = !["Bengal Tant Cotton", "Semi Silk Daily Wear", "Kota Doria Printed"].includes(seed.name);
    const base = { pattern: seed.pattern, border: seed.border, lengthM: blouse ? 6.3 : 5.5, blouseIncluded: blouse };
    const imageIds: string[] = [];
    seed.looks.forEach((look, li) => {
      const colour = colourByName.get(look.colour)!;
      const ids = look.photos.map((key) => {
        const mediaId = `med_${key}`;
        if (!media.some((m) => m.id === mediaId)) {
          const photo = PHOTOS[key];
          media.push({
            id: mediaId,
            kind: "STOCK",
            mime: "image/jpeg",
            url: unsplashUrl(photo, { w: 1200, h: 1500 }),
            thumbUrl: unsplashUrl(photo, { w: 400, h: 500, q: 65 }),
            width: 1200,
            height: 1500,
            credit: photoCredit(photo),
            createdAt,
          });
        }
        return mediaId;
      });
      art.set(`${id}|${colour.id}`, ids);
      if (li === 0) imageIds.push(...ids);
    });
    const design: Design = {
      id,
      code: `DSN-${String(i + 1).padStart(4, "0")}`,
      name: seed.name,
      slug: slugify(seed.name),
      categoryId: categoryId(seed.category),
      fabricId: fabric.id,
      collectionIds: seed.collections.map(collectionId),
      ...base,
      description: seed.note ? `${seed.note} ${describeDesign(base, fabric.name).split(". ").slice(1).join(". ")}` : describeDesign(base, fabric.name),
      mrp,
      price: seed.price,
      imageIds,
      isPublished: !["Gharchola Bandhej Silk"].includes(seed.name),
      createdAt,
      updatedAt: createdAt,
    };
    designs.push(design);
    seedByDesign.set(id, seed);
    if (i % 9 === 3) {
      const oldPrice = priceEnding(seed.price * 0.93);
      priceChangedDesigns.set(id, { oldPrice, changedAt: now - rng.int(12, 26) * DAY });
    }
  });

  /* Purchases and pieces -------------------------------------------- */
  const stockWeight = DESIGNS.reduce((s, d) => s + d.stock, 0);
  const racks = new Map<string, string>();
  const sectionFor = (seed: DesignSeed) =>
    seed.category === "bridal" ? "A" : seed.fabric === "Kanchipuram" ? "B" : seed.fabric === "Banarasi" ? "C" : seed.fabric === "Chanderi" || seed.fabric === "Linen" ? "D" : seed.fabric === "Cotton" ? "E" : seed.fabric === "Organza" || seed.fabric === "Georgette" ? "F" : "G";
  designs.forEach((d, i) => racks.set(d.id, `${sectionFor(seedByDesign.get(d.id)!)}-${String((i % 18) + 1).padStart(2, "0")}`));

  const ageDays = () => {
    const r = rng.float();
    if (r < 0.34) return rng.int(1, 30);
    if (r < 0.62) return rng.int(31, 90);
    if (r < 0.84) return rng.int(91, 180);
    return rng.int(181, 400);
  };

  interface Lot { design: Design; seed: DesignSeed; qty: number; age: number }
  const lots: Lot[] = [];
  for (const design of designs) {
    const seed = seedByDesign.get(design.id)!;
    let remaining = Math.round((seed.stock / stockWeight) * TARGET_PIECES);
    const lotSize = seed.price > 15000 ? [3, 8] : seed.price > 6000 ? [6, 18] : [18, 45];
    const isNew = seed.collections.includes("new");
    while (remaining > 0) {
      const qty = Math.min(remaining, rng.int(lotSize[0]!, lotSize[1]!));
      const age = isNew ? rng.int(2, Math.max(3, Math.floor((now - design.createdAt) / DAY))) : Math.min(ageDays(), Math.floor((now - design.createdAt) / DAY));
      lots.push({ design, seed, qty, age });
      remaining -= qty;
    }
  }

  const supplierFor = (seed: DesignSeed) => {
    const options = suppliers.filter((_, i) => SUPPLIERS[i]!.fabrics.includes(seed.fabric));
    return options.length ? options[seed.name.length % options.length]! : suppliers[0]!;
  };

  const purchases: Purchase[] = [];
  const purchaseItems: PurchaseItem[] = [];
  const pieces: InventoryItem[] = [];
  const purchaseKey = new Map<string, Purchase>();
  for (const lot of lots.sort((a, b) => b.age - a.age)) {
    const supplier = supplierFor(lot.seed);
    const bucket = lot.age <= 90 ? Math.floor(lot.age / 7) : 100 + Math.floor(lot.age / 30);
    const key = `${supplier.id}|${bucket}`;
    const date = todayStart - lot.age * DAY + 11 * HOUR;
    let purchase = purchaseKey.get(key);
    if (!purchase) {
      purchase = {
        id: rng.id("pur"),
        number: "",
        supplierId: supplier.id,
        invoiceNumber: `${supplier.name.split(" ").map((w) => w[0]).join("").toUpperCase()}/${new Date(date).getFullYear()}/${rng.int(100, 999)}`,
        date,
        status: "RECEIVED",
        pieceCount: 0,
        totalCost: 0,
        gstRate: 5,
        gstAmount: 0,
        grandTotal: 0,
        amountPaid: 0,
        paymentStatus: "PAID",
        dueDate: null,
        notes: "",
        receivedAt: date + 2 * HOUR,
        createdAt: date,
        updatedAt: date + 2 * HOUR,
      };
      purchaseKey.set(key, purchase);
      purchases.push(purchase);
    }
    const colourIds = lot.seed.looks.map((l) => colourByName.get(l.colour)!.id);
    const perColour = new Map<string, number>();
    for (let n = 0; n < lot.qty; n++) {
      const cid = rng.weighted(colourIds, (c) => colourIds.length - colourIds.indexOf(c) + 1);
      perColour.set(cid, (perColour.get(cid) ?? 0) + 1);
    }
    for (const [cid, qty] of perColour) {
      const cost = roundTo(lot.design.price * (0.52 + rng.float() * 0.08), 10);
      purchaseItems.push({
        id: rng.id("pli"),
        purchaseId: purchase.id,
        designId: lot.design.id,
        colourId: cid,
        quantity: qty,
        cost,
        mrp: lot.design.mrp,
        price: lot.design.price,
        location: racks.get(lot.design.id)!,
        createdAt: purchase.createdAt,
      });
      purchase.pieceCount += qty;
      purchase.totalCost += qty * cost;
      purchase.gstAmount = Math.round(purchase.totalCost * purchase.gstRate / 100);
      purchase.grandTotal = purchase.totalCost + purchase.gstAmount;
      purchase.amountPaid = purchase.grandTotal;
      for (let n = 0; n < qty; n++) {
        pieces.push({
          id: rng.id("itm"),
          sku: "",
          designId: lot.design.id,
          colourId: cid,
          cost,
          mrpOverride: null,
          priceOverride: rng.chance(0.015) ? priceEnding(lot.design.price * (rng.chance(0.5) ? 0.92 : 1.06)) : null,
          location: rng.chance(0.12) ? `H-${String(rng.int(1, 12)).padStart(2, "0")}` : racks.get(lot.design.id)!,
          status: "AVAILABLE",
          imageIds: art.get(`${lot.design.id}|${cid}`) ?? [],
          purchaseId: purchase.id,
          supplierId: supplier.id,
          receivedAt: purchase.receivedAt!,
          reservation: null,
          holderId: null,
          soldAt: null,
          soldOrderId: null,
          notes: "",
          createdAt: purchase.receivedAt!,
          updatedAt: purchase.receivedAt!,
        });
      }
    }
  }
  purchases.sort((a, b) => a.date - b.date).forEach((p, i) => (p.number = `PO-${new Date(p.date).getFullYear()}-${String(i + 1).padStart(4, "0")}`));
  pieces.sort((a, b) => a.receivedAt - b.receivedAt || a.designId.localeCompare(b.designId));
  pieces.forEach((p, i) => {
    p.sku = formatSku(101 + i);
    if (p.priceOverride !== null) {
      const design = designs.find((d) => d.id === p.designId)!;
      if (p.priceOverride > design.mrp || p.priceOverride === design.price) p.priceOverride = null;
    }
  });
  const nextSku = 101 + pieces.length;

  const movements: InventoryMovement[] = [];
  const move = (item: InventoryItem, type: MovementType, at: number, extra: Partial<InventoryMovement> = {}) => {
    movements.push({
      id: rng.id("mov"),
      itemId: item.id,
      sku: item.sku,
      type,
      quantityDelta: type === "PURCHASED" || type === "RETURN_RECEIVED" ? 1 : type === "SOLD" ? -1 : 0,
      fromStatus: null,
      toStatus: null,
      location: item.location,
      channel: null,
      refType: null,
      refId: null,
      refLabel: null,
      note: "",
      actorName: managerName,
      createdAt: at,
      ...extra,
    });
  };
  const purchaseById = new Map(purchases.map((p) => [p.id, p]));
  for (const p of pieces) {
    const purchase = purchaseById.get(p.purchaseId!)!;
    move(p, "PURCHASED", purchase.date, { toStatus: "AVAILABLE", refType: "PURCHASE", refId: purchase.id, refLabel: purchase.number });
    // Older stock keeps one movement to keep the seed light; recent receipts show the full trail.
    if (now - purchase.receivedAt! < 60 * DAY) move(p, "RECEIVED", purchase.receivedAt!, { fromStatus: "AVAILABLE", toStatus: "AVAILABLE", note: `Shelved at ${p.location}` });
  }

  /* Customers --------------------------------------------------------- */
  const customers: Customer[] = [];
  const usedNames = new Set<string>();
  const usedPhones = new Set<string>();
  const makeCustomer = (name: string, createdAt: number): Customer => {
    let phone = "";
    do phone = `${rng.pick(["9", "8", "7", "6"])}${rng.digits(9)}`;
    while (usedPhones.has(phone));
    usedPhones.add(phone);
    const city = rng.weighted(CITIES, (c) => c.weight);
    const [first, last] = [name.split(" ")[0]!, name.split(" ").slice(1).join(" ")];
    const address: Address = {
      id: rng.id("adr"),
      label: "Home",
      name,
      phone,
      line1: `#${rng.int(12, 980)}, ${rng.pick(STREETS)}`,
      line2: rng.pick(city.areas),
      city: city.city,
      state: city.state,
      pincode: rng.pick(city.pins),
    };
    return {
      id: rng.id("cus"),
      name,
      phone,
      email: rng.chance(0.65) ? `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}${rng.chance(0.4) ? rng.int(1, 99) : ""}@gmail.com` : "",
      addresses: [address],
      notes: "",
      source: "SHOP",
      stats: { orderCount: 0, totalSpend: 0, firstOrderAt: null, lastOrderAt: null },
      createdAt,
      updatedAt: createdAt,
    };
  };
  while (customers.length < 240) {
    const name = `${rng.pick(FIRST_NAMES_F)} ${rng.pick(SURNAMES)}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    customers.push(makeCustomer(name, now - rng.int(95, 700) * DAY));
  }
  const customerNotes = ["Prefers pure silk with contrast borders", "Buys for family functions, likes pastel shades", "Regular for cotton daily wear", "Ask for blouse stitching referral", "Prefers WhatsApp updates in Kannada"];
  customers.slice(0, 5).forEach((c, i) => (c.notes = customerNotes[i]!));
  const loyal = customers.slice(0, 60);

  /* Orders ------------------------------------------------------------ */
  const orders: Order[] = [];
  const orderItems: OrderItem[] = [];
  const payments: Payment[] = [];
  const shipments: Shipment[] = [];
  const notifications: Notification[] = [];
  const designById = new Map(designs.map((d) => [d.id, d]));
  const colourById = new Map(colours.map((c) => [c.id, c]));
  const fabricById = new Map(fabrics.map((f) => [f.id, f]));
  const piecesByDesign = new Map<string, InventoryItem[]>();
  for (const p of pieces) {
    const list = piecesByDesign.get(p.designId) ?? [];
    list.push(p);
    piecesByDesign.set(p.designId, list);
  }
  const sellable = (designId: string, at: number) => (piecesByDesign.get(designId) ?? []).filter((p) => p.status === "AVAILABLE" && p.receivedAt < at - HOUR);

  const priceAt = (item: InventoryItem, design: Design, at: number) => {
    const change = priceChangedDesigns.get(design.id);
    if (item.priceOverride !== null) return item.priceOverride;
    return change && at < change.changedAt ? change.oldPrice : design.price;
  };

  const taxRate = DEFAULT_SETTINGS.tax.gstRate;
  const templates = DEFAULT_SETTINGS.notifications.templates;
  const storeName = DEFAULT_SETTINGS.business.name;
  const trackingLink = (id: string) => `${origin}/track?id=${id}`;

  const pushNotification = (event: NotificationEvent, order: Order, at: number, vars: Record<string, string> = {}) => {
    const message = renderTemplate(templates[event], {
      name: order.customer.name.split(" ")[0]!,
      store: storeName,
      order: `#${order.number}`,
      total: formatINR(order.total),
      amount: formatINR(order.total),
      trackingLink: trackingLink(order.id),
      reviewLink: `${trackingLink(order.id)}#review`,
      ...vars,
    });
    notifications.push({
      id: rng.id("ntf"),
      event,
      channel: "WHATSAPP",
      recipient: order.customer.phone,
      recipientName: order.customer.name,
      message,
      ctaLabel: event === "ORDER_DISPATCHED" ? "Track shipment" : event === "REVIEW_REQUEST" ? "Rate your saree" : event === "ORDER_CONFIRMED" ? "Track order" : null,
      ctaUrl: ["ORDER_DISPATCHED", "ORDER_CONFIRMED", "ORDER_DELIVERED"].includes(event) ? trackingLink(order.id) : event === "REVIEW_REQUEST" ? `${trackingLink(order.id)}#review` : null,
      customerId: order.customerId,
      ownerId: null,
      orderId: order.id,
      designId: null,
      status: "SIMULATED",
      createdAt: at,
    });
  };

  const event = (label: string, status: OrderStatus | null, at: number, actorName: string, note = ""): OrderEvent => ({ id: rng.id("evt"), label, status, note, actorName, at });

  const couriers = [
    { name: "DTDC", w: 45, awb: () => `D${rng.digits(9)}` },
    { name: "Delhivery", w: 25, awb: () => rng.digits(14) },
    { name: "Blue Dart", w: 15, awb: () => rng.digits(11) },
    { name: "India Post", w: 10, awb: () => `EK${rng.digits(9)}IN` },
    { name: "Xpressbees", w: 5, awb: () => `XB${rng.digits(12)}` },
  ];

  interface Draft {
    channel: SalesChannel;
    at: number;
    customer: Customer | null;
    items: InventoryItem[];
    fulfilment: "IN_STORE" | "SHIPPING";
    forced?: { designName: string; colourName: string };
  }

  const pickItems = (count: number, at: number, channel: SalesChannel): InventoryItem[] => {
    const chosen: InventoryItem[] = [];
    let attempts = 0;
    while (chosen.length < count && attempts < 25) {
      attempts++;
      const design = rng.weighted(designs, (d) => {
        const seed = seedByDesign.get(d.id)!;
        const onlineBoost = channel !== "SHOP" && seed.price > 5000 ? 1.4 : 1;
        return seed.pop * onlineBoost * (d.createdAt < at ? 1 : 0);
      });
      const options = sellable(design.id, at).filter((p) => !chosen.includes(p));
      if (options.length === 0) continue;
      chosen.push(options[Math.min(options.length - 1, rng.int(0, 6))]!);
    }
    return chosen;
  };

  // Build the order drafts: 90 days of history plus today.
  const drafts: Draft[] = [];
  for (let daysAgo = 89; daysAgo >= 1; daysAgo--) {
    const day = todayStart - daysAgo * DAY;
    const weekday = new Date(day).getDay();
    const base = weekday === 0 || weekday === 6 ? 22 : 15;
    const trend = 1 + (89 - daysAgo) / 180;
    const count = Math.round(base * trend * (0.8 + rng.float() * 0.4));
    for (let n = 0; n < count; n++) {
      const at = day + 10 * HOUR + rng.int(0, 630) * 60_000;
      const channel = rng.weighted<SalesChannel>(["SHOP", "WEBSITE", "WHATSAPP"], (c) => (c === "SHOP" ? 58 : c === "WEBSITE" ? 27 : 15));
      drafts.push({ channel, at, customer: null, items: [], fulfilment: channel === "SHOP" ? "IN_STORE" : channel === "WHATSAPP" && rng.chance(0.2) ? "IN_STORE" : "SHIPPING" });
    }
  }
  const openAt = todayStart + 10 * HOUR;
  const todayFrom = now - openAt > 2 * HOUR ? openAt : Math.max(todayStart + 30 * 60_000, now - 6 * HOUR);
  const todayMix: SalesChannel[] = [...Array(14).fill("SHOP"), ...Array(16).fill("WEBSITE"), ...Array(6).fill("WHATSAPP")];
  for (const channel of todayMix) {
    const at = todayFrom + Math.floor(rng.float() * Math.max(10 * 60_000, now - 20 * 60_000 - todayFrom));
    drafts.push({ channel, at, customer: null, items: [], fulfilment: channel === "SHOP" ? "IN_STORE" : "SHIPPING" });
  }
  // Scripted WhatsApp orders tied to conversations.
  drafts.push({ channel: "WHATSAPP", at: now - 95 * 60_000, customer: null, items: [], fulfilment: "SHIPPING", forced: { designName: "Kanchipuram Temple Border Silk", colourName: "Purple" } });
  drafts.push({ channel: "WHATSAPP", at: now - 3 * HOUR, customer: null, items: [], fulfilment: "SHIPPING", forced: { designName: "Chanderi Silk Cotton Butta", colourName: "Mint Green" } });
  drafts.sort((a, b) => a.at - b.at);

  const scriptedCustomers = new Map<string, Customer>();
  for (const script of WHATSAPP_SCRIPTS) {
    const existing = customers.find((c) => c.name === script.name);
    const customer = existing ?? makeCustomer(script.name, now - rng.int(60, 300) * DAY);
    customer.source = "WHATSAPP";
    if (!existing) customers.push(customer);
    scriptedCustomers.set(script.name, customer);
  }

  // Assign customers and items.
  for (const draft of drafts) {
    if (draft.forced) {
      const design = designs.find((d) => d.name === draft.forced!.designName)!;
      const colour = colourByName.get(draft.forced.colourName)!;
      const piece = sellable(design.id, draft.at).find((p) => p.colourId === colour.id) ?? sellable(design.id, draft.at)[0];
      draft.items = piece ? [piece] : [];
      draft.customer = scriptedCustomers.get(draft.forced.designName === "Kanchipuram Temple Border Silk" ? "Lakshmi Prasad" : "Ananya Rao")!;
    } else {
      const count = rng.weighted([1, 2, 3], (n) => (n === 1 ? 72 : n === 2 ? 22 : 6));
      draft.items = pickItems(count, draft.at, draft.channel);
      if (draft.channel !== "SHOP" || rng.chance(0.55)) draft.customer = rng.chance(0.35) ? rng.pick(loyal) : rng.pick(customers);
    }
    // Reserve immediately so later drafts cannot pick the same piece.
    for (const p of draft.items) p.status = "SOLD";
  }

  // Today's pipeline: two unpaid WhatsApp orders, and the latest paid online orders still to be packed
  // (eight here plus the scripted paid WhatsApp order = nine pending dispatch).
  const paymentPendingSet = new Set(drafts.filter((d) => d.channel === "WHATSAPP" && d.at >= todayStart && !d.forced).slice(-2));
  const onlinePaidToday = drafts.filter((d) => d.channel !== "SHOP" && d.at >= todayStart && !d.forced && d.fulfilment === "SHIPPING" && !paymentPendingSet.has(d));
  const pendingSet = new Set(onlinePaidToday.slice(-8));

  let orderNumber = 10001;
  const returns: ReturnRequest[] = [];
  const reviews: Review[] = [];
  let returnSeq = 1;

  for (const draft of drafts) {
    if (draft.items.length === 0) continue;
    const id = rng.id("ord");
    const number = orderNumber++;
    const at = draft.at;
    const ageH = (now - at) / HOUR;
    const customer = draft.customer;
    const snapshot = { name: customer?.name ?? "Walk-in customer", phone: customer?.phone ?? "", email: customer?.email ?? "" };
    const staff = draft.channel === "SHOP" ? billingName : draft.channel === "WHATSAPP" ? billingName : "Website";
    const lines: OrderItem[] = draft.items.map((item) => {
      const design = designById.get(item.designId)!;
      const unitPrice = priceAt(item, design, at);
      return {
        id: rng.id("oit"),
        orderId: id,
        inventoryItemId: item.id,
        sku: item.sku,
        designId: design.id,
        designName: design.name,
        colourName: colourById.get(item.colourId)!.name,
        fabricName: fabricById.get(design.fabricId)!.name,
        imageId: item.imageIds[0] ?? design.imageIds[0] ?? null,
        mrp: design.mrp,
        unitPrice,
        discount: 0,
        lineTotal: unitPrice,
        cost: item.cost,
        status: "ACTIVE",
        createdAt: at,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    const discount = draft.channel === "SHOP" && rng.chance(0.25) ? (subtotal > 5000 ? roundTo(subtotal * 0.05, 50) : rng.pick([50, 100, 200])) : 0;
    const shippingFee = draft.fulfilment === "SHIPPING" && subtotal < 2999 ? 99 : 0;
    const total = subtotal - discount + shippingFee;

    // Decide lifecycle.
    let status: OrderStatus;
    let paid = true;
    let cancelled = false;
    if (draft.channel === "SHOP") status = "DELIVERED";
    else if (draft.forced?.designName === "Kanchipuram Temple Border Silk" || paymentPendingSet.has(draft)) {
      status = "PAYMENT_PENDING";
      paid = false;
    } else if (draft.forced) status = "RESERVED";
    else if (ageH > 30 && rng.chance(0.03)) {
      status = "CANCELLED";
      cancelled = true;
      paid = draft.channel === "WEBSITE";
    } else if (draft.fulfilment === "IN_STORE") status = ageH < 20 ? "RESERVED" : "DELIVERED";
    else if (pendingSet.has(draft)) status = rng.weighted<OrderStatus>(["RESERVED", "PACKING", "READY_TO_DISPATCH"], (s) => (s === "RESERVED" ? 4 : s === "PACKING" ? 3 : 2));
    else if (ageH < 30) status = "DISPATCHED";
    else if (ageH < 80) status = "IN_TRANSIT";
    else status = "DELIVERED";

    const timeline: OrderEvent[] = [];
    const channelLabel = draft.channel === "SHOP" ? "Order placed at counter" : draft.channel === "WEBSITE" ? "Order placed on website" : "Order created from WhatsApp chat";
    timeline.push(event(channelLabel, draft.channel === "SHOP" ? "CONFIRMED" : "NEW", at, staff));

    // Payments.
    const methodPool: PaymentMethod[] = draft.channel === "SHOP" ? ["CASH", "UPI", "CARD"] : draft.channel === "WEBSITE" ? ["UPI", "CARD", "NETBANKING"] : ["UPI", "NETBANKING"];
    const methodWeights: Record<string, number> = draft.channel === "SHOP" ? { CASH: 32, UPI: 48, CARD: 20 } : draft.channel === "WEBSITE" ? { UPI: 60, CARD: 30, NETBANKING: 10 } : { UPI: 90, NETBANKING: 10 };
    const payAt = draft.channel === "WHATSAPP" ? at + rng.int(10, 90) * 60_000 : at + 60_000;
    if (paid) {
      if (draft.channel === "SHOP" && total > 3000 && rng.chance(0.08)) {
        const cash = roundTo(total * 0.3, 100);
        payments.push({ id: rng.id("pay"), orderId: id, kind: "PAYMENT", method: "CASH", amount: cash, reference: "", createdAt: payAt });
        payments.push({ id: rng.id("pay"), orderId: id, kind: "PAYMENT", method: "UPI", amount: total - cash, reference: `UPI${rng.digits(12)}`, createdAt: payAt });
        timeline.push(event("Payment received", null, payAt, staff, "CASH + UPI"));
      } else {
        const method = rng.weighted(methodPool, (m) => methodWeights[m] ?? 1);
        payments.push({ id: rng.id("pay"), orderId: id, kind: "PAYMENT", method, amount: total, reference: method === "CASH" ? "" : `${method === "UPI" ? "UPI" : "pay_"}${rng.digits(12)}`, createdAt: payAt });
        timeline.push(event(draft.channel === "SHOP" ? "Payment received" : "Payment confirmed", draft.channel === "SHOP" ? null : "CONFIRMED", payAt, staff, method));
      }
    } else if (!cancelled) {
      timeline.push(event("Awaiting payment", "PAYMENT_PENDING", at + 60_000, staff));
    }

    const order: Order = {
      id,
      number,
      channel: draft.channel,
      status,
      paymentStatus: paid ? "PAID" : "PENDING",
      amountPaid: paid ? total : 0,
      fulfilment: draft.fulfilment,
      customerId: customer?.id ?? null,
      customer: snapshot,
      shippingAddress: draft.fulfilment === "SHIPPING" && customer ? { ...customer.addresses[0]! } : null,
      itemCount: lines.length,
      subtotal,
      discount,
      shippingFee,
      total,
      taxRate,
      taxAmount: splitInclusiveTax(total - shippingFee, taxRate).tax,
      notes: "",
      paymentDueAt: status === "PAYMENT_PENDING" ? at + 24 * HOUR : null,
      timeline,
      exchangeOfOrderId: null,
      createdBy: staff,
      createdAt: at,
      updatedAt: at,
    };

    // Inventory and fulfilment side effects.
    const channelRef = { channel: draft.channel, refType: "ORDER" as const, refId: id, refLabel: `#${number}` };
    if (draft.channel === "SHOP") {
      timeline.push(event("Handed over to customer", "DELIVERED", at + 2 * 60_000, staff));
      for (const item of draft.items) {
        item.status = "SOLD";
        item.soldAt = at;
        item.soldOrderId = id;
        item.updatedAt = at;
        move(item, "SOLD", at, { ...channelRef, fromStatus: "AVAILABLE", toStatus: "SOLD", note: "Sold at counter", actorName: billingName });
      }
    } else {
      const reservedAt = paid ? payAt : at;
      if (rng.chance(0.12)) {
        for (const item of draft.items) {
          const t0 = reservedAt - rng.int(2, 9) * DAY;
          if (t0 > item.receivedAt) {
            move(item, "RESERVED", t0, { channel: "WEBSITE", refType: "CART", refLabel: "Website cart", fromStatus: "AVAILABLE", toStatus: "RESERVED", note: "Website cart for 15 min", actorName: "Website" });
            move(item, "RESERVATION_EXPIRED", t0 + 15 * 60_000, { channel: "WEBSITE", refType: "CART", fromStatus: "RESERVED", toStatus: "AVAILABLE", note: "Website cart reservation expired", actorName: "System" });
          }
        }
      }
      for (const item of draft.items) {
        move(item, "RESERVED", reservedAt, { ...channelRef, fromStatus: "AVAILABLE", toStatus: "RESERVED", note: paid ? "Allocated to paid order" : "Held for WhatsApp order (awaiting payment)", actorName: staff });
      }
      if (paid && !cancelled) timeline.push(event("Items reserved", "RESERVED", reservedAt + 1000, staff));

      if (cancelled) {
        const cancelAt = at + rng.int(2, 20) * HOUR;
        timeline.push(event("Order cancelled", "CANCELLED", cancelAt, managerName, paid ? "Customer requested cancellation" : "Payment not received before the deadline"));
        if (paid) {
          payments.push({ id: rng.id("pay"), orderId: id, kind: "REFUND", method: payments[payments.length - 1]!.method, amount: total, reference: `RFND-${number}`, createdAt: cancelAt });
          order.paymentStatus = "REFUNDED";
        }
        for (const item of draft.items) {
          item.status = "AVAILABLE";
          move(item, "RESERVATION_RELEASED", cancelAt, { ...channelRef, fromStatus: "RESERVED", toStatus: "AVAILABLE", note: "Order cancelled", actorName: managerName });
        }
        order.updatedAt = cancelAt;
      } else if (status === "PAYMENT_PENDING" || status === "RESERVED" || status === "PACKING" || status === "READY_TO_DISPATCH") {
        for (const item of draft.items) {
          item.status = "RESERVED";
          item.reservation = { kind: "ORDER", holderId: id, channel: draft.channel, orderId: id, reservedAt, expiresAt: status === "PAYMENT_PENDING" ? order.paymentDueAt : null };
          item.holderId = id;
          item.updatedAt = reservedAt;
        }
        if (status === "PACKING" || status === "READY_TO_DISPATCH") timeline.push(event("Packing started", "PACKING", Math.min(now - 5 * 60_000, reservedAt + rng.int(20, 60) * 60_000), packingName));
        if (status === "READY_TO_DISPATCH") timeline.push(event("Packed and ready to dispatch", "READY_TO_DISPATCH", Math.min(now - 2 * 60_000, reservedAt + rng.int(61, 120) * 60_000), packingName));
        order.updatedAt = timeline[timeline.length - 1]!.at;
        if (paid) pushNotification("ORDER_CONFIRMED", order, reservedAt);
      } else if (draft.fulfilment === "IN_STORE") {
        const collectedAt = at + rng.int(3, 18) * HOUR;
        timeline.push(event("Collected at store", "DELIVERED", collectedAt, billingName));
        for (const item of draft.items) {
          item.status = "SOLD";
          item.soldAt = collectedAt;
          item.soldOrderId = id;
          item.updatedAt = collectedAt;
          move(item, "SOLD", collectedAt, { ...channelRef, fromStatus: "RESERVED", toStatus: "SOLD", note: "Collected at store", actorName: billingName });
        }
        order.updatedAt = collectedAt;
      } else {
        // Shipped: packed, dispatched, maybe in transit / delivered.
        const packedAt = Math.min(now - 30 * 60_000, reservedAt + rng.int(1, 5) * HOUR);
        const dispatchedAt = Math.min(now - 20 * 60_000, packedAt + rng.int(1, 4) * HOUR);
        timeline.push(event("Packing started", "PACKING", packedAt - 30 * 60_000, packingName));
        timeline.push(event("Packed and ready to dispatch", "READY_TO_DISPATCH", packedAt, packingName));
        const courier = rng.weighted(couriers, (c) => c.w);
        const awb = courier.awb();
        timeline.push(event(`Dispatched via ${courier.name}`, "DISPATCHED", dispatchedAt, packingName, `AWB ${awb}`));
        const city = order.shippingAddress?.city ?? "Destination";
        const events: ShipmentEvent[] = [{ status: "DISPATCHED", location: DEFAULT_SETTINGS.business.city, description: `Picked up by ${courier.name}`, at: dispatchedAt }];
        let shipmentStatus: Shipment["status"] = "DISPATCHED";
        let deliveredAt: number | null = null;
        if (status === "IN_TRANSIT" || status === "DELIVERED") {
          const transitAt = Math.min(now - 10 * 60_000, dispatchedAt + rng.int(10, 30) * HOUR);
          events.push({ status: "IN_TRANSIT", location: `${city} Hub`, description: "Arrived at destination hub", at: transitAt });
          timeline.push(event("In transit", "IN_TRANSIT", transitAt, "System", `${city} Hub`));
          shipmentStatus = "IN_TRANSIT";
          if (status === "DELIVERED") {
            const ofdAt = transitAt + rng.int(8, 30) * HOUR;
            deliveredAt = ofdAt + rng.int(2, 7) * HOUR;
            events.push({ status: "OUT_FOR_DELIVERY", location: city, description: "Out for delivery with courier executive", at: ofdAt });
            events.push({ status: "DELIVERED", location: city, description: `Delivered to ${order.customer.name.split(" ")[0]}`, at: deliveredAt });
            timeline.push(event("Delivered", "DELIVERED", deliveredAt, "System"));
            shipmentStatus = "DELIVERED";
          }
        }
        shipments.push({
          id: rng.id("shp"),
          orderId: id,
          courier: courier.name,
          awb,
          status: shipmentStatus,
          dispatchedAt,
          expectedDeliveryAt: dispatchedAt + 4 * DAY,
          deliveredAt,
          events,
          createdAt: dispatchedAt,
          updatedAt: events[events.length - 1]!.at,
        });
        for (const item of draft.items) {
          item.status = "SOLD";
          item.soldAt = dispatchedAt;
          item.soldOrderId = id;
          item.updatedAt = dispatchedAt;
          move(item, "SOLD", dispatchedAt, { ...channelRef, fromStatus: "RESERVED", toStatus: "SOLD", note: `Dispatched via ${courier.name} (${awb})`, actorName: packingName });
        }
        order.updatedAt = events[events.length - 1]!.at;
        if (ageH < 24 * 12) {
          pushNotification("ORDER_CONFIRMED", order, reservedAt);
          pushNotification("ORDER_PACKED", order, packedAt);
          pushNotification("ORDER_DISPATCHED", order, dispatchedAt, { courier: courier.name, awb });
          if (deliveredAt) {
            pushNotification("ORDER_DELIVERED", order, deliveredAt);
            pushNotification("REVIEW_REQUEST", order, deliveredAt + HOUR, { design: lines[0]!.designName });
          }
        }
        // Reviews and returns on delivered orders.
        if (deliveredAt && rng.chance(0.14)) {
          const [rating, body] = rng.pick(REVIEW_TEXTS);
          reviews.push({
            id: rng.id("rev"),
            orderId: id,
            designId: lines[0]!.designId,
            customerName: `${order.customer.name.split(" ")[0]} ${order.customer.name.split(" ").pop()![0]}.`,
            city,
            rating,
            body,
            createdAt: deliveredAt + rng.int(4, 60) * HOUR,
          });
        }
        if (deliveredAt && ageH > 24 * 10 && ageH < 24 * 70 && rng.chance(0.03)) {
          const line = lines[0]!;
          const item = draft.items[0]!;
          const requestedAt = deliveredAt + rng.int(1, 4) * DAY;
          const receivedAt = requestedAt + 3 * DAY;
          const qcAt = receivedAt + HOUR * 4;
          const good = rng.chance(0.75);
          const refundAt = qcAt + HOUR;
          const retNumber = `RET-${String(returnSeq++).padStart(4, "0")}`;
          const retId = rng.id("ret");
          returns.push({
            id: retId,
            number: retNumber,
            orderId: id,
            orderNumber: number,
            customerId: order.customerId,
            customerName: order.customer.name,
            type: "RETURN",
            status: "REFUNDED",
            reason: rng.pick(["Colour different from photo", "Fabric felt thinner than expected", "Received a different shade", "Did not suit the occasion"]),
            lines: [{ orderItemId: line.id, inventoryItemId: item.id, sku: item.sku, designName: line.designName, colourName: line.colourName, unitPrice: line.lineTotal, qc: good ? "GOOD" : "DAMAGED" }],
            refundAmount: line.lineTotal,
            exchange: null,
            timeline: [
              { label: "Return requested", actorName: "Website", at: requestedAt },
              { label: "Approved · reverse pickup scheduled", actorName: managerName, at: requestedAt + 5 * HOUR },
              { label: "Parcel received at shop", actorName: packingName, at: receivedAt },
              { label: `Quality check: ${good ? "1 good, 0 damaged" : "0 good, 1 damaged"}`, actorName: managerName, at: qcAt },
              { label: `Refunded ${formatINR(line.lineTotal)} via UPI`, actorName: managerName, at: refundAt },
            ],
            createdAt: requestedAt,
            updatedAt: refundAt,
          });
          line.status = "RETURNED";
          const refundTotal = line.lineTotal;
          payments.push({ id: rng.id("pay"), orderId: id, kind: "REFUND", method: "UPI", amount: refundTotal, reference: `RFND-${retNumber}`, createdAt: refundAt });
          const fully = lines.every((l) => l.status === "RETURNED");
          order.status = fully ? "REFUNDED" : "DELIVERED";
          order.paymentStatus = fully ? "REFUNDED" : "PARTIALLY_REFUNDED";
          timeline.push(event(`Return requested (${retNumber})`, "RETURN_REQUESTED", requestedAt, "Website"));
          if (fully) {
            timeline.push(event(`Return ${retNumber} received`, "RETURNED", receivedAt, packingName));
            timeline.push(event(`Refunded ${formatINR(refundTotal)}`, "REFUNDED", refundAt, managerName));
          } else timeline.push(event(`Return ${retNumber} received`, "DELIVERED", receivedAt, packingName));
          order.updatedAt = refundAt;
          item.status = good ? "AVAILABLE" : "DAMAGED";
          item.soldAt = null;
          item.soldOrderId = null;
          item.location = good ? racks.get(item.designId)! : "R-01";
          item.updatedAt = qcAt;
          move(item, "RETURN_RECEIVED", receivedAt, { refType: "RETURN", refId: retId, refLabel: retNumber, fromStatus: "SOLD", toStatus: "RETURNED", note: "Returned by customer", actorName: packingName });
          move(item, good ? "QC_PASSED" : "QC_FAILED", qcAt, { refType: "RETURN", refId: retId, refLabel: retNumber, fromStatus: "RETURNED", toStatus: good ? "AVAILABLE" : "DAMAGED", note: good ? "Quality check passed, back on sale" : "Quality check failed", actorName: managerName });
        }
      }
    }
    orders.push(order);
    orderItems.push(...lines);
  }

  // Open return requests on recently delivered orders.
  const recentDelivered = orders.filter((o) => o.status === "DELIVERED" && o.fulfilment === "SHIPPING" && o.updatedAt > now - 5 * DAY && o.updatedAt < now - 12 * HOUR);
  const openReturns: { order: Order; type: "RETURN" | "EXCHANGE"; status: "REQUESTED" | "APPROVED"; reason: string }[] = [];
  if (recentDelivered[0]) openReturns.push({ order: recentDelivered[0], type: "RETURN", status: "REQUESTED", reason: "Colour looks different from the website photo" });
  if (recentDelivered[1]) openReturns.push({ order: recentDelivered[1], type: "EXCHANGE", status: "REQUESTED", reason: "Would like the same saree in a different colour" });
  if (recentDelivered[2]) openReturns.push({ order: recentDelivered[2], type: "RETURN", status: "APPROVED", reason: "Small pull in the zari near the pallu" });
  for (const { order, type, status, reason } of openReturns) {
    const line = orderItems.find((l) => l.orderId === order.id)!;
    const requestedAt = Math.min(now - HOUR, order.updatedAt + rng.int(4, 12) * HOUR);
    const retNumber = `RET-${String(returnSeq++).padStart(4, "0")}`;
    returns.push({
      id: rng.id("ret"),
      number: retNumber,
      orderId: order.id,
      orderNumber: order.number,
      customerId: order.customerId,
      customerName: order.customer.name,
      type,
      status,
      reason,
      lines: [{ orderItemId: line.id, inventoryItemId: line.inventoryItemId, sku: line.sku, designName: line.designName, colourName: line.colourName, unitPrice: line.lineTotal, qc: "PENDING" }],
      refundAmount: line.lineTotal,
      exchange: null,
      timeline: [
        { label: `${type === "EXCHANGE" ? "Exchange" : "Return"} requested`, actorName: "Website", at: requestedAt },
        ...(status === "APPROVED" ? [{ label: "Approved · reverse pickup scheduled", actorName: managerName, at: requestedAt + 30 * 60_000 }] : []),
      ],
      createdAt: requestedAt,
      updatedAt: requestedAt,
    });
    order.status = "RETURN_REQUESTED";
    order.timeline.push(event(`${type === "EXCHANGE" ? "Exchange" : "Return"} requested (${retNumber})`, "RETURN_REQUESTED", requestedAt, "Website", reason));
    order.updatedAt = requestedAt;
  }

  // A few damaged pieces found during stock checks.
  const damageNotes = ["Oil stain on pallu", "Zari pulled near border", "Colour bleed on fold", "Small tear at blouse piece", "Moth damage on body"];
  const oldAvailable = pieces.filter((p) => p.status === "AVAILABLE" && now - p.receivedAt > 60 * DAY);
  for (let n = 0; n < 14 && oldAvailable.length; n++) {
    const item = oldAvailable.splice(rng.int(0, oldAvailable.length - 1), 1)[0]!;
    const at = now - rng.int(2, 40) * DAY;
    item.status = "DAMAGED";
    item.updatedAt = at;
    move(item, "MARKED_DAMAGED", at, { fromStatus: "AVAILABLE", toStatus: "DAMAGED", note: rng.pick(damageNotes), actorName: managerName });
  }

  /* Customer stats ---------------------------------------------------- */
  const refundsByOrder = new Map<string, number>();
  for (const p of payments) if (p.kind === "REFUND") refundsByOrder.set(p.orderId, (refundsByOrder.get(p.orderId) ?? 0) + p.amount);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  for (const o of orders) {
    if (!o.customerId || o.status === "CANCELLED" || o.paymentStatus === "PENDING") continue;
    const c = customerById.get(o.customerId)!;
    c.stats.orderCount++;
    c.stats.totalSpend += o.total - (refundsByOrder.get(o.id) ?? 0);
    c.stats.firstOrderAt = Math.min(c.stats.firstOrderAt ?? o.createdAt, o.createdAt);
    c.stats.lastOrderAt = Math.max(c.stats.lastOrderAt ?? 0, o.createdAt);
    if (c.source === "SHOP" && o.channel !== "SHOP" && c.stats.orderCount === 1) c.source = o.channel;
  }
  // Some older customers with no recent purchases, to show the INACTIVE segment.
  for (const c of customers.slice(200, 222)) {
    if (c.stats.orderCount === 0) {
      c.stats = { orderCount: rng.int(1, 3), totalSpend: rng.int(3, 18) * 1000, firstOrderAt: now - rng.int(400, 600) * DAY, lastOrderAt: now - rng.int(200, 380) * DAY };
    }
  }

  /* Wishlists --------------------------------------------------------- */
  const wishlists: WishlistEntry[] = [];
  for (const c of customers.slice(0, 40)) {
    const picks = new Set<string>();
    for (let n = 0; n < rng.int(1, 3); n++) picks.add(rng.pick(designs).id);
    for (const designId of picks) wishlists.push({ id: rng.id("wsh"), ownerId: c.id, customerId: c.id, designId, notifiedAt: null, createdAt: now - rng.int(1, 60) * DAY });
  }

  /* WhatsApp ---------------------------------------------------------- */
  const waConversations: WaConversation[] = [];
  const waMessages: WaMessage[] = [];
  WHATSAPP_SCRIPTS.forEach((script, i) => {
    const customer = scriptedCustomers.get(script.name)!;
    const convId = `wac_${i + 1}`;
    const linkedOrders = orders.filter((o) => o.customerId === customer.id && o.channel === "WHATSAPP");
    let t = now - (i + 1) * 47 * 60_000 - rng.int(0, 20) * 60_000;
    if (script.intent === "pending" || script.intent === "paid") {
      const o = linkedOrders[linkedOrders.length - 1];
      if (o) t = o.createdAt - 25 * 60_000;
    }
    const msgs: WaMessage[] = [];
    const design = script.product ? designs.find((d) => d.name === script.product) : undefined;
    script.lines.forEach(([direction, text], li) => {
      msgs.push({ id: rng.id("wam"), conversationId: convId, direction, kind: "TEXT", text, designId: null, orderId: null, amount: null, createdAt: t + li * 4 * 60_000 });
      if (li === 1 && design) {
        const price = design.price;
        const available = pieces.filter((p) => p.designId === design.id && p.status === "AVAILABLE").length;
        msgs.push({
          id: rng.id("wam"),
          conversationId: convId,
          direction: "OUT",
          kind: "PRODUCT",
          text: [`*${design.name}*`, formatINR(price), design.description, available === 1 ? "Available: 1 piece" : `Available: ${available} pieces`, `View product: ${origin}/store/p?slug=${design.slug}`].join("\n"),
          designId: design.id,
          orderId: null,
          amount: null,
          createdAt: t + li * 4 * 60_000 + 30_000,
        });
      }
    });
    const lastOrder = linkedOrders[linkedOrders.length - 1];
    if (lastOrder && (script.intent === "pending" || script.intent === "paid")) {
      const at = Math.max(msgs[msgs.length - 1]!.createdAt + 2 * 60_000, lastOrder.createdAt);
      msgs.push({ id: rng.id("wam"), conversationId: convId, direction: "OUT", kind: "ORDER", text: `Order #${lastOrder.number} created · 1 saree · ${formatINR(lastOrder.total)}`, designId: null, orderId: lastOrder.id, amount: lastOrder.total, createdAt: at });
      msgs.push({ id: rng.id("wam"), conversationId: convId, direction: "OUT", kind: "PAYMENT_REQUEST", text: `Payment request for order #${lastOrder.number}: ${formatINR(lastOrder.total)}. Pay via UPI.`, designId: null, orderId: lastOrder.id, amount: lastOrder.total, createdAt: at + 60_000 });
      if (script.intent === "paid") {
        msgs.push({ id: rng.id("wam"), conversationId: convId, direction: "OUT", kind: "SYSTEM", text: `Payment of ${formatINR(lastOrder.total)} received for order #${lastOrder.number}. Thank you!`, designId: null, orderId: lastOrder.id, amount: null, createdAt: at + 40 * 60_000 });
      }
    }
    msgs.sort((a, b) => a.createdAt - b.createdAt);
    const last = msgs[msgs.length - 1]!;
    waMessages.push(...msgs);
    waConversations.push({
      id: convId,
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      lastMessageAt: last.createdAt,
      lastMessagePreview: last.text.split("\n")[0]!.slice(0, 80),
      unreadCount: last.direction === "IN" ? rng.int(1, 2) : 0,
      orderIds: linkedOrders.slice(-3).map((o) => o.id),
      createdAt: msgs[0]!.createdAt,
    });
  });

  /* Audit log --------------------------------------------------------- */
  const auditLogs: AuditLog[] = [];
  const audit = (entry: Omit<AuditLog, "id">) => auditLogs.push({ id: rng.id("aud"), ...entry });
  for (const [designId, change] of priceChangedDesigns) {
    const design = designById.get(designId)!;
    audit({ action: "PRICE_CHANGED", entityType: "DESIGN", entityId: designId, entityLabel: `${design.name} (${design.code})`, summary: `Selling price ${formatINR(change.oldPrice)} → ${formatINR(design.price)}`, before: `Price ${formatINR(change.oldPrice)}`, after: `Price ${formatINR(design.price)}`, actorName: managerName, actorRole: "MANAGER", createdAt: change.changedAt });
  }
  for (const p of purchases.slice(-12)) {
    audit({ action: "PURCHASE_RECEIVED", entityType: "PURCHASE", entityId: p.id, entityLabel: `${p.number} · ${p.invoiceNumber}`, summary: `Received ${p.pieceCount} pieces worth ${formatINR(p.totalCost)}`, before: null, after: null, actorName: managerName, actorRole: "MANAGER", createdAt: p.receivedAt! });
  }
  for (const o of orders.filter((x) => x.status === "CANCELLED").slice(-6)) {
    audit({ action: "ORDER_CANCELLED", entityType: "ORDER", entityId: o.id, entityLabel: `#${o.number}`, summary: `Cancelled: ${o.timeline[o.timeline.length - 1]!.note}`, before: null, after: null, actorName: managerName, actorRole: "MANAGER", createdAt: o.updatedAt });
  }
  audit({ action: "SETTINGS_CHANGED", entityType: "SETTINGS", entityId: "settings:store", entityLabel: "Store settings", summary: "Store settings updated", before: null, after: null, actorName: ownerName, actorRole: "OWNER", createdAt: now - 30 * DAY });
  const overridden = pieces.filter((p) => p.priceOverride !== null).slice(0, 5);
  for (const p of overridden) {
    const design = designById.get(p.designId)!;
    audit({ action: "PRICE_CHANGED", entityType: "INVENTORY", entityId: p.id, entityLabel: p.sku, summary: `Price ${formatINR(design.price)} → ${formatINR(p.priceOverride!)}`, before: formatINR(design.price), after: formatINR(p.priceOverride!), actorName: managerName, actorRole: "MANAGER", createdAt: p.receivedAt + DAY });
  }
  // Recent day-to-day activity so the log reads like a working shop.
  const roleOf = (name: string) => (name === ownerName ? "OWNER" : name === managerName ? "MANAGER" : name === billingName ? "BILLING" : name === packingName ? "PACKING" : "SYSTEM");
  const recentOrders = orders.filter((o) => now - o.createdAt < 4 * DAY);
  for (const o of recentOrders) {
    const actorName = o.createdBy;
    audit({ action: "ORDER_CREATED", entityType: "ORDER", entityId: o.id, entityLabel: `#${o.number}`, summary: `${o.channel === "SHOP" ? "Counter bill" : o.channel === "WHATSAPP" ? "WhatsApp order" : "Website order"} for ${o.customer.name} · ${formatINR(o.total)}`, before: null, after: null, actorName, actorRole: roleOf(actorName), createdAt: o.createdAt });
    for (const ev of o.timeline.slice(1)) {
      if (!ev.status || ev.at <= o.createdAt || ev.status === "CANCELLED") continue;
      const isPayment = ev.status === "CONFIRMED" && o.channel !== "SHOP";
      audit({
        action: isPayment ? "PAYMENT_RECORDED" : "ORDER_STATUS_CHANGED",
        entityType: "ORDER",
        entityId: o.id,
        entityLabel: `#${o.number}`,
        summary: isPayment ? `Payment of ${formatINR(o.total)} received` : ev.label,
        before: null,
        after: null,
        actorName: ev.actorName,
        actorRole: roleOf(ev.actorName),
        createdAt: ev.at,
      });
    }
  }
  for (const r of returns.slice(-6)) {
    audit({ action: "RETURN_UPDATED", entityType: "RETURN", entityId: r.id, entityLabel: r.number, summary: `${r.type === "EXCHANGE" ? "Exchange" : "Return"} requested for order #${r.orderNumber}: ${r.reason}`, before: null, after: r.status, actorName: r.customerName, actorRole: "SYSTEM", createdAt: r.createdAt });
  }
  for (const item of pieces.filter((p) => p.status === "DAMAGED").slice(0, 6)) {
    audit({ action: "INVENTORY_ADJUSTED", entityType: "INVENTORY", entityId: item.id, entityLabel: item.sku, summary: "Marked damaged during stock check", before: "Available", after: "Damaged", actorName: managerName, actorRole: "MANAGER", createdAt: item.updatedAt });
  }
  const recentPriceItems = pieces.filter((p) => p.status === "AVAILABLE" && p.priceOverride === null).slice(-40, -34);
  recentPriceItems.forEach((p, i) => {
    const design = designById.get(p.designId)!;
    const newPrice = priceEnding(design.price * 0.94);
    if (newPrice >= design.price || newPrice <= p.cost) return;
    p.priceOverride = newPrice;
    audit({ action: "PRICE_CHANGED", entityType: "INVENTORY", entityId: p.id, entityLabel: p.sku, summary: "Individual price set for this piece", before: formatINR(design.price), after: formatINR(newPrice), actorName: managerName, actorRole: "MANAGER", createdAt: now - (i * 7 + 3) * HOUR });
  });
  auditLogs.sort((a, b) => a.createdAt - b.createdAt);

  // A few heirloom designs are down to their last piece, so "Only 1 available" and
  // "reserved in another cart" can be shown without any setup.
  const lastPieceDesigns = new Set(["Banarasi Bridal Kadhwa", "Patola Double Ikat Silk", "Kanchipuram Half and Half"].map((n) => `dsn_${slugify(n)}`));
  const removed = new Set<string>();
  for (const designId of lastPieceDesigns) {
    const available = pieces.filter((p) => p.designId === designId && p.status === "AVAILABLE");
    for (const p of available.slice(1)) removed.add(p.id);
  }
  if (removed.size) {
    for (let i = pieces.length - 1; i >= 0; i--) if (removed.has(pieces[i]!.id)) pieces.splice(i, 1);
    for (let i = movements.length - 1; i >= 0; i--) if (removed.has(movements[i]!.itemId)) movements.splice(i, 1);
    const perLine = new Map<string, { qty: number; cost: number }>();
    for (const p of pieces) {
      const key = `${p.purchaseId}|${p.designId}|${p.colourId}`;
      const e = perLine.get(key) ?? { qty: 0, cost: 0 };
      e.qty++;
      e.cost += p.cost;
      perLine.set(key, e);
    }
    for (let i = purchaseItems.length - 1; i >= 0; i--) {
      const li = purchaseItems[i]!;
      const e = perLine.get(`${li.purchaseId}|${li.designId}|${li.colourId}`);
      if (!e) purchaseItems.splice(i, 1);
      else li.quantity = e.qty;
    }
    for (const pur of purchases) {
      const own = pieces.filter((p) => p.purchaseId === pur.id);
      pur.pieceCount = own.length;
      pur.totalCost = own.reduce((sum, p) => sum + p.cost, 0);
    }
  }

  return {
    categories,
    collections,
    colours,
    fabrics,
    suppliers,
    media,
    designs,
    inventoryItems: pieces,
    inventoryMovements: movements,
    purchases,
    purchaseItems,
    customers,
    orders,
    orderItems,
    payments,
    shipments,
    returns,
    reviews,
    wishlists,
    notifications,
    auditLogs,
    waConversations,
    waMessages,
    counters: [
      { key: "sku", value: nextSku },
      { key: "order", value: orderNumber },
      { key: "purchase", value: purchases.length + 1 },
      { key: "design", value: designs.length + 1 },
      { key: "return", value: returnSeq },
    ],
  };
}
