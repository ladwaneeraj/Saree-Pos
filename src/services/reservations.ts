/**
 * Reservations: website carts, POS counter holds and WhatsApp holds all lock a physical piece
 * the same way, so a saree in one shopper's cart cannot be sold anywhere else until it is
 * bought, removed or the hold expires.
 */
import { repos, transaction } from "@/data";
import type { Actor, Colour, Design, InventoryItem, Reservation, ReservationKind, SalesChannel } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { isAvailableNow, isHeldBy, isReservationExpired, unavailableReason } from "@/domain/rules/inventory";
import { effectiveMrp, effectivePrice } from "@/domain/rules/pricing";
import { currentActor, now } from "./context";
import { changeItems } from "./inventory-core";
import { getCatalog } from "./catalog";

export interface HoldOptions {
  holderId: string;
  kind: Exclude<ReservationKind, "ORDER">;
  channel: SalesChannel;
  ttlMinutes: number;
  actor?: Actor;
}

const HOLD_REF: Record<HoldOptions["kind"], "CART" | "HOLD"> = { CART: "CART", HOLD: "HOLD" };

function holdLabel(opts: HoldOptions): string {
  if (opts.kind === "CART") return "Website cart";
  return opts.channel === "WHATSAPP" ? "WhatsApp hold" : "POS counter hold";
}

/** Releases an expired reservation so the piece can be offered again. Inside a transaction. */
async function expireIfNeeded(item: InventoryItem, actor: Actor): Promise<InventoryItem> {
  if (!isReservationExpired(item, now())) return item;
  const [released] = await changeItems([item], {
    type: "RESERVATION_EXPIRED",
    status: "AVAILABLE",
    reservation: null,
    refType: item.reservation?.kind === "ORDER" ? "ORDER" : item.reservation?.kind === "CART" ? "CART" : "HOLD",
    refId: item.reservation?.holderId ?? null,
    note: "Reservation expired",
  }, actor);
  return released!;
}

export async function holdItemInTx(itemId: string, opts: HoldOptions): Promise<InventoryItem> {
  const actor = opts.actor ?? currentActor();
  const found = await repos().inventory.get(itemId);
  if (!found) throw new DomainError("This saree is no longer in inventory");
  const t = now();
  const expiresAt = t + opts.ttlMinutes * 60_000;
  if (isHeldBy(found, opts.holderId, t)) {
    // Already ours: extend the hold.
    const reservation: Reservation = { ...found.reservation!, expiresAt };
    await repos().inventory.update(found.id, { reservation, updatedAt: t });
    return { ...found, reservation };
  }
  const item = await expireIfNeeded(found, actor);
  const reason = unavailableReason(item, t);
  if (reason) throw new DomainError(reason, "NOT_AVAILABLE");
  const reservation: Reservation = {
    kind: opts.kind,
    holderId: opts.holderId,
    channel: opts.channel,
    orderId: null,
    reservedAt: t,
    expiresAt,
  };
  const [held] = await changeItems([item], {
    type: "RESERVED",
    status: "RESERVED",
    reservation,
    channel: opts.channel,
    refType: HOLD_REF[opts.kind],
    refId: opts.holderId,
    refLabel: holdLabel(opts),
    note: `${holdLabel(opts)} for ${opts.ttlMinutes >= 60 ? `${Math.round(opts.ttlMinutes / 60)} h` : `${opts.ttlMinutes} min`}`,
  }, actor);
  return held!;
}

export function holdItem(itemId: string, opts: HoldOptions): Promise<InventoryItem> {
  return transaction(() => holdItemInTx(itemId, opts));
}

/** Holds the oldest available piece of a design (and colour), FIFO. */
export async function holdNextAvailable(designId: string, colourId: string | null, opts: HoldOptions): Promise<InventoryItem> {
  return transaction(async () => {
    const t = now();
    const candidates = (await repos().inventory.listByDesign(designId))
      .filter((i) => (colourId ? i.colourId === colourId : true) && isAvailableNow(i, t))
      .sort((a, b) => a.receivedAt - b.receivedAt || a.sku.localeCompare(b.sku));
    const pick = candidates[0];
    if (!pick) throw new DomainError("Sorry, this saree was just taken. No pieces are available right now.", "SOLD_OUT");
    return holdItemInTx(pick.id, opts);
  });
}

export async function releaseItemsInTx(items: InventoryItem[], holderId: string, note: string, actor: Actor): Promise<void> {
  const mine = items.filter((i) => i.status === "RESERVED" && i.reservation?.holderId === holderId);
  if (mine.length === 0) return;
  await changeItems(mine, {
    type: "RESERVATION_RELEASED",
    status: "AVAILABLE",
    reservation: null,
    refType: mine[0]!.reservation?.kind === "CART" ? "CART" : "HOLD",
    refId: holderId,
    note,
  }, actor);
}

export async function releaseItem(itemId: string, holderId: string, note = "Removed from cart", actor: Actor = currentActor()): Promise<void> {
  await transaction(async () => {
    const item = await repos().inventory.get(itemId);
    if (item) await releaseItemsInTx([item], holderId, note, actor);
  });
}

export async function releaseHolder(holderId: string, note = "Cart cleared", actor: Actor = currentActor()): Promise<void> {
  await transaction(async () => {
    await releaseItemsInTx(await repos().inventory.listByHolder(holderId), holderId, note, actor);
  });
}

export interface HeldLine {
  item: InventoryItem;
  design: Design;
  colour: Colour | undefined;
  fabricName: string;
  price: number;
  mrp: number;
  imageId: string | null;
  expiresAt: number | null;
}

/** Current, unexpired pieces held by a cart/terminal/conversation, oldest first. */
export async function getHeldLines(holderId: string): Promise<HeldLine[]> {
  const r = repos();
  const t = now();
  const items = (await r.inventory.listByHolder(holderId)).filter((i) => isHeldBy(i, holderId, t));
  if (items.length === 0) return [];
  const [designs, catalog] = await Promise.all([r.designs.getMany([...new Set(items.map((i) => i.designId))]), getCatalog()]);
  const designById = new Map(designs.map((d) => [d.id, d]));
  return items
    .sort((a, b) => (a.reservation?.reservedAt ?? 0) - (b.reservation?.reservedAt ?? 0))
    .flatMap((item) => {
      const design = designById.get(item.designId);
      if (!design) return [];
      return [{
        item,
        design,
        colour: catalog.colourById.get(item.colourId),
        fabricName: catalog.fabricById.get(design.fabricId)?.name ?? "",
        price: effectivePrice(item, design),
        mrp: effectiveMrp(item, design),
        imageId: item.imageIds[0] ?? design.imageIds[0] ?? null,
        expiresAt: item.reservation?.expiresAt ?? null,
      }];
    });
}
