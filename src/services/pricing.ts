import { repos, transaction } from "@/data";
import type { Design, InventoryItem } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { effectiveMrp, effectivePrice } from "@/domain/rules/pricing";
import { formatINR } from "@/lib/format";
import { recordAudit } from "./audit";
import { currentActor, now } from "./context";
import { changeItems, loadItemsOrThrow } from "./inventory-core";

/** Pieces whose current price follows the design: unsold and not yet allocated to an order. */
function followsDesignPrice(item: InventoryItem): boolean {
  if (item.priceOverride !== null) return false;
  if (item.status === "AVAILABLE") return true;
  return item.status === "RESERVED" && item.reservation?.kind !== "ORDER";
}

function isOpenStock(item: InventoryItem): boolean {
  return item.status === "AVAILABLE" || (item.status === "RESERVED" && item.reservation?.kind !== "ORDER");
}

export interface PriceChangePreview {
  design: Design;
  oldPrice: number;
  newPrice: number;
  /** Available pieces that will show the new price. */
  availableAffected: number;
  /** Pieces sitting in carts or on hold that will show the new price at checkout. */
  heldAffected: number;
  /** Open pieces with their own price that keep it unless overrides are cleared. */
  overrides: number;
  /** Pieces already allocated to orders or sold. Their order prices never change. */
  lockedInOrders: number;
}

export async function previewDesignPriceChange(designId: string, newPrice: number): Promise<PriceChangePreview> {
  const r = repos();
  const design = await r.designs.get(designId);
  if (!design) throw new DomainError("Design not found");
  const items = await r.inventory.listByDesign(designId);
  return {
    design,
    oldPrice: design.price,
    newPrice,
    availableAffected: items.filter((i) => followsDesignPrice(i) && i.status === "AVAILABLE").length,
    heldAffected: items.filter((i) => followsDesignPrice(i) && i.status === "RESERVED").length,
    overrides: items.filter((i) => isOpenStock(i) && i.priceOverride !== null).length,
    lockedInOrders: items.filter((i) => i.status === "SOLD" || i.reservation?.kind === "ORDER").length,
  };
}

/**
 * Changes a design's selling price. Every channel reads the effective price from the same
 * record, so POS, website and WhatsApp update together. SKUs and barcodes do not change, and
 * order lines keep the price they were sold at.
 */
export async function applyDesignPriceChange(
  designId: string,
  input: { price: number; mrp?: number; clearOverrides?: boolean },
): Promise<{ piecesUpdated: number }> {
  const actor = currentActor();
  assertPermission(actor, "pricing:edit");
  const price = Math.round(input.price);
  if (!(price > 0)) throw new DomainError("Enter a valid selling price");

  return transaction(async () => {
    const r = repos();
    const design = await r.designs.get(designId);
    if (!design) throw new DomainError("Design not found");
    const mrp = Math.round(input.mrp ?? design.mrp);
    if (price > mrp) throw new DomainError(`Selling price cannot be above MRP (${formatINR(mrp)})`);
    if (price === design.price && mrp === design.mrp && !input.clearOverrides) return { piecesUpdated: 0 };

    const items = await r.inventory.listByDesign(designId);
    const following = items.filter(followsDesignPrice);
    const overridden = input.clearOverrides ? items.filter((i) => isOpenStock(i) && i.priceOverride !== null) : [];

    await r.designs.update(designId, { price, mrp, updatedAt: now() });
    const note = `${formatINR(design.price)} → ${formatINR(price)} (design price)`;
    if (price !== design.price) await changeItems(following, { type: "PRICE_CHANGED", note }, actor);
    for (const item of overridden) {
      await changeItems([item], { type: "PRICE_CHANGED", priceOverride: null, note: `${formatINR(item.priceOverride!)} → ${formatINR(price)} (override cleared)` }, actor);
    }

    const pieces = (price !== design.price ? following.length : 0) + overridden.length;
    await recordAudit({
      action: "PRICE_CHANGED",
      entityType: "DESIGN",
      entityId: design.id,
      entityLabel: `${design.name} (${design.code})`,
      summary: `Selling price ${formatINR(design.price)} → ${formatINR(price)} for ${pieces} open piece${pieces === 1 ? "" : "s"}`,
      before: `Price ${formatINR(design.price)}, MRP ${formatINR(design.mrp)}`,
      after: `Price ${formatINR(price)}, MRP ${formatINR(mrp)}`,
      actor,
    });
    return { piecesUpdated: pieces };
  });
}

/** Sets or clears (null) an individual piece price. */
export async function setPiecePrice(itemIds: string[], price: number | null): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "pricing:edit");
  await transaction(async () => {
    const r = repos();
    const items = await loadItemsOrThrow(itemIds);
    const designs = new Map((await r.designs.getMany([...new Set(items.map((i) => i.designId))])).map((d) => [d.id, d]));
    for (const item of items) {
      const design = designs.get(item.designId)!;
      if (!isOpenStock(item)) throw new DomainError(`${item.sku} is ${item.status.toLowerCase()}; its price can no longer change`);
      const target = price === null ? null : Math.round(price);
      if (target !== null && target > effectiveMrp(item, design)) {
        throw new DomainError(`${item.sku}: price cannot be above MRP (${formatINR(effectiveMrp(item, design))})`);
      }
      const nextOverride = target === design.price ? null : target;
      const before = effectivePrice(item, design);
      const after = nextOverride ?? design.price;
      if (nextOverride === item.priceOverride) continue;
      await changeItems([item], {
        type: "PRICE_CHANGED",
        priceOverride: nextOverride,
        note: `${formatINR(before)} → ${formatINR(after)}${nextOverride === null ? " (follows design)" : " (individual price)"}`,
      }, actor);
      await recordAudit({
        action: "PRICE_CHANGED",
        entityType: "INVENTORY",
        entityId: item.id,
        entityLabel: item.sku,
        summary: `Price ${formatINR(before)} → ${formatINR(after)}`,
        before: formatINR(before),
        after: formatINR(after),
        actor,
      });
    }
  });
}
