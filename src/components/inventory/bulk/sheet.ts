/**
 * Pure logic for the bulk entry sheet: columns, reading and writing cell values as text,
 * validation and clipboard parsing. No React, no services.
 */
import type { Collection, Colour, Design, Fabric, InventoryDraft } from "@/domain/types";
import type { DraftPatch } from "@/services/drafts";
import type { NewPieceInput } from "@/services/inventory";

export type ColKey = "design" | "colour" | "fabric" | "collection" | "cost" | "mrp" | "price" | "location";

export interface ColDef {
  key: ColKey;
  label: string;
  width: number;
  kind: "combo" | "number" | "text";
  align?: "right";
}

export const ALL_COLUMNS: ColDef[] = [
  { key: "design", label: "Design", width: 180, kind: "combo" },
  { key: "colour", label: "Colour", width: 132, kind: "combo" },
  { key: "fabric", label: "Fabric", width: 112, kind: "combo" },
  { key: "collection", label: "Collection", width: 112, kind: "combo" },
  { key: "cost", label: "Cost", width: 84, kind: "number", align: "right" },
  { key: "mrp", label: "MRP", width: 84, kind: "number", align: "right" },
  { key: "price", label: "Selling", width: 88, kind: "number", align: "right" },
  { key: "location", label: "Rack", width: 72, kind: "text" },
];

export interface Lookups {
  designs: Design[];
  designById: Map<string, Design>;
  designByName: Map<string, Design>;
  colours: Colour[];
  colourById: Map<string, Colour>;
  colourByName: Map<string, Colour>;
  fabrics: Fabric[];
  fabricById: Map<string, Fabric>;
  fabricByName: Map<string, Fabric>;
  collections: Collection[];
  collectionById: Map<string, Collection>;
  collectionByName: Map<string, Collection>;
}

const byName = <T extends { name: string }>(rows: T[]) => new Map(rows.map((r) => [r.name.toLowerCase(), r]));
const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

export function buildLookups(designs: Design[], colours: Colour[], fabrics: Fabric[], collections: Collection[]): Lookups {
  const designByName = byName(designs);
  for (const d of designs) designByName.set(d.code.toLowerCase(), d);
  return {
    designs,
    designById: byId(designs),
    designByName,
    colours,
    colourById: byId(colours),
    colourByName: byName(colours),
    fabrics,
    fabricById: byId(fabrics),
    fabricByName: byName(fabrics),
    collections,
    collectionById: byId(collections),
    collectionByName: byName(collections),
  };
}

/** True when a column's value comes from the chosen existing design. */
export function isLocked(row: InventoryDraft, col: ColKey): boolean {
  return !!row.designId && (col === "fabric" || col === "collection");
}

export function cellText(row: InventoryDraft, col: ColKey, lk: Lookups): string {
  const design = row.designId ? lk.designById.get(row.designId) : undefined;
  switch (col) {
    case "design":
      return design?.name ?? row.designName;
    case "colour":
      return row.colourId ? (lk.colourById.get(row.colourId)?.name ?? "") : "";
    case "fabric": {
      const id = design ? design.fabricId : row.fabricId;
      return id ? (lk.fabricById.get(id)?.name ?? "") : "";
    }
    case "collection": {
      const id = design ? design.collectionIds[0] : row.collectionId;
      return id ? (lk.collectionById.get(id)?.name ?? "") : "";
    }
    case "cost":
    case "mrp":
    case "price":
      return row[col] == null ? "" : String(row[col]);
    case "location":
      return row.location;
  }
}

export function parseAmount(text: string): number | null {
  const clean = text.replace(/[₹,\s]|rs\.?/gi, "");
  if (!clean) return null;
  const n = Math.round(Number(clean));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Names typed into a column that do not exist yet and must be created first. */
export function unknownName(col: ColKey, text: string, lk: Lookups): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (col === "colour") return lk.colourByName.has(t) ? null : text.trim();
  if (col === "fabric") return lk.fabricByName.has(t) ? null : text.trim();
  if (col === "collection") return lk.collectionByName.has(t) ? null : text.trim();
  return null;
}

/**
 * Choosing an existing design fills fabric and collection (locked) and the design prices. Prices the
 * user typed are kept; prices that were only the previous design's defaults follow the new design.
 */
export function designPatch(row: Pick<InventoryDraft, "mrp" | "price">, design: Design | undefined, name: string, previous?: Design): DraftPatch {
  if (design) {
    const keep = (value: number | null, prevDefault: number | undefined) => value != null && value !== prevDefault;
    return {
      designId: design.id,
      designName: design.name,
      fabricId: design.fabricId,
      collectionId: design.collectionIds[0] ?? null,
      mrp: keep(row.mrp, previous?.mrp) ? row.mrp : design.mrp,
      price: keep(row.price, previous?.price) ? row.price : design.price,
    };
  }
  return { designId: null, designName: name.trim().replace(/\s+/g, " ") };
}

/** Converts typed or pasted text into a patch. Returns null when the cell cannot take it. */
export function textPatch(row: InventoryDraft, col: ColKey, text: string, lk: Lookups): DraftPatch | null {
  const t = text.trim();
  const key = t.toLowerCase();
  if (isLocked(row, col)) return null;
  switch (col) {
    case "design":
      return designPatch(row, lk.designByName.get(key), t, row.designId ? lk.designById.get(row.designId) : undefined);
    case "colour":
      if (!t) return { colourId: null, colourAutoDetected: false };
      return lk.colourByName.has(key) ? { colourId: lk.colourByName.get(key)!.id, colourAutoDetected: false } : null;
    case "fabric":
      if (!t) return { fabricId: null };
      return lk.fabricByName.has(key) ? { fabricId: lk.fabricByName.get(key)!.id } : null;
    case "collection":
      if (!t) return { collectionId: null };
      return lk.collectionByName.has(key) ? { collectionId: lk.collectionByName.get(key)!.id } : null;
    case "cost":
    case "mrp":
    case "price": {
      if (!t) return { [col]: null };
      const n = parseAmount(t);
      return n === null ? null : { [col]: n };
    }
    case "location":
      return { location: t.toUpperCase() };
  }
}

export interface RowCheck {
  errors: string[];
  warnings: string[];
}

export function checkRow(row: InventoryDraft, lk: Lookups, needCost: boolean): RowCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const design = row.designId ? lk.designById.get(row.designId) : undefined;
  if (!design && !row.designName.trim()) errors.push("Choose a design or type a new design name");
  if (!row.colourId) errors.push("Colour is missing");
  if (!design && row.designName.trim() && !row.fabricId) errors.push("Fabric is needed for a new design");
  if (needCost && row.cost == null) errors.push("Purchase cost is missing");
  if (row.mrp == null || row.mrp <= 0) errors.push("MRP is missing");
  if (row.price == null || row.price <= 0) errors.push("Selling price is missing");
  if (row.price != null && row.mrp != null && row.price > row.mrp) errors.push("Selling price is above MRP");
  if (row.cost != null && row.price != null && row.cost > row.price) warnings.push("Cost is above selling price");
  if (row.imageIds.length === 0) warnings.push("No photo, the design photos will be used");
  if (!row.location.trim()) warnings.push("No rack, will be shelved as Unassigned");
  return { errors, warnings };
}

export function toPieceInput(row: InventoryDraft): NewPieceInput {
  return {
    design: row.designId
      ? { designId: row.designId }
      : {
          newDesign: {
            name: row.designName.trim(),
            fabricId: row.fabricId ?? "",
            collectionIds: row.collectionId ? [row.collectionId] : [],
            mrp: row.mrp ?? 0,
            price: row.price ?? 0,
          },
        },
    colourId: row.colourId ?? "",
    cost: row.cost ?? 0,
    mrp: row.mrp ?? 0,
    price: row.price ?? 0,
    location: row.location,
    imageIds: row.imageIds,
  };
}

/** Tab-separated clipboard text (Excel, Google Sheets) into a grid of cells. */
export function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line) => line.split("\t").map((c) => c.replace(/^"([\s\S]*)"$/, "$1").trim()));
}

export function adjustByPercent(value: number | null, percent: number): number | null {
  if (value == null) return null;
  return Math.max(0, Math.round(value * (1 + percent / 100)));
}
