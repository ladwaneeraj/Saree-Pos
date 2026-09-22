/**
 * Dashboard and report aggregations, computed from local data on every change.
 * Sales are recognised when payment is received (see countsAsSale); cancelled orders never count.
 */
import { repos } from "@/data";
import type { Design, InventoryItem, Order, OrderItem, PaymentMethod, SalesChannel } from "@/domain/types";
import { AGING_BUCKETS, ageInDays, agingBucket, type AgingBucketKey } from "@/domain/rules/inventory";
import { PENDING_DISPATCH_STATUSES, countsAsSale } from "@/domain/rules/orders";
import { effectivePrice } from "@/domain/rules/pricing";
import { getCatalog } from "./catalog";
import { DAY_MS, now, startOfDay } from "./context";
import { CHANNEL_LABELS, PAYMENT_METHOD_LABELS } from "./orders";
import { getSettings } from "./settings";

export interface DailyPoint {
  date: number;
  sales: number;
  orders: number;
  units: number;
}

export interface NamedValue {
  key: string;
  name: string;
  value: number;
  count: number;
}

export interface DesignMetric {
  design: Design;
  units: number;
  revenue: number;
  available: number;
  imageId: string | null;
}

interface SaleLine {
  item: OrderItem;
  order: Order;
  /** Line revenue after allocating the order-level discount proportionally. */
  net: number;
}

function saleLines(orders: Order[], items: OrderItem[]): SaleLine[] {
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const lines: SaleLine[] = [];
  for (const item of items) {
    const order = orderById.get(item.orderId);
    if (!order || !countsAsSale(order) || item.status !== "ACTIVE") continue;
    const factor = order.subtotal > 0 ? (order.subtotal - order.discount) / order.subtotal : 1;
    lines.push({ item, order, net: item.lineTotal * factor });
  }
  return lines;
}

function dailySeries(orders: Order[], lines: SaleLine[], from: number, days: number): DailyPoint[] {
  const points: DailyPoint[] = Array.from({ length: days }, (_, i) => ({ date: from + i * DAY_MS, sales: 0, orders: 0, units: 0 }));
  const index = (ts: number) => Math.floor((startOfDay(ts) - from) / DAY_MS);
  for (const o of orders) {
    if (!countsAsSale(o)) continue;
    const p = points[index(o.createdAt)];
    if (p) {
      p.sales += o.total;
      p.orders++;
    }
  }
  for (const l of lines) {
    const p = points[index(l.order.createdAt)];
    if (p) p.units++;
  }
  return points;
}

function groupSum<T>(rows: T[], key: (r: T) => string, value: (r: T) => number, name: (k: string) => string): NamedValue[] {
  const map = new Map<string, NamedValue>();
  for (const r of rows) {
    const k = key(r);
    const e = map.get(k) ?? { key: k, name: name(k), value: 0, count: 0 };
    e.value += value(r);
    e.count++;
    map.set(k, e);
  }
  return [...map.values()].map((e) => ({ ...e, value: Math.round(e.value) })).sort((a, b) => b.value - a.value);
}

function designMetrics(lines: SaleLine[], designs: Map<string, Design>, availableByDesign: Map<string, number>): DesignMetric[] {
  const map = new Map<string, DesignMetric>();
  for (const l of lines) {
    const design = designs.get(l.item.designId);
    if (!design) continue;
    const m = map.get(design.id) ?? { design, units: 0, revenue: 0, available: availableByDesign.get(design.id) ?? 0, imageId: design.imageIds[0] ?? l.item.imageId };
    m.units++;
    m.revenue += l.net;
    map.set(design.id, m);
  }
  return [...map.values()].map((m) => ({ ...m, revenue: Math.round(m.revenue) }));
}

export interface AgingRow {
  key: AgingBucketKey;
  label: string;
  pieces: number;
  cost: number;
  retail: number;
}

function agingRows(stock: InventoryItem[], designs: Map<string, Design>, t: number): AgingRow[] {
  const rows = AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, pieces: 0, cost: 0, retail: 0 }));
  for (const item of stock) {
    const row = rows.find((r) => r.key === agingBucket(item.receivedAt, t))!;
    row.pieces++;
    row.cost += item.cost;
    const design = designs.get(item.designId);
    if (design) row.retail += effectivePrice(item, design);
  }
  return rows;
}

/** Pieces physically in the shop and sellable soon: available, reserved or awaiting QC. */
function inStock(items: InventoryItem[]): InventoryItem[] {
  return items.filter((i) => i.status === "AVAILABLE" || i.status === "RESERVED");
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export interface DashboardData {
  kpis: {
    todaySales: number;
    yesterdaySales: number;
    todayOrders: number;
    yesterdayOrders: number;
    sareesSoldToday: number;
    onlineOrdersToday: number;
    whatsappOrdersToday: number;
    currentStock: number;
    availableStock: number;
    reservedStock: number;
    stockValueRetail: number;
    stockValueCost: number;
    pendingDispatch: number;
  };
  salesLast30: DailyPoint[];
  salesByChannel: NamedValue[];
  topProducts: DesignMetric[];
  salesByCategory: NamedValue[];
  aging: AgingRow[];
  paymentMethods: NamedValue[];
  attention: {
    paymentPending: Order[];
    packingPending: Order[];
    readyToDispatch: Order[];
    returnRequests: Order[];
  };
  lowStock: DesignMetric[];
  fastMoving: DesignMetric[];
  oldStock: { design: Design; pieces: number; oldestDays: number; cost: number; imageId: string | null }[];
}

export async function getDashboard(): Promise<DashboardData> {
  const r = repos();
  const t = now();
  const today = startOfDay(t);
  const from30 = today - 29 * DAY_MS;
  const [orders, items30, payments30, inventory, designs, catalog, settings] = await Promise.all([
    r.orders.listSince(from30),
    r.orderItems.listSince(from30),
    r.payments.listSince(from30),
    r.inventory.list(),
    r.designs.list(),
    getCatalog(),
    getSettings(),
  ]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const lines = saleLines(orders, items30);
  const sales = orders.filter(countsAsSale);
  const todayOrders = sales.filter((o) => o.createdAt >= today);
  const yesterday = sales.filter((o) => o.createdAt >= today - DAY_MS && o.createdAt < today);
  const stock = inStock(inventory);
  const available = inventory.filter((i) => i.status === "AVAILABLE");
  const availableByDesign = new Map<string, number>();
  for (const i of available) availableByDesign.set(i.designId, (availableByDesign.get(i.designId) ?? 0) + 1);

  const pendingOrders = await r.orders.listByStatuses([...PENDING_DISPATCH_STATUSES, "PAYMENT_PENDING", "RETURN_REQUESTED"]);
  const byStatus = (statuses: Order["status"][]) => pendingOrders.filter((o) => statuses.includes(o.status)).sort((a, b) => a.createdAt - b.createdAt);

  const metrics30 = designMetrics(lines, designById, availableByDesign);
  const lowStock = designs
    .filter((d) => d.isPublished)
    .map((d) => ({
      design: d,
      available: availableByDesign.get(d.id) ?? 0,
      units: metrics30.find((m) => m.design.id === d.id)?.units ?? 0,
      revenue: 0,
      imageId: d.imageIds[0] ?? null,
    }))
    .filter((m) => m.available <= settings.store.lowStockThreshold && (m.available > 0 || m.units > 0))
    .sort((a, b) => a.available - b.available || b.units - a.units)
    .slice(0, 8);

  const old = new Map<string, { design: Design; pieces: number; oldestDays: number; cost: number; imageId: string | null }>();
  for (const item of available) {
    const days = ageInDays(item.receivedAt, t);
    if (days <= 180) continue;
    const design = designById.get(item.designId);
    if (!design) continue;
    const e = old.get(design.id) ?? { design, pieces: 0, oldestDays: 0, cost: 0, imageId: design.imageIds[0] ?? null };
    e.pieces++;
    e.cost += item.cost;
    e.oldestDays = Math.max(e.oldestDays, days);
    old.set(design.id, e);
  }

  return {
    kpis: {
      todaySales: todayOrders.reduce((s, o) => s + o.total, 0),
      yesterdaySales: yesterday.reduce((s, o) => s + o.total, 0),
      todayOrders: todayOrders.length,
      yesterdayOrders: yesterday.length,
      sareesSoldToday: todayOrders.reduce((s, o) => s + o.itemCount, 0),
      onlineOrdersToday: todayOrders.filter((o) => o.channel === "WEBSITE").length,
      whatsappOrdersToday: todayOrders.filter((o) => o.channel === "WHATSAPP").length,
      currentStock: stock.length,
      availableStock: available.length,
      reservedStock: stock.length - available.length,
      stockValueRetail: stock.reduce((s, i) => s + effectivePrice(i, designById.get(i.designId)!), 0),
      stockValueCost: stock.reduce((s, i) => s + i.cost, 0),
      pendingDispatch: pendingOrders.filter((o) => PENDING_DISPATCH_STATUSES.includes(o.status) && o.fulfilment === "SHIPPING").length,
    },
    salesLast30: dailySeries(orders, lines, from30, 30),
    salesByChannel: groupSum(sales, (o) => o.channel, (o) => o.total, (k) => CHANNEL_LABELS[k as SalesChannel]),
    topProducts: [...metrics30].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, 10),
    salesByCategory: groupSum(lines, (l) => designById.get(l.item.designId)?.categoryId ?? "", (l) => l.net, (k) => catalog.categoryById.get(k)?.name ?? "Other"),
    aging: agingRows(stock, designById, t),
    paymentMethods: groupSum(
      payments30.filter((p) => p.kind === "PAYMENT" && p.method !== "STORE_CREDIT"),
      (p) => p.method,
      (p) => p.amount,
      (k) => PAYMENT_METHOD_LABELS[k as PaymentMethod],
    ),
    attention: {
      paymentPending: byStatus(["PAYMENT_PENDING"]),
      packingPending: byStatus(["CONFIRMED", "RESERVED", "PACKING"]).filter((o) => o.fulfilment === "SHIPPING"),
      readyToDispatch: byStatus(["READY_TO_DISPATCH"]),
      returnRequests: byStatus(["RETURN_REQUESTED"]),
    },
    lowStock,
    fastMoving: [...metrics30].sort((a, b) => b.units - a.units).slice(0, 6),
    oldStock: [...old.values()].sort((a, b) => b.cost - a.cost).slice(0, 6),
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface SalesReport {
  from: number;
  to: number;
  totals: { gross: number; orders: number; units: number; aov: number; refunds: number; net: number; margin: number; discounts: number };
  daily: DailyPoint[];
  monthly: { month: string; sales: number; orders: number }[];
  byChannel: NamedValue[];
  byPayment: NamedValue[];
  topDesigns: DesignMetric[];
  topColours: (NamedValue & { hex: string })[];
  topFabrics: NamedValue[];
}

export async function getSalesReport(from: number, to: number): Promise<SalesReport> {
  const r = repos();
  const yearAgo = startOfDay(now()) - 365 * DAY_MS;
  const since = Math.min(from, yearAgo);
  const [allOrders, allItems, payments, designs, catalog, inventory] = await Promise.all([
    r.orders.listSince(since),
    r.orderItems.listSince(since),
    r.payments.listSince(from),
    r.designs.list(),
    getCatalog(),
    r.inventory.listByStatus("AVAILABLE"),
  ]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const inRange = (ts: number) => ts >= from && ts <= to;
  const orders = allOrders.filter((o) => inRange(o.createdAt));
  const lines = saleLines(orders, allItems.filter((i) => inRange(i.createdAt)));
  const sales = orders.filter(countsAsSale);
  const rangePayments = payments.filter((p) => inRange(p.createdAt));
  const refunds = rangePayments.filter((p) => p.kind === "REFUND").reduce((s, p) => s + p.amount, 0);
  const gross = sales.reduce((s, o) => s + o.total, 0);
  const availableByDesign = new Map<string, number>();
  for (const i of inventory) availableByDesign.set(i.designId, (availableByDesign.get(i.designId) ?? 0) + 1);

  const monthly = new Map<string, { month: string; sales: number; orders: number; sort: number }>();
  for (const o of allOrders.filter(countsAsSale)) {
    if (o.createdAt < yearAgo) continue;
    const d = new Date(o.createdAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const e = monthly.get(key) ?? { month: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }), sales: 0, orders: 0, sort: d.getFullYear() * 12 + d.getMonth() };
    e.sales += o.total;
    e.orders++;
    monthly.set(key, e);
  }
  const days = Math.max(1, Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS) + 1);
  const colourHex = (k: string) => catalog.colourById.get(k)?.hex ?? "#999";

  return {
    from,
    to,
    totals: {
      gross,
      orders: sales.length,
      units: lines.length,
      aov: sales.length ? Math.round(gross / sales.length) : 0,
      refunds,
      net: gross - refunds,
      margin: Math.round(lines.reduce((s, l) => s + l.net - l.item.cost, 0)),
      discounts: sales.reduce((s, o) => s + o.discount, 0) + lines.reduce((s, l) => s + l.item.discount, 0),
    },
    daily: dailySeries(orders, lines, startOfDay(from), Math.min(days, 400)),
    monthly: [...monthly.values()].sort((a, b) => a.sort - b.sort).map(({ month, sales: s, orders: o }) => ({ month, sales: s, orders: o })),
    byChannel: groupSum(sales, (o) => o.channel, (o) => o.total, (k) => CHANNEL_LABELS[k as SalesChannel]),
    byPayment: groupSum(rangePayments.filter((p) => p.kind === "PAYMENT" && p.method !== "STORE_CREDIT"), (p) => p.method, (p) => p.amount, (k) => PAYMENT_METHOD_LABELS[k as PaymentMethod]),
    topDesigns: designMetrics(lines, designById, availableByDesign).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    topColours: groupSum(lines, (l) => catalog.colours.find((c) => c.name === l.item.colourName)?.id ?? l.item.colourName, (l) => l.net, (k) => catalog.colourById.get(k)?.name ?? k)
      .slice(0, 10)
      .map((c) => ({ ...c, hex: colourHex(c.key) })),
    topFabrics: groupSum(lines, (l) => designById.get(l.item.designId)?.fabricId ?? "", (l) => l.net, (k) => catalog.fabricById.get(k)?.name ?? "Other"),
  };
}

export interface InventoryReport {
  totals: { pieces: number; cost: number; retail: number; designs: number };
  aging: AgingRow[];
  byFabric: (NamedValue & { cost: number; retail: number })[];
  byCategory: (NamedValue & { cost: number; retail: number })[];
  oldStock: { design: Design; pieces: number; oldestDays: number; cost: number; retail: number }[];
  fastMoving: (DesignMetric & { sellThrough: number })[];
  slowMoving: { design: Design; available: number; unitsSold90d: number; avgAgeDays: number; cost: number }[];
}

export async function getInventoryReport(): Promise<InventoryReport> {
  const r = repos();
  const t = now();
  const [inventory, designs, catalog, orders90, items90] = await Promise.all([
    r.inventory.list(),
    r.designs.list(),
    getCatalog(),
    r.orders.listSince(t - 90 * DAY_MS),
    r.orderItems.listSince(t - 90 * DAY_MS),
  ]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const stock = inStock(inventory);
  const lines = saleLines(orders90, items90);
  const lines30 = lines.filter((l) => l.order.createdAt >= t - 30 * DAY_MS);
  const availableByDesign = new Map<string, number>();
  for (const i of stock) availableByDesign.set(i.designId, (availableByDesign.get(i.designId) ?? 0) + 1);

  const group = (key: (i: InventoryItem) => string, name: (k: string) => string) => {
    const map = new Map<string, NamedValue & { cost: number; retail: number }>();
    for (const i of stock) {
      const k = key(i);
      const e = map.get(k) ?? { key: k, name: name(k), value: 0, count: 0, cost: 0, retail: 0 };
      e.count++;
      e.cost += i.cost;
      e.retail += effectivePrice(i, designById.get(i.designId)!);
      e.value = e.cost;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  };

  const oldMap = new Map<string, InventoryReport["oldStock"][number]>();
  const slowMap = new Map<string, { design: Design; available: number; ageSum: number; cost: number }>();
  for (const i of stock) {
    const design = designById.get(i.designId)!;
    const days = ageInDays(i.receivedAt, t);
    if (days > 180) {
      const e = oldMap.get(design.id) ?? { design, pieces: 0, oldestDays: 0, cost: 0, retail: 0 };
      e.pieces++;
      e.cost += i.cost;
      e.retail += effectivePrice(i, design);
      e.oldestDays = Math.max(e.oldestDays, days);
      oldMap.set(design.id, e);
    }
    const s = slowMap.get(design.id) ?? { design, available: 0, ageSum: 0, cost: 0 };
    s.available++;
    s.ageSum += days;
    s.cost += i.cost;
    slowMap.set(design.id, s);
  }
  const sold90 = new Map<string, number>();
  for (const l of lines) sold90.set(l.item.designId, (sold90.get(l.item.designId) ?? 0) + 1);

  const fast = designMetrics(lines30, designById, availableByDesign)
    .map((m) => ({ ...m, sellThrough: m.units / Math.max(1, m.units + m.available) }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  return {
    totals: {
      pieces: stock.length,
      cost: stock.reduce((s, i) => s + i.cost, 0),
      retail: stock.reduce((s, i) => s + effectivePrice(i, designById.get(i.designId)!), 0),
      designs: availableByDesign.size,
    },
    aging: agingRows(stock, designById, t),
    byFabric: group((i) => designById.get(i.designId)!.fabricId, (k) => catalog.fabricById.get(k)?.name ?? "Other"),
    byCategory: group((i) => designById.get(i.designId)!.categoryId, (k) => catalog.categoryById.get(k)?.name ?? "Other"),
    oldStock: [...oldMap.values()].sort((a, b) => b.cost - a.cost).slice(0, 15),
    fastMoving: fast,
    slowMoving: [...slowMap.values()]
      .map((s) => ({ design: s.design, available: s.available, unitsSold90d: sold90.get(s.design.id) ?? 0, avgAgeDays: Math.round(s.ageSum / s.available), cost: s.cost }))
      .filter((s) => s.unitsSold90d <= 1 && s.avgAgeDays > 45)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 15),
  };
}
