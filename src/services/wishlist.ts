import { repos, transaction } from "@/data";
import type { Design, WishlistEntry } from "@/domain/types";
import { newId } from "@/lib/id";
import { now, DAY_MS } from "./context";
import { notify } from "./notifications";

/**
 * Sends "back in stock" messages when a wishlisted design goes from zero to at least one
 * available piece. Throttled to once per entry per day so short cart holds do not spam.
 */
export async function onPiecesAvailable(designIds: string[]): Promise<void> {
  const r = repos();
  const t = now();
  for (const designId of designIds) {
    const entries = await r.wishlists.listByDesign(designId);
    if (entries.length === 0) continue;
    const available = await r.inventory.listByDesignAndStatus(designId, "AVAILABLE");
    if (available.length !== 1) continue; // only the 0 → 1 transition counts as "available again"
    const design = await r.designs.get(designId);
    if (!design?.isPublished) continue;
    for (const entry of entries) {
      if (entry.notifiedAt && t - entry.notifiedAt < DAY_MS) continue;
      const customer = entry.customerId ? await r.customers.get(entry.customerId) : null;
      await notify("BACK_IN_STOCK", { design, customer, ownerId: entry.ownerId });
      await r.wishlists.update(entry.id, { notifiedAt: t });
    }
  }
}

export async function toggleWishlist(ownerId: string, designId: string, customerId: string | null = null): Promise<boolean> {
  return transaction(async () => {
    const existing = await repos().wishlists.find(ownerId, designId);
    if (existing) {
      await repos().wishlists.remove(existing.id);
      return false;
    }
    const entry: WishlistEntry = { id: newId("wsh"), ownerId, customerId, designId, notifiedAt: null, createdAt: now() };
    await repos().wishlists.add(entry);
    return true;
  });
}

export async function listWishlistDesignIds(ownerId: string): Promise<string[]> {
  return (await repos().wishlists.listByOwner(ownerId)).map((w) => w.designId);
}

/** Links an anonymous shopper's wishlist to a customer after checkout. */
export async function linkWishlistToCustomer(ownerId: string, customerId: string): Promise<void> {
  const entries = await repos().wishlists.listByOwner(ownerId);
  const unlinked = entries.filter((e) => e.customerId !== customerId);
  if (unlinked.length) await repos().wishlists.bulkPut(unlinked.map((e) => ({ ...e, customerId })));
}

export async function listCustomerWishlist(customerId: string): Promise<Design[]> {
  const entries = await repos().wishlists.listByCustomer(customerId);
  return repos().designs.getMany(entries.map((e) => e.designId));
}

export async function listShopperNotifications(ownerId: string) {
  const all = await repos().notifications.listRecent(300);
  return all.filter((n) => n.ownerId === ownerId);
}
