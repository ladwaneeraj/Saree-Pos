import { repos } from "@/data";
import { getCatalog } from "./catalog";

export type SearchKind = "INVENTORY" | "DESIGN" | "ORDER" | "CUSTOMER" | "SUPPLIER";

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  imageId: string | null;
}

/** Admin global search across SKUs, designs, colours, orders, customers, phones and suppliers. */
export async function globalSearch(query: string, limitPerKind = 6): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  if (q.length < 2) return [];
  const r = repos();
  const [items, designs, orders, customers, catalog] = await Promise.all([
    r.inventory.list(),
    r.designs.list(),
    r.orders.list(),
    r.customers.list(),
    getCatalog(),
  ]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const results: SearchResult[] = [];
  const digits = q.replace(/\D/g, "");

  const skuHits = items.filter((i) => i.sku.toLowerCase().includes(q)).slice(0, limitPerKind);
  const colourIds = new Set(catalog.colours.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id));
  const colourHits = skuHits.length < limitPerKind && colourIds.size
    ? items.filter((i) => colourIds.has(i.colourId) && i.status === "AVAILABLE").slice(0, limitPerKind - skuHits.length)
    : [];
  for (const item of [...skuHits, ...colourHits]) {
    const design = designById.get(item.designId);
    results.push({
      kind: "INVENTORY",
      id: item.id,
      title: item.sku,
      subtitle: `${design?.name ?? ""} · ${catalog.colourById.get(item.colourId)?.name ?? ""} · ${item.status.toLowerCase()} · ${item.location}`,
      href: `/inventory/item?sku=${item.sku}`,
      imageId: item.imageIds[0] ?? design?.imageIds[0] ?? null,
    });
  }

  for (const d of designs.filter((d) => `${d.name} ${d.code}`.toLowerCase().includes(q)).slice(0, limitPerKind)) {
    results.push({
      kind: "DESIGN",
      id: d.id,
      title: d.name,
      subtitle: `${d.code} · ${catalog.fabricById.get(d.fabricId)?.name ?? ""}`,
      href: `/designs/view?id=${d.id}`,
      imageId: d.imageIds[0] ?? null,
    });
  }

  const orderHits = orders
    .filter((o) => String(o.number).includes(q) || o.customer.name.toLowerCase().includes(q) || (digits.length >= 4 && o.customer.phone.includes(digits)))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limitPerKind);
  for (const o of orderHits) {
    results.push({ kind: "ORDER", id: o.id, title: `Order #${o.number}`, subtitle: `${o.customer.name} · ${o.channel.toLowerCase()} · ${o.status.replace(/_/g, " ").toLowerCase()}`, href: `/orders/view?number=${o.number}`, imageId: null });
  }

  for (const c of customers.filter((c) => c.name.toLowerCase().includes(q) || (digits.length >= 4 && c.phone.includes(digits)) || c.email.toLowerCase().includes(q)).slice(0, limitPerKind)) {
    results.push({ kind: "CUSTOMER", id: c.id, title: c.name, subtitle: `${c.phone} · ${c.stats.orderCount} orders`, href: `/customers/view?id=${c.id}`, imageId: null });
  }

  for (const s of catalog.suppliers.filter((s) => `${s.name} ${s.city} ${s.contactName}`.toLowerCase().includes(q)).slice(0, limitPerKind)) {
    results.push({ kind: "SUPPLIER", id: s.id, title: s.name, subtitle: `${s.city} · ${s.contactName}`, href: `/purchases?supplier=${s.id}`, imageId: null });
  }
  return results;
}
