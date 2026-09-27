/** Money owed to the shop (receivables) and by the shop (payables), like the two sides of a bill book. */
import { repos } from "@/data";
import type { Order, Purchase, Supplier } from "@/domain/types";
import { balanceDue, purchaseBalance } from "@/domain/rules/payments";
import { getCatalog } from "./catalog";

export interface Receivable {
  order: Order;
  balance: number;
  ageDays: number;
}

export interface Payable {
  purchase: Purchase;
  supplier: Supplier | undefined;
  balance: number;
  ageDays: number;
  overdue: boolean;
}

const days = (from: number, to: number) => Math.max(0, Math.floor((to - from) / 86_400_000));

export async function listReceivables(): Promise<Receivable[]> {
  const orders = await repos().orders.list();
  const t = Date.now();
  return orders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "NEW" && o.status !== "PAYMENT_PENDING" && balanceDue(o) > 0)
    .map((order) => ({ order, balance: balanceDue(order), ageDays: days(order.createdAt, t) }))
    .sort((a, b) => a.order.createdAt - b.order.createdAt);
}

export async function listPayables(): Promise<Payable[]> {
  const [purchases, catalog] = await Promise.all([repos().purchases.list(), getCatalog()]);
  const t = Date.now();
  return purchases
    .filter((p) => p.status !== "CANCELLED" && purchaseBalance(p) > 0)
    .map((purchase) => ({
      purchase,
      supplier: catalog.supplierById.get(purchase.supplierId),
      balance: purchaseBalance(purchase),
      ageDays: days(purchase.date, t),
      overdue: purchase.dueDate != null && purchase.dueDate < t,
    }))
    .sort((a, b) => a.purchase.date - b.purchase.date);
}

export async function duesSummary(): Promise<{ receivable: number; payable: number; receivableCount: number; payableCount: number }> {
  const [r, p] = await Promise.all([listReceivables(), listPayables()]);
  return {
    receivable: r.reduce((s, x) => s + x.balance, 0),
    payable: p.reduce((s, x) => s + x.balance, 0),
    receivableCount: r.length,
    payableCount: p.length,
  };
}
