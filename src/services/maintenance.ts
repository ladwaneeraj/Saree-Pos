import { repos, transaction } from "@/data";
import { SYSTEM_ACTOR, now } from "./context";
import { changeItems } from "./inventory-core";
import { cancelOrderInTx } from "./orders";

/**
 * Releases expired cart and counter holds and cancels unpaid WhatsApp orders past their
 * payment deadline. Runs in every open tab on an interval; safe to run concurrently because
 * each pass re-reads state inside one transaction.
 */
export async function sweepExpiredReservations(): Promise<{ released: number; cancelledOrders: number }> {
  return transaction(async () => {
    const t = now();
    const expired = await repos().inventory.listExpiredReservations(t);
    if (expired.length === 0) return { released: 0, cancelledOrders: 0 };
    const holds = expired.filter((i) => i.reservation?.kind !== "ORDER");
    const byHolder = new Map<string, typeof holds>();
    for (const item of holds) {
      const list = byHolder.get(item.holderId!) ?? [];
      list.push(item);
      byHolder.set(item.holderId!, list);
    }
    for (const [holderId, items] of byHolder) {
      const kind = items[0]!.reservation!.kind;
      await changeItems(items, {
        type: "RESERVATION_EXPIRED",
        status: "AVAILABLE",
        reservation: null,
        channel: items[0]!.reservation!.channel,
        refType: kind === "CART" ? "CART" : "HOLD",
        refId: holderId,
        note: kind === "CART" ? "Website cart reservation expired" : "Hold expired",
      }, SYSTEM_ACTOR);
    }
    const orderIds = [...new Set(expired.filter((i) => i.reservation?.kind === "ORDER").map((i) => i.reservation!.orderId!))];
    let cancelledOrders = 0;
    for (const orderId of orderIds) {
      const order = await repos().orders.get(orderId);
      if (order && order.status === "PAYMENT_PENDING") {
        await cancelOrderInTx(order, "Payment not received before the deadline", SYSTEM_ACTOR);
        cancelledOrders++;
      }
    }
    return { released: holds.length, cancelledOrders };
  });
}
