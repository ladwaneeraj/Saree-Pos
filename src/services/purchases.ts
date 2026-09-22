import { repos, transaction } from "@/data";
import type { InventoryItem, Purchase, PurchaseItem, Supplier } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { newId } from "@/lib/id";
import { formatINR } from "@/lib/format";
import { recordAudit } from "./audit";
import { ensureCollection, ensureColour, getCatalog, type DesignInput } from "./catalog";
import { currentActor, now } from "./context";
import { createPiecesInTx, resolvePieceDesigns, type NewPieceInput } from "./inventory";

export interface PurchaseRow {
  purchase: Purchase;
  supplier: Supplier | undefined;
}

export async function listPurchases(): Promise<PurchaseRow[]> {
  const [purchases, catalog] = await Promise.all([repos().purchases.list(), getCatalog()]);
  return purchases
    .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)
    .map((purchase) => ({ purchase, supplier: catalog.supplierById.get(purchase.supplierId) }));
}

export interface DesignOption {
  id: string;
  name: string;
  code: string;
  fabricId: string;
  mrp: number;
  price: number;
  imageId: string | null;
}

/** Lightweight design list for purchase line pickers. */
export async function listDesignOptions(): Promise<DesignOption[]> {
  const designs = await repos().designs.list();
  return designs
    .map((d) => ({ id: d.id, name: d.name, code: d.code, fabricId: d.fabricId, mrp: d.mrp, price: d.price, imageId: d.imageIds[0] ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface PurchaseDetail {
  purchase: Purchase;
  supplier: Supplier | undefined;
  lines: (PurchaseItem & { designName: string; colourName: string })[];
  pieces: InventoryItem[];
}

export async function getPurchaseDetail(purchaseId: string): Promise<PurchaseDetail | null> {
  const r = repos();
  const purchase = await r.purchases.get(purchaseId);
  if (!purchase) return null;
  const [lines, pieces, catalog] = await Promise.all([r.purchaseItems.listByPurchase(purchaseId), r.inventory.listByPurchase(purchaseId), getCatalog()]);
  const designs = await r.designs.getMany([...new Set(lines.map((l) => l.designId))]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  return {
    purchase,
    supplier: catalog.supplierById.get(purchase.supplierId),
    lines: lines.map((l) => ({ ...l, designName: designById.get(l.designId)?.name ?? "", colourName: catalog.colourById.get(l.colourId)?.name ?? "" })),
    pieces: pieces.sort((a, b) => a.sku.localeCompare(b.sku, "en", { numeric: true })),
  };
}

export interface PurchaseLineInput {
  design: { designId: string } | { newDesign: DesignInput };
  colourId: string;
  quantity: number;
  cost: number;
  mrp: number;
  price: number;
  location: string;
}

export interface PurchaseInput {
  supplierId: string;
  invoiceNumber: string;
  date: number;
  notes: string;
  lines: PurchaseLineInput[];
}

async function nextPurchaseNumber(): Promise<string> {
  const seq = await repos().counters.next("purchase");
  return `PO-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

function validate(input: PurchaseInput): void {
  if (!input.supplierId) throw new DomainError("Choose a supplier");
  if (!input.invoiceNumber.trim()) throw new DomainError("Enter the supplier invoice number");
  if (input.lines.length === 0) throw new DomainError("Add at least one line");
}

/**
 * Creates a purchase. With `receiveNow`, stock is received immediately: one inventory piece
 * with its own SKU per unit, plus PURCHASED and RECEIVED movements.
 */
export async function createPurchase(input: PurchaseInput, receiveNow: boolean): Promise<{ purchase: Purchase; items: InventoryItem[] }> {
  const actor = currentActor();
  assertPermission(actor, "purchases:manage");
  validate(input);
  return transaction(async () => {
    const r = repos();
    const t = now();
    const draftInputs: NewPieceInput[] = input.lines.map((l) => ({
      design: l.design,
      colourId: l.colourId,
      cost: l.cost,
      mrp: l.mrp,
      price: l.price,
      location: l.location,
      imageIds: [],
      quantity: l.quantity,
    }));
    // Create any new designs up front so draft purchase lines always point at real designs.
    const designs = await resolvePieceDesigns(draftInputs);
    const pieceInputs = draftInputs.map((p, i) => ({ ...p, design: { designId: designs[i]!.id } }));
    const purchase: Purchase = {
      id: newId("pur"),
      number: await nextPurchaseNumber(),
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber.trim(),
      date: input.date,
      status: "DRAFT",
      pieceCount: input.lines.reduce((s, l) => s + l.quantity, 0),
      totalCost: input.lines.reduce((s, l) => s + l.quantity * l.cost, 0),
      notes: input.notes,
      receivedAt: null,
      createdAt: t,
      updatedAt: t,
    };
    await r.purchases.add(purchase);
    await r.purchaseItems.bulkAdd(
      input.lines.map((line, i) => ({
        id: newId("pli"),
        purchaseId: purchase.id,
        designId: designs[i]!.id,
        colourId: line.colourId,
        quantity: line.quantity,
        cost: line.cost,
        mrp: line.mrp,
        price: line.price,
        location: line.location,
        createdAt: t + i,
      })),
    );
    const items = receiveNow ? await createPiecesInTx(pieceInputs, { source: "PURCHASE", purchase }) : [];

    if (receiveNow) {
      const received = { ...purchase, status: "RECEIVED" as const, receivedAt: t, updatedAt: t };
      await r.purchases.put(received);
      await recordAudit({
        action: "PURCHASE_RECEIVED",
        entityType: "PURCHASE",
        entityId: purchase.id,
        entityLabel: `${purchase.number} · ${purchase.invoiceNumber}`,
        summary: `Received ${items.length} pieces worth ${formatINR(purchase.totalCost)}`,
        actor,
      });
      return { purchase: received, items };
    }
    return { purchase, items };
  });
}

export async function receivePurchase(purchaseId: string): Promise<InventoryItem[]> {
  const actor = currentActor();
  assertPermission(actor, "purchases:manage");
  return transaction(async () => {
    const r = repos();
    const purchase = await r.purchases.get(purchaseId);
    if (!purchase) throw new DomainError("Purchase not found");
    if (purchase.status !== "DRAFT") throw new DomainError(`${purchase.number} is already ${purchase.status.toLowerCase()}`);
    const lines = await r.purchaseItems.listByPurchase(purchaseId);
    const items = await createPiecesInTx(
      lines.map((l) => ({ design: { designId: l.designId }, colourId: l.colourId, cost: l.cost, mrp: l.mrp, price: l.price, location: l.location, imageIds: [], quantity: l.quantity })),
      { source: "PURCHASE", purchase },
    );
    const t = now();
    await r.purchases.update(purchaseId, { status: "RECEIVED", receivedAt: t, updatedAt: t });
    await recordAudit({
      action: "PURCHASE_RECEIVED",
      entityType: "PURCHASE",
      entityId: purchase.id,
      entityLabel: `${purchase.number} · ${purchase.invoiceNumber}`,
      summary: `Received ${items.length} pieces worth ${formatINR(purchase.totalCost)}`,
      actor,
    });
    return items;
  });
}

export async function cancelPurchase(purchaseId: string): Promise<void> {
  assertPermission(currentActor(), "purchases:manage");
  await transaction(async () => {
    const purchase = await repos().purchases.get(purchaseId);
    if (!purchase || purchase.status !== "DRAFT") throw new DomainError("Only draft purchases can be cancelled");
    await repos().purchases.update(purchaseId, { status: "CANCELLED", updatedAt: now() });
  });
}

/* ------------------------------------------------------------------ */
/* CSV / Excel import                                                  */
/* ------------------------------------------------------------------ */

export const IMPORT_COLUMNS = ["sku", "design", "colour", "fabric", "collection", "quantity", "cost", "mrp", "price", "rack"] as const;
export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type ImportRow = Record<ImportColumn, string> & { _id: string };

export type ImportIssueKind = "MISSING" | "DUPLICATE_SKU" | "INVALID_PRICE" | "UNKNOWN_FABRIC";
export interface ImportIssue {
  kind: ImportIssueKind;
  column: ImportColumn;
  message: string;
}

const HEADER_ALIASES: Record<string, ImportColumn> = {
  sku: "sku", code: "sku", barcode: "sku",
  design: "design", "design name": "design", product: "design", name: "design",
  colour: "colour", color: "colour",
  fabric: "fabric", material: "fabric",
  collection: "collection",
  quantity: "quantity", qty: "quantity", pieces: "quantity",
  cost: "cost", "purchase cost": "cost", "purchase price": "cost", "cost price": "cost",
  mrp: "mrp",
  price: "price", "selling price": "price", "sale price": "price", selling: "price",
  rack: "rack", location: "rack", "rack/location": "rack",
};

/** Maps spreadsheet rows (first row = headers) onto import columns. Unknown columns are ignored. */
export function mapImportTable(table: string[][]): { rows: ImportRow[]; unmapped: string[] } {
  const [header, ...body] = table;
  if (!header) return { rows: [], unmapped: [] };
  const mapping = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
  const unmapped = header.filter((_, i) => !mapping[i]).filter(Boolean);
  const rows = body
    .filter((cells) => cells.some((c) => String(c ?? "").trim()))
    .map((cells) => {
      const row = Object.fromEntries(IMPORT_COLUMNS.map((c) => [c, ""])) as Record<ImportColumn, string>;
      mapping.forEach((col, i) => {
        if (col) row[col] = String(cells[i] ?? "").trim();
      });
      if (!row.quantity) row.quantity = "1";
      return { ...row, _id: newId("imp") };
    });
  return { rows, unmapped };
}

function parseAmount(value: string): number | null {
  const n = Number(value.replace(/[₹,\s]/g, ""));
  return value.trim() && Number.isFinite(n) ? n : null;
}

export async function validateImportRows(rows: ImportRow[]): Promise<Map<string, ImportIssue[]>> {
  const r = repos();
  const catalog = await getCatalog();
  const designs = await r.designs.list();
  const designNames = new Set(designs.map((d) => d.name.toLowerCase()));
  const fabricNames = new Set(catalog.fabrics.map((f) => f.name.toLowerCase()));
  const skuCounts = new Map<string, number>();
  for (const row of rows) if (row.sku) skuCounts.set(row.sku.toUpperCase(), (skuCounts.get(row.sku.toUpperCase()) ?? 0) + 1);
  const existingSkus = new Set<string>();
  for (const sku of skuCounts.keys()) if (await r.inventory.findBySku(sku)) existingSkus.add(sku);

  const result = new Map<string, ImportIssue[]>();
  for (const row of rows) {
    const issues: ImportIssue[] = [];
    const missing = (column: ImportColumn, label: string) => issues.push({ kind: "MISSING", column, message: `${label} is missing` });
    if (!row.design) missing("design", "Design");
    if (!row.colour) missing("colour", "Colour");
    const isNewDesign = row.design && !designNames.has(row.design.toLowerCase());
    if (isNewDesign && !row.fabric) missing("fabric", "Fabric (needed for a new design)");
    if (row.fabric && !fabricNames.has(row.fabric.toLowerCase())) issues.push({ kind: "UNKNOWN_FABRIC", column: "fabric", message: `Unknown fabric "${row.fabric}"` });
    const sku = row.sku.toUpperCase();
    if (sku && (skuCounts.get(sku) ?? 0) > 1) issues.push({ kind: "DUPLICATE_SKU", column: "sku", message: `SKU ${sku} appears more than once in the file` });
    if (sku && existingSkus.has(sku)) issues.push({ kind: "DUPLICATE_SKU", column: "sku", message: `SKU ${sku} already exists in inventory` });
    if (sku && Number(row.quantity) > 1) issues.push({ kind: "DUPLICATE_SKU", column: "quantity", message: "A row with an SKU must have quantity 1" });
    const qty = Number(row.quantity);
    if (!Number.isInteger(qty) || qty < 1) issues.push({ kind: "MISSING", column: "quantity", message: "Quantity must be a whole number" });
    const cost = parseAmount(row.cost);
    const mrp = parseAmount(row.mrp);
    const price = parseAmount(row.price);
    if (cost === null) missing("cost", "Cost");
    else if (cost < 0) issues.push({ kind: "INVALID_PRICE", column: "cost", message: "Cost cannot be negative" });
    if (mrp === null) missing("mrp", "MRP");
    else if (mrp <= 0) issues.push({ kind: "INVALID_PRICE", column: "mrp", message: "MRP must be above zero" });
    if (price === null) missing("price", "Selling price");
    else if (price <= 0) issues.push({ kind: "INVALID_PRICE", column: "price", message: "Selling price must be above zero" });
    if (price !== null && mrp !== null && price > mrp) issues.push({ kind: "INVALID_PRICE", column: "price", message: "Selling price is above MRP" });
    if (price !== null && cost !== null && cost > price) issues.push({ kind: "INVALID_PRICE", column: "cost", message: "Cost is above selling price" });
    result.set(row._id, issues);
  }
  return result;
}

export async function importPurchaseRows(input: { supplierId: string; invoiceNumber: string; date: number; rows: ImportRow[] }): Promise<{ purchase: Purchase; items: InventoryItem[] }> {
  const actor = currentActor();
  assertPermission(actor, "purchases:manage");
  const issues = await validateImportRows(input.rows);
  const invalid = input.rows.filter((row) => (issues.get(row._id) ?? []).length > 0);
  if (invalid.length) throw new DomainError(`${invalid.length} row${invalid.length === 1 ? " has" : "s have"} problems. Fix them before importing.`);
  if (!input.supplierId) throw new DomainError("Choose a supplier");
  if (!input.invoiceNumber.trim()) throw new DomainError("Enter the supplier invoice number");

  return transaction(async () => {
    const r = repos();
    const catalog = await getCatalog();
    const t = now();
    const purchase: Purchase = {
      id: newId("pur"),
      number: await nextPurchaseNumber(),
      supplierId: input.supplierId,
      invoiceNumber: input.invoiceNumber.trim(),
      date: input.date,
      status: "RECEIVED",
      pieceCount: 0,
      totalCost: 0,
      notes: `Imported ${input.rows.length} rows`,
      receivedAt: t,
      createdAt: t,
      updatedAt: t,
    };
    await r.purchases.add(purchase);

    const pieceInputs: NewPieceInput[] = [];
    for (const row of input.rows) {
      const colour = await ensureColour(row.colour);
      const existing = await r.designs.findByName(row.design);
      const fabric = catalog.fabrics.find((f) => f.name.toLowerCase() === row.fabric.toLowerCase());
      const collection = row.collection ? await ensureCollection(row.collection) : null;
      const cost = parseAmount(row.cost)!;
      const mrp = parseAmount(row.mrp)!;
      const price = parseAmount(row.price)!;
      pieceInputs.push({
        design: existing
          ? { designId: existing.id }
          : { newDesign: { name: row.design, fabricId: fabric!.id, collectionIds: collection ? [collection.id] : [], mrp, price } },
        colourId: colour.id,
        cost,
        mrp,
        price,
        location: row.rack,
        imageIds: [],
        quantity: row.sku ? 1 : Number(row.quantity),
        sku: row.sku || null,
      });
    }
    const items = await createPiecesInTx(pieceInputs, { source: "IMPORT", purchase });
    // createPiecesInTx returns pieces in input order, expanded by quantity.
    let offset = 0;
    const lines: PurchaseItem[] = pieceInputs.map((p, i) => {
      const first = items[offset]!;
      offset += p.sku ? 1 : (p.quantity ?? 1);
      return { id: newId("pli"), purchaseId: purchase.id, designId: first.designId, colourId: p.colourId, quantity: p.sku ? 1 : (p.quantity ?? 1), cost: p.cost, mrp: p.mrp, price: p.price, location: p.location, createdAt: t + i };
    });
    await r.purchaseItems.bulkAdd(lines);
    const final = { ...purchase, pieceCount: items.length, totalCost: items.reduce((s, i) => s + i.cost, 0) };
    await r.purchases.put(final);
    await recordAudit({
      action: "DATA_IMPORTED",
      entityType: "PURCHASE",
      entityId: purchase.id,
      entityLabel: `${purchase.number} · ${purchase.invoiceNumber}`,
      summary: `Imported ${items.length} pieces from file`,
      actor,
    });
    return { purchase: final, items };
  });
}

export const IMPORT_TEMPLATE_CSV = [
  "SKU,Design,Colour,Fabric,Collection,Quantity,Cost,MRP,Selling Price,Rack",
  ",Kanchipuram Floral Silk,Wine,Kanchipuram,Wedding,2,9800,18999,14999,B-14",
  ",Chanderi Silk Cotton Butta,Mint Green,Chanderi,Festive,3,1650,3999,2899,D-03",
  "OLD-1042,Cotton Ilkal Checks,Maroon,Cotton,Daily Wear,1,540,1499,1099,E-11",
].join("\n");
