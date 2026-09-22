import { repos, transaction } from "@/data";
import type { Category, Collection, Colour, Design, Fabric, Supplier } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { slugify } from "@/domain/rules/catalog";
import { newId } from "@/lib/id";
import { recordAudit } from "./audit";
import { currentActor, now } from "./context";
import { getSettings } from "./settings";

export interface Catalog {
  categories: Category[];
  collections: Collection[];
  colours: Colour[];
  fabrics: Fabric[];
  suppliers: Supplier[];
  categoryById: Map<string, Category>;
  collectionById: Map<string, Collection>;
  colourById: Map<string, Colour>;
  fabricById: Map<string, Fabric>;
  supplierById: Map<string, Supplier>;
}

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));

/** Master data used for labels, filters and pickers. Small enough to load whole. */
export async function getCatalog(): Promise<Catalog> {
  const r = repos();
  const [categories, collections, colours, fabrics, suppliers] = await Promise.all([
    r.categories.list(),
    r.collections.list(),
    r.colours.list(),
    r.fabrics.list(),
    r.suppliers.list(),
  ]);
  categories.sort((a, b) => a.sortOrder - b.sortOrder);
  collections.sort((a, b) => a.sortOrder - b.sortOrder);
  colours.sort((a, b) => a.name.localeCompare(b.name));
  fabrics.sort((a, b) => a.name.localeCompare(b.name));
  suppliers.sort((a, b) => a.name.localeCompare(b.name));
  return {
    categories,
    collections,
    colours,
    fabrics,
    suppliers,
    categoryById: byId(categories),
    collectionById: byId(collections),
    colourById: byId(colours),
    fabricById: byId(fabrics),
    supplierById: byId(suppliers),
  };
}

/* ------------------------------------------------------------------ */
/* Colours                                                             */
/* ------------------------------------------------------------------ */

/** Swatches for colour names staff commonly type. Unknown names get a neutral swatch. */
const KNOWN_HEX: Record<string, string> = {
  red: "#b3261e", maroon: "#6d1a24", wine: "#6b1f3a", pink: "#e27aa0", "rani pink": "#d6246e", magenta: "#b02a78",
  peach: "#f2b48f", orange: "#e0762b", mustard: "#c9971c", yellow: "#e8c33a", gold: "#c9a24a", cream: "#efe3c8",
  beige: "#d9c4a3", ivory: "#f4ecd8", white: "#f7f5f0", grey: "#8b8b8b", black: "#222222", green: "#2f7d4a",
  "bottle green": "#1f4d36", "parrot green": "#6bb33f", "mint green": "#a8d5ba", teal: "#1f7a78", "peacock blue": "#0f5e73",
  blue: "#2f5da8", "royal blue": "#2446a3", navy: "#1f2a55", "sky blue": "#8cc3e8", purple: "#5e2a84", lavender: "#b8a2d8",
  "onion pink": "#d9a1a6", rust: "#a0461f", brown: "#6b4226", coffee: "#5a3d2b", copper: "#b0663a", silver: "#c0c0c6",
};

export function guessColourHex(name: string): string {
  return KNOWN_HEX[name.trim().toLowerCase()] ?? "#a39a90";
}

/** Returns the colour with this name, creating it when it does not exist yet. */
export async function ensureColour(name: string): Promise<Colour> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new DomainError("Colour name is required");
  const all = await repos().colours.list();
  const existing = all.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const colour: Colour = { id: newId("col"), name: toTitle(clean), hex: guessColourHex(clean) };
  await repos().colours.add(colour);
  return colour;
}

export async function ensureFabric(name: string): Promise<Fabric> {
  const clean = name.trim();
  const all = await repos().fabrics.list();
  const existing = all.find((f) => f.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const categories = await repos().categories.list();
  const fabric: Fabric = {
    id: newId("fab"),
    name: toTitle(clean),
    description: "",
    care: "Dry clean recommended",
    categoryId: categories.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? "",
  };
  await repos().fabrics.add(fabric);
  return fabric;
}

export async function ensureCollection(name: string): Promise<Collection> {
  const clean = name.trim();
  const all = await repos().collections.list();
  const existing = all.find((c) => c.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const collection: Collection = {
    id: newId("clc"),
    name: toTitle(clean),
    slug: slugify(clean),
    description: "",
    sortOrder: all.length,
  };
  await repos().collections.add(collection);
  return collection;
}

export async function createSupplier(input: Omit<Supplier, "id" | "createdAt">): Promise<Supplier> {
  if (!input.name.trim()) throw new DomainError("Supplier name is required");
  const supplier: Supplier = { ...input, name: input.name.trim(), id: newId("sup"), createdAt: now() };
  await repos().suppliers.add(supplier);
  return supplier;
}

function toTitle(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

/* ------------------------------------------------------------------ */
/* Designs                                                             */
/* ------------------------------------------------------------------ */

export interface DesignInput {
  name: string;
  fabricId: string;
  categoryId?: string | null;
  collectionIds: string[];
  pattern?: string;
  border?: string;
  lengthM?: number;
  blouseIncluded?: boolean;
  description?: string;
  mrp: number;
  price: number;
  imageIds?: string[];
  isPublished?: boolean;
}

export function describeDesign(d: { pattern: string; border: string; lengthM: number; blouseIncluded: boolean }, fabricName: string): string {
  const pattern = d.pattern ? `${d.pattern.toLowerCase()} ` : "";
  const border = d.border ? ` finished with a ${d.border.toLowerCase()}` : "";
  const blouse = d.blouseIncluded ? "with an unstitched blouse piece" : "without blouse piece";
  return `A ${pattern}${fabricName.toLowerCase()} saree${border}. ${d.lengthM} m length, ${blouse}.`;
}

/** Creates a design. Must be called inside a transaction when combined with other writes. */
export async function createDesignRecord(input: DesignInput): Promise<Design> {
  const r = repos();
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new DomainError("Design name is required");
  if (await r.designs.findByName(name)) throw new DomainError(`A design named "${name}" already exists`);
  const fabric = await r.fabrics.get(input.fabricId);
  if (!fabric) throw new DomainError("Choose a fabric for the new design");
  if (!(input.price > 0) || !(input.mrp > 0)) throw new DomainError(`Enter MRP and selling price for "${name}"`);

  const seq = await r.counters.next("design");
  const code = `DSN-${String(seq).padStart(4, "0")}`;
  let slug = slugify(name);
  if (await r.designs.findBySlug(slug)) slug = `${slug}-${seq}`;
  const settings = await getSettings();
  const t = now();
  const base = {
    pattern: input.pattern?.trim() ?? "",
    border: input.border?.trim() ?? "",
    lengthM: input.lengthM ?? 6.3,
    blouseIncluded: input.blouseIncluded ?? true,
  };
  const design: Design = {
    id: newId("dsn"),
    code,
    name,
    slug,
    categoryId: input.categoryId || fabric.categoryId,
    fabricId: fabric.id,
    collectionIds: [...new Set(input.collectionIds)],
    ...base,
    description: input.description?.trim() || describeDesign(base, fabric.name),
    mrp: Math.round(input.mrp),
    price: Math.round(input.price),
    imageIds: input.imageIds ?? [],
    isPublished: input.isPublished ?? settings.store.autoPublishNewDesigns,
    createdAt: t,
    updatedAt: t,
  };
  await r.designs.add(design);
  await recordAudit({
    action: "PRODUCT_CREATED",
    entityType: "DESIGN",
    entityId: design.id,
    entityLabel: `${design.name} (${design.code})`,
    summary: `Design created at ${design.price}`,
  });
  return design;
}

export async function createDesign(input: DesignInput): Promise<Design> {
  assertPermission(currentActor(), "designs:edit");
  return transaction(() => createDesignRecord(input));
}

export type DesignEdit = Partial<
  Pick<Design, "name" | "categoryId" | "fabricId" | "collectionIds" | "pattern" | "border" | "lengthM" | "blouseIncluded" | "description" | "mrp" | "isPublished">
>;

/** Edits non-price attributes. Selling price changes go through pricing.applyDesignPriceChange. */
export async function updateDesign(designId: string, changes: DesignEdit): Promise<void> {
  assertPermission(currentActor(), "designs:edit");
  await transaction(async () => {
    const r = repos();
    const design = await r.designs.get(designId);
    if (!design) throw new DomainError("Design not found");
    if (changes.name && changes.name.trim().toLowerCase() !== design.name.toLowerCase()) {
      const clash = await r.designs.findByName(changes.name);
      if (clash && clash.id !== designId) throw new DomainError(`A design named "${changes.name}" already exists`);
    }
    const changed = (Object.keys(changes) as (keyof DesignEdit)[]).filter(
      (k) => JSON.stringify(changes[k]) !== JSON.stringify(design[k]),
    );
    if (changed.length === 0) return;
    await r.designs.update(designId, { ...changes, name: changes.name?.trim() ?? design.name, updatedAt: now() });
    await recordAudit({
      action: "PRODUCT_EDITED",
      entityType: "DESIGN",
      entityId: design.id,
      entityLabel: `${design.name} (${design.code})`,
      summary: `Updated ${changed.join(", ")}`,
      before: changed.map((k) => `${k}: ${JSON.stringify(design[k])}`).join("; "),
      after: changed.map((k) => `${k}: ${JSON.stringify(changes[k])}`).join("; "),
    });
  });
}

export async function setDesignImages(designId: string, imageIds: string[]): Promise<void> {
  assertPermission(currentActor(), "designs:edit");
  await transaction(async () => {
    const design = await repos().designs.get(designId);
    if (!design) throw new DomainError("Design not found");
    await repos().designs.update(designId, { imageIds, updatedAt: now() });
    await recordAudit({
      action: "PRODUCT_EDITED",
      entityType: "DESIGN",
      entityId: design.id,
      entityLabel: `${design.name} (${design.code})`,
      summary: `Photos updated (${design.imageIds.length} → ${imageIds.length})`,
    });
  });
}

export async function listDesigns(): Promise<Design[]> {
  const designs = await repos().designs.list();
  return designs.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getDesign(designId: string): Promise<Design | null> {
  return (await repos().designs.get(designId)) ?? null;
}
