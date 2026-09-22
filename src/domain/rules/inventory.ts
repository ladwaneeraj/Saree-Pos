import { DomainError } from "../errors";
import type { InventoryItem, InventoryStatus } from "../types";

export function formatSku(n: number): string {
  return `SAR-${String(n).padStart(5, "0")}`;
}

export function isReservationExpired(item: Pick<InventoryItem, "status" | "reservation">, now: number): boolean {
  const r = item.reservation;
  return item.status === "RESERVED" && r !== null && r.expiresAt !== null && r.expiresAt <= now;
}

/** True when the piece can be offered to a new buyer right now. */
export function isAvailableNow(item: Pick<InventoryItem, "status" | "reservation">, now: number): boolean {
  return item.status === "AVAILABLE" || isReservationExpired(item, now);
}

export function isHeldBy(item: Pick<InventoryItem, "status" | "reservation">, holderId: string, now: number): boolean {
  return item.status === "RESERVED" && item.reservation?.holderId === holderId && !isReservationExpired(item, now);
}

const RESERVATION_LABEL: Record<string, string> = {
  CART: "in a website cart",
  HOLD: "on hold",
  ORDER: "for an order",
};

/** Human-readable reason why a piece cannot be sold, or null when it can. */
export function unavailableReason(
  item: Pick<InventoryItem, "sku" | "status" | "reservation">,
  now: number,
  holderId?: string,
): string | null {
  if (isAvailableNow(item, now)) return null;
  if (holderId && isHeldBy(item, holderId, now)) return null;
  switch (item.status) {
    case "SOLD":
      return `${item.sku} is already sold`;
    case "DAMAGED":
      return `${item.sku} is marked damaged and cannot be sold`;
    case "RETURNED":
      return `${item.sku} is waiting for quality check`;
    case "RESERVED": {
      const r = item.reservation;
      const where = r ? RESERVATION_LABEL[r.kind] : "";
      return `${item.sku} is reserved ${where}`.trim();
    }
    default:
      return `${item.sku} is not available`;
  }
}

export function assertSellable(item: InventoryItem, now: number, holderId?: string): void {
  const reason = unavailableReason(item, now, holderId);
  if (reason) throw new DomainError(reason, "NOT_SELLABLE");
}

/**
 * Allowed status changes. Reservation, sale and QC flows go through services that
 * enforce their own preconditions; this table is the final guard.
 */
const TRANSITIONS: Record<InventoryStatus, readonly InventoryStatus[]> = {
  AVAILABLE: ["RESERVED", "SOLD", "DAMAGED"],
  RESERVED: ["AVAILABLE", "SOLD", "DAMAGED"],
  SOLD: ["RETURNED"],
  RETURNED: ["AVAILABLE", "DAMAGED"],
  DAMAGED: ["AVAILABLE"],
};

export function canTransition(from: InventoryStatus, to: InventoryStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(item: Pick<InventoryItem, "sku" | "status">, to: InventoryStatus): void {
  if (!canTransition(item.status, to)) {
    throw new DomainError(`${item.sku} cannot move from ${item.status} to ${to}`, "INVALID_TRANSITION");
  }
}

export const AGING_BUCKETS = [
  { key: "0-30", label: "0–30 days", min: 0, max: 30 },
  { key: "31-90", label: "31–90 days", min: 31, max: 90 },
  { key: "91-180", label: "91–180 days", min: 91, max: 180 },
  { key: "180+", label: "180+ days", min: 181, max: Number.POSITIVE_INFINITY },
] as const;
export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

export function ageInDays(receivedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - receivedAt) / 86_400_000));
}

export function agingBucket(receivedAt: number, now: number): AgingBucketKey {
  const days = ageInDays(receivedAt, now);
  return AGING_BUCKETS.find((b) => days >= b.min && days <= b.max)?.key ?? "180+";
}
