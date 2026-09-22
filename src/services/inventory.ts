import { repos, transaction } from "@/data";
import type {
  Category,
  Colour,
  Design,
  Fabric,
  InventoryItem,
  InventoryMovement,
  InventoryStatus,
  Order,
  OrderItem,
  Purchase,
  Supplier,
} from "@/domain/types";
import { INVENTORY_STATUSES } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { effectiveMrp, effectivePrice, priceSource } from "@/domain/rules/pricing";
import { ageInDays, formatSku } from "@/domain/rules/inventory";
import { newId } from "@/lib/id";
import { recordAudit } from "./audit";
import { createDesignRecord, getCatalog, type DesignInput } from "./catalog";
import { currentActor, now } from "./context";
import { buildMovement, changeItems, loadItemsOrThrow } from "./inventory-core";

/* ------------------------------------------------------------------ */
/* Creating pieces                                                     */
/* ------------------------------------------------------------------ */

export type DesignRef = { designId: string } | { newDesign: DesignInput };

export interface NewPieceInput {
  design: DesignRef;
  colourId: string;
  cost: number;
  mrp: number;
  price: number;
  location: string;
  imageIds: string[];
  quantity?: number;
  /** Explicit SKU (imports from an older system). Omit to auto-generate. */
  sku?: string | null;
  notes?: string;
}

export type PieceSource = "QUICK_ADD" | "BULK" | "DUPLICATE" | "PURCHASE" | "IMPORT";

const SOURCE_LABEL: Record<PieceSource, string> = {
  QUICK_ADD: "Quick add",
  BULK: "Bulk photo entry",
  DUPLICATE: "Duplicate & change",
  PURCHASE: "Purchase receiving",
  IMPORT: "CSV import",
};

export interface CreatePiecesOptions {
  source: PieceSource;
  purchase?: Pick<Purchase, "id" | "number" | "supplierId"> | null;
  receivedAt?: number;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

/** Resolves existing designs and creates new ones (once per name) for a batch of inputs. Inside a transaction. */
export async function resolvePieceDesigns(inputs: NewPieceInput[]): Promise<Design[]> {
  const r = repos();
  const created = new Map<string, Design>();
  const result: Design[] = [];
  for (const input of inputs) {
    if ("designId" in input.design) {
      const design = await r.designs.get(input.design.designId);
      if (!design) throw new DomainError("Selected design no longer exists");
      result.push(design);
      continue;
    }
    const spec = input.design.newDesign;
    const key = spec.name.trim().toLowerCase();
    let design = created.get(key) ?? (await r.designs.findByName(spec.name));
    if (!design) {
      const siblings = inputs.filter((i) => "newDesign" in i.design && i.design.newDesign.name.trim().toLowerCase() === key);
      design = await createDesignRecord({
        ...spec,
        price: mode(siblings.map((s) => s.price)),
        mrp: mode(siblings.map((s) => s.mrp)),
        collectionIds: [...new Set(siblings.flatMap((s) => ("newDesign" in s.design ? s.design.newDesign.collectionIds : [])))],
        imageIds: spec.imageIds?.length ? spec.imageIds : siblings.find((s) => s.imageIds.length)?.imageIds.slice(0, 1) ?? [],
      });
      created.set(key, design);
    }
    result.push(design);
  }
  return result;
}

function validatePieceInput(input: NewPieceInput, index: number): void {
  const row = `Row ${index + 1}`;
  if (!input.colourId) throw new DomainError(`${row}: colour is required`);
  if (!(input.price > 0)) throw new DomainError(`${row}: selling price is required`);
  if (!(input.mrp > 0)) throw new DomainError(`${row}: MRP is required`);
  if (input.price > input.mrp) throw new DomainError(`${row}: selling price cannot be above MRP`);
  if (!(input.cost >= 0)) throw new DomainError(`${row}: purchase cost is required`);
  if ((input.quantity ?? 1) < 1 || (input.quantity ?? 1) > 500) throw new DomainError(`${row}: quantity must be between 1 and 500`);
}

/** Creates physical pieces with fresh SKUs. Must run inside a transaction. */
export async function createPiecesInTx(inputs: NewPieceInput[], options: CreatePiecesOptions): Promise<InventoryItem[]> {
  if (inputs.length === 0) return [];
  inputs.forEach(validatePieceInput);
  const r = repos();
  const actor = currentActor();
  const designs = await resolvePieceDesigns(inputs);
  const explicitSkus = inputs.filter((i) => i.sku).map((i) => i.sku!.trim().toUpperCase());
  if (new Set(explicitSkus).size !== explicitSkus.length) throw new DomainError("Duplicate SKUs in the batch");
  for (const sku of explicitSkus) {
    if (await r.inventory.findBySku(sku)) throw new DomainError(`SKU ${sku} already exists`);
  }

  const generatedCount = inputs.reduce((sum, i) => sum + (i.sku ? 0 : (i.quantity ?? 1)), 0);
  let nextSku = generatedCount ? await r.counters.next("sku", generatedCount) : 0;
  const t = now();
  const receivedAt = options.receivedAt ?? t;
  const items: InventoryItem[] = [];
  const movements: InventoryMovement[] = [];

  inputs.forEach((input, i) => {
    const design = designs[i]!;
    const qty = input.sku ? 1 : (input.quantity ?? 1);
    for (let n = 0; n < qty; n++) {
      const item: InventoryItem = {
        id: newId("itm"),
        sku: input.sku ? input.sku.trim().toUpperCase() : formatSku(nextSku++),
        designId: design.id,
        colourId: input.colourId,
        cost: Math.round(input.cost),
        mrpOverride: Math.round(input.mrp) === design.mrp ? null : Math.round(input.mrp),
        priceOverride: Math.round(input.price) === design.price ? null : Math.round(input.price),
        location: input.location.trim() || "Unassigned",
        status: "AVAILABLE",
        imageIds: input.imageIds,
        purchaseId: options.purchase?.id ?? null,
        supplierId: options.purchase?.supplierId ?? null,
        receivedAt,
        reservation: null,
        holderId: null,
        soldAt: null,
        soldOrderId: null,
        notes: input.notes ?? "",
        createdAt: t,
        updatedAt: t,
      };
      items.push(item);
      if (options.purchase) {
        movements.push({
          ...buildMovement(item, { type: "PURCHASED", refType: "PURCHASE", refId: options.purchase.id, refLabel: options.purchase.number }, actor, receivedAt, null),
          quantityDelta: 1,
        });
        movements.push({
          ...buildMovement(item, { type: "RECEIVED", note: `Shelved at ${item.location}` }, actor, receivedAt + 1, "AVAILABLE"),
          quantityDelta: 0,
        });
      } else {
        movements.push({
          ...buildMovement(item, { type: "RECEIVED", note: `${SOURCE_LABEL[options.source]} · shelved at ${item.location}` }, actor, receivedAt, null),
          quantityDelta: 1,
        });
      }
    }
  });

  await r.inventory.bulkAdd(items);
  await r.movements.bulkAdd(movements);
  const skuRange = items.length === 1 ? items[0]!.sku : `${items[0]!.sku} – ${items[items.length - 1]!.sku}`;
  await recordAudit({
    action: "INVENTORY_ADDED",
    entityType: "INVENTORY",
    entityId: options.purchase?.id ?? items[0]!.id,
    entityLabel: skuRange,
    summary: `${items.length} piece${items.length === 1 ? "" : "s"} added via ${SOURCE_LABEL[options.source]}`,
    actor,
  });
  return items;
}

export async function createPieces(inputs: NewPieceInput[], options: CreatePiecesOptions): Promise<InventoryItem[]> {
  assertPermission(currentActor(), "inventory:edit");
  return transaction(() => createPiecesInTx(inputs, options));
}

export async function peekNextSkus(count: number): Promise<string[]> {
  const start = await repos().counters.peek("sku");
  return Array.from({ length: count }, (_, i) => formatSku(start + i));
}

/* ------------------------------------------------------------------ */
/* Querying                                                            */
/* ------------------------------------------------------------------ */

export interface InventoryRow {
  item: InventoryItem;
  design: Design;
  colour: Colour | undefined;
  fabric: Fabric | undefined;
  category: Category | undefined;
  collectionNames: string[];
  price: number;
  mrp: number;
  priceSource: "DESIGN" | "OVERRIDE";
  imageId: string | null;
  ageDays: number;
}

export type InventorySortKey = "sku" | "design" | "price" | "cost" | "updatedAt" | "receivedAt" | "status" | "location" | "colour";

export interface InventoryQuery {
  q?: string;
  status?: InventoryStatus | "ALL" | "IN_STOCK";
  categoryId?: string;
  fabricId?: string;
  colourId?: string;
  collectionId?: string;
  location?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  addedWithinDays?: number | null;
  designId?: string;
  purchaseId?: string;
  sortKey?: InventorySortKey;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface InventoryPage {
  rows: InventoryRow[];
  total: number;
  statusCounts: Record<InventoryStatus, number>;
  locations: string[];
}

export async function searchInventory(query: InventoryQuery): Promise<InventoryPage> {
  const r = repos();
  const [items, designs, catalog] = await Promise.all([
    query.designId ? r.inventory.listByDesign(query.designId) : query.purchaseId ? r.inventory.listByPurchase(query.purchaseId) : r.inventory.list(),
    r.designs.list(),
    getCatalog(),
  ]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  const t = now();
  const q = query.q?.trim().toLowerCase() ?? "";
  const statusCounts = Object.fromEntries(INVENTORY_STATUSES.map((s) => [s, 0])) as Record<InventoryStatus, number>;
  const locations = new Set<string>();
  const rows: InventoryRow[] = [];

  for (const item of items) {
    const design = designById.get(item.designId);
    if (!design) continue;
    const colour = catalog.colourById.get(item.colourId);
    const fabric = catalog.fabricById.get(design.fabricId);
    const price = effectivePrice(item, design);

    // Filters other than status first, so status counts reflect the other filters.
    if (query.categoryId && design.categoryId !== query.categoryId) continue;
    if (query.fabricId && design.fabricId !== query.fabricId) continue;
    if (query.colourId && item.colourId !== query.colourId) continue;
    if (query.collectionId && !design.collectionIds.includes(query.collectionId)) continue;
    if (query.location && item.location !== query.location) continue;
    if (query.minPrice != null && price < query.minPrice) continue;
    if (query.maxPrice != null && price > query.maxPrice) continue;
    if (query.addedWithinDays && t - item.receivedAt > query.addedWithinDays * 86_400_000) continue;
    if (q) {
      const hay = `${item.sku} ${design.name} ${design.code} ${colour?.name ?? ""} ${fabric?.name ?? ""} ${item.location}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    locations.add(item.location);
    statusCounts[item.status]++;
    if (query.status === "IN_STOCK" && item.status !== "AVAILABLE" && item.status !== "RESERVED") continue;
    if (query.status && query.status !== "ALL" && query.status !== "IN_STOCK" && item.status !== query.status) continue;

    rows.push({
      item,
      design,
      colour,
      fabric,
      category: catalog.categoryById.get(design.categoryId),
      collectionNames: design.collectionIds.map((id) => catalog.collectionById.get(id)?.name ?? "").filter(Boolean),
      price,
      mrp: effectiveMrp(item, design),
      priceSource: priceSource(item),
      imageId: item.imageIds[0] ?? design.imageIds[0] ?? null,
      ageDays: ageInDays(item.receivedAt, t),
    });
  }

  const dir = query.sortDir === "asc" ? 1 : -1;
  const key = query.sortKey ?? "updatedAt";
  const value = (row: InventoryRow): string | number => {
    switch (key) {
      case "sku": return row.item.sku;
      case "design": return row.design.name;
      case "price": return row.price;
      case "cost": return row.item.cost;
      case "receivedAt": return row.item.receivedAt;
      case "status": return row.item.status;
      case "location": return row.item.location;
      case "colour": return row.colour?.name ?? "";
      default: return row.item.updatedAt;
    }
  };
  rows.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "en", { numeric: true });
    return cmp * dir || a.item.sku.localeCompare(b.item.sku);
  });

  const pageSize = query.pageSize ?? 25;
  const page = Math.max(1, query.page ?? 1);
  return {
    rows: Number.isFinite(pageSize) ? rows.slice((page - 1) * pageSize, page * pageSize) : rows,
    total: rows.length,
    statusCounts,
    locations: [...locations].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
  };
}

export interface InventoryDetail {
  item: InventoryItem;
  design: Design;
  colour: Colour | undefined;
  fabric: Fabric | undefined;
  category: Category | undefined;
  collectionNames: string[];
  supplier: Supplier | undefined;
  purchase: Purchase | undefined;
  price: number;
  mrp: number;
  priceSource: "DESIGN" | "OVERRIDE";
  imageIds: string[];
  usesDesignImages: boolean;
  movements: InventoryMovement[];
  sales: { orderItem: OrderItem; order: Order | undefined }[];
  ageDays: number;
}

export async function getInventoryDetail(idOrSku: string): Promise<InventoryDetail | null> {
  const r = repos();
  const item = (await r.inventory.get(idOrSku)) ?? (await r.inventory.findBySku(idOrSku));
  if (!item) return null;
  const [design, catalog, movements, orderItems, purchase] = await Promise.all([
    r.designs.get(item.designId),
    getCatalog(),
    r.movements.listByItem(item.id),
    r.orderItems.listByInventoryItem(item.id),
    item.purchaseId ? r.purchases.get(item.purchaseId) : Promise.resolve(undefined),
  ]);
  if (!design) return null;
  const orders = await r.orders.getMany(orderItems.map((oi) => oi.orderId));
  const orderById = new Map(orders.map((o) => [o.id, o]));
  return {
    item,
    design,
    colour: catalog.colourById.get(item.colourId),
    fabric: catalog.fabricById.get(design.fabricId),
    category: catalog.categoryById.get(design.categoryId),
    collectionNames: design.collectionIds.map((id) => catalog.collectionById.get(id)?.name ?? "").filter(Boolean),
    supplier: item.supplierId ? catalog.supplierById.get(item.supplierId) : undefined,
    purchase,
    price: effectivePrice(item, design),
    mrp: effectiveMrp(item, design),
    priceSource: priceSource(item),
    imageIds: item.imageIds.length ? item.imageIds : design.imageIds,
    usesDesignImages: item.imageIds.length === 0,
    movements,
    sales: orderItems.map((orderItem) => ({ orderItem, order: orderById.get(orderItem.orderId) })),
    ageDays: ageInDays(item.receivedAt, now()),
  };
}

/* ------------------------------------------------------------------ */
/* Stock summaries per design                                          */
/* ------------------------------------------------------------------ */

export interface ColourStock {
  colourId: string;
  available: number;
  /** Oldest available piece, sold first (FIFO). */
  firstAvailableItemId: string | null;
  imageIds: string[];
}

export interface DesignStock {
  designId: string;
  available: number;
  reserved: number;
  sold: number;
  damaged: number;
  returned: number;
  colours: ColourStock[];
  /** Photos of available pieces, used to enrich the design gallery. */
  pieceImageIds: string[];
}

export function emptyDesignStock(designId: string): DesignStock {
  return { designId, available: 0, reserved: 0, sold: 0, damaged: 0, returned: 0, colours: [], pieceImageIds: [] };
}

export function summarizeStock(items: InventoryItem[]): Map<string, DesignStock> {
  const map = new Map<string, DesignStock>();
  const sorted = [...items].sort((a, b) => a.receivedAt - b.receivedAt);
  for (const item of sorted) {
    let s = map.get(item.designId);
    if (!s) map.set(item.designId, (s = emptyDesignStock(item.designId)));
    switch (item.status) {
      case "AVAILABLE": s.available++; break;
      case "RESERVED": s.reserved++; break;
      case "SOLD": s.sold++; break;
      case "DAMAGED": s.damaged++; break;
      case "RETURNED": s.returned++; break;
    }
    if (item.status !== "AVAILABLE") continue;
    let c = s.colours.find((x) => x.colourId === item.colourId);
    if (!c) s.colours.push((c = { colourId: item.colourId, available: 0, firstAvailableItemId: item.id, imageIds: [] }));
    c.available++;
    for (const img of item.imageIds) {
      if (!c.imageIds.includes(img)) c.imageIds.push(img);
      if (!s.pieceImageIds.includes(img)) s.pieceImageIds.push(img);
    }
  }
  return map;
}

export async function getDesignStockMap(): Promise<Map<string, DesignStock>> {
  return summarizeStock(await repos().inventory.list());
}

export async function getDesignStock(designId: string): Promise<DesignStock> {
  return summarizeStock(await repos().inventory.listByDesign(designId)).get(designId) ?? emptyDesignStock(designId);
}

/* ------------------------------------------------------------------ */
/* Editing pieces                                                      */
/* ------------------------------------------------------------------ */

export interface PieceEdit {
  colourId?: string;
  cost?: number;
  mrp?: number;
  location?: string;
  notes?: string;
}

export async function updatePiece(itemId: string, edit: PieceEdit): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "inventory:edit");
  await transaction(async () => {
    const r = repos();
    const item = await r.inventory.get(itemId);
    if (!item) throw new DomainError("Piece not found");
    const design = await r.designs.get(item.designId);
    if (!design) throw new DomainError("Design not found");
    const changes: Partial<InventoryItem> = {};
    const notes: string[] = [];
    if (edit.colourId && edit.colourId !== item.colourId) {
      changes.colourId = edit.colourId;
      notes.push("colour");
    }
    if (edit.cost !== undefined && edit.cost !== item.cost) {
      changes.cost = Math.round(edit.cost);
      notes.push(`cost ₹${item.cost} → ₹${changes.cost}`);
    }
    if (edit.mrp !== undefined && edit.mrp !== effectiveMrp(item, design)) {
      changes.mrpOverride = edit.mrp === design.mrp ? null : Math.round(edit.mrp);
      notes.push(`MRP ₹${effectiveMrp(item, design)} → ₹${edit.mrp}`);
    }
    if (edit.notes !== undefined && edit.notes !== item.notes) changes.notes = edit.notes;
    const locationChanged = edit.location !== undefined && edit.location.trim() && edit.location.trim() !== item.location;
    if (Object.keys(changes).length) {
      const updated = { ...item, ...changes, updatedAt: now() };
      await r.inventory.put(updated);
      if (notes.length) await r.movements.add(buildMovement(updated, { type: "EDITED", note: notes.join(", ") }, actor, now(), item.status));
    }
    if (locationChanged) {
      const fresh = (await r.inventory.get(itemId))!;
      await changeItems([fresh], { type: "LOCATION_CHANGED", location: edit.location!.trim(), note: `${item.location} → ${edit.location!.trim()}` }, actor);
      notes.push(`location ${item.location} → ${edit.location!.trim()}`);
    }
    if (notes.length) {
      await recordAudit({
        action: "INVENTORY_EDITED",
        entityType: "INVENTORY",
        entityId: item.id,
        entityLabel: item.sku,
        summary: `Edited ${notes.join(", ")}`,
        actor,
      });
    }
  });
}

export async function moveItems(itemIds: string[], location: string): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "inventory:edit");
  const target = location.trim();
  if (!target) throw new DomainError("Enter a rack or location");
  await transaction(async () => {
    const items = (await loadItemsOrThrow(itemIds)).filter((i) => i.location !== target);
    await changeItems(items, { type: "LOCATION_CHANGED", location: target, note: `Moved to ${target}` }, actor);
    if (items.length) {
      await recordAudit({
        action: "INVENTORY_ADJUSTED",
        entityType: "INVENTORY",
        entityId: items[0]!.id,
        entityLabel: items.length === 1 ? items[0]!.sku : `${items.length} pieces`,
        summary: `Moved ${items.length} piece${items.length === 1 ? "" : "s"} to ${target}`,
        actor,
      });
    }
  });
}

export async function markDamaged(itemIds: string[], note: string): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "inventory:edit");
  await transaction(async () => {
    const items = await loadItemsOrThrow(itemIds);
    const blocked = items.find((i) => i.status !== "AVAILABLE");
    if (blocked) throw new DomainError(`${blocked.sku} is ${blocked.status.toLowerCase()} and cannot be marked damaged here`);
    await changeItems(items, { type: "MARKED_DAMAGED", status: "DAMAGED", note: note || "Marked damaged" }, actor);
    await recordAudit({
      action: "INVENTORY_ADJUSTED",
      entityType: "INVENTORY",
      entityId: items[0]!.id,
      entityLabel: items.map((i) => i.sku).slice(0, 3).join(", ") + (items.length > 3 ? "…" : ""),
      summary: `Marked ${items.length} piece${items.length === 1 ? "" : "s"} damaged${note ? `: ${note}` : ""}`,
      actor,
    });
  });
}

export async function restoreDamaged(itemId: string, note: string): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "pricing:edit");
  await transaction(async () => {
    const [item] = await loadItemsOrThrow([itemId]);
    if (item!.status !== "DAMAGED") throw new DomainError(`${item!.sku} is not marked damaged`);
    await changeItems([item!], { type: "RESTORED", status: "AVAILABLE", note: note || "Repaired and restocked" }, actor);
    await recordAudit({
      action: "INVENTORY_ADJUSTED",
      entityType: "INVENTORY",
      entityId: item!.id,
      entityLabel: item!.sku,
      summary: "Restored from damaged to available",
      actor,
    });
  });
}

export async function setPieceImages(itemId: string, imageIds: string[]): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "inventory:edit");
  await transaction(async () => {
    const item = await repos().inventory.get(itemId);
    if (!item) throw new DomainError("Piece not found");
    await repos().inventory.update(itemId, { imageIds, updatedAt: now() });
    await recordAudit({
      action: "INVENTORY_EDITED",
      entityType: "INVENTORY",
      entityId: item.id,
      entityLabel: item.sku,
      summary: `Photos updated (${item.imageIds.length} → ${imageIds.length})`,
      actor,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Labels                                                              */
/* ------------------------------------------------------------------ */

export interface LabelData {
  itemId: string;
  sku: string;
  designName: string;
  fabricName: string;
  colourName: string;
}

/** Label payload. Deliberately has no price: the barcode encodes the SKU only. */
export async function getLabels(itemIds: string[]): Promise<LabelData[]> {
  const r = repos();
  const [items, catalog] = await Promise.all([r.inventory.getMany(itemIds), getCatalog()]);
  const designs = await r.designs.getMany([...new Set(items.map((i) => i.designId))]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  return items.map((item) => {
    const design = designById.get(item.designId);
    return {
      itemId: item.id,
      sku: item.sku,
      designName: design?.name ?? "",
      fabricName: design ? (catalog.fabricById.get(design.fabricId)?.name ?? "") : "",
      colourName: catalog.colourById.get(item.colourId)?.name ?? "",
    };
  });
}

export async function findItemIdsBySkus(skus: string[]): Promise<string[]> {
  const found = await Promise.all(skus.map((s) => repos().inventory.findBySku(s)));
  return found.filter((i): i is InventoryItem => !!i).map((i) => i.id);
}
