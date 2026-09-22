/**
 * Internal inventory primitives. Every status, location or price change to a physical piece
 * goes through `changeItems`, which enforces the status rules and writes one movement per piece.
 * Callers must already be inside a transaction.
 */
import { repos } from "@/data";
import type {
  Actor,
  InventoryItem,
  InventoryMovement,
  InventoryStatus,
  MovementType,
  Reservation,
  SalesChannel,
} from "@/domain/types";
import { assertTransition } from "@/domain/rules/inventory";
import { newId } from "@/lib/id";
import { currentActor, now } from "./context";
import { onPiecesAvailable } from "./wishlist";

export interface ItemChange {
  type: MovementType;
  status?: InventoryStatus;
  /** Pass null to clear the reservation. Omit to leave it unchanged. */
  reservation?: Reservation | null;
  location?: string;
  priceOverride?: number | null;
  soldOrderId?: string | null;
  channel?: SalesChannel | null;
  refType?: InventoryMovement["refType"];
  refId?: string | null;
  refLabel?: string | null;
  note?: string;
}

function quantityDelta(type: MovementType): number {
  if (type === "PURCHASED" || type === "RETURN_RECEIVED") return 1;
  if (type === "SOLD") return -1;
  return 0;
}

export function buildMovement(item: InventoryItem, change: ItemChange, actor: Actor, at: number, fromStatus: InventoryStatus | null): InventoryMovement {
  return {
    id: newId("mov"),
    itemId: item.id,
    sku: item.sku,
    type: change.type,
    quantityDelta: quantityDelta(change.type),
    fromStatus,
    toStatus: change.status ?? item.status,
    location: change.location ?? item.location,
    channel: change.channel ?? null,
    refType: change.refType ?? null,
    refId: change.refId ?? null,
    refLabel: change.refLabel ?? null,
    note: change.note ?? "",
    actorName: actor.name,
    createdAt: at,
  };
}

/** Applies the same change to many pieces. Returns the updated pieces. */
export async function changeItems(items: InventoryItem[], change: ItemChange, actor: Actor = currentActor()): Promise<InventoryItem[]> {
  if (items.length === 0) return [];
  const at = now();
  const updated: InventoryItem[] = [];
  const movements: InventoryMovement[] = [];
  const restockedDesigns = new Set<string>();

  for (const item of items) {
    const next: InventoryItem = { ...item, updatedAt: at };
    if (change.status && change.status !== item.status) {
      assertTransition(item, change.status);
      next.status = change.status;
      if (change.status === "AVAILABLE") restockedDesigns.add(item.designId);
    }
    if (change.reservation !== undefined) {
      next.reservation = change.reservation;
      next.holderId = change.reservation?.holderId ?? null;
    }
    if (change.location !== undefined) next.location = change.location;
    if (change.priceOverride !== undefined) next.priceOverride = change.priceOverride;
    if (next.status === "SOLD" && item.status !== "SOLD") {
      next.soldAt = at;
      next.soldOrderId = change.soldOrderId ?? null;
    }
    if (next.status === "AVAILABLE") {
      next.soldAt = null;
      next.soldOrderId = null;
    }
    updated.push(next);
    movements.push(buildMovement(next, change, actor, at, item.status));
  }

  await repos().inventory.bulkPut(updated);
  await repos().movements.bulkAdd(movements);
  if (restockedDesigns.size) await onPiecesAvailable([...restockedDesigns]);
  return updated;
}

export async function loadItemsOrThrow(ids: readonly string[]): Promise<InventoryItem[]> {
  const items = await repos().inventory.getMany(ids);
  if (items.length !== new Set(ids).size) throw new Error("Some inventory pieces no longer exist");
  return items;
}
