import type { Order, PaymentStatus, Purchase, PurchasePaymentStatus } from "../types";

/** Money the customer still owes. Refunded or partly refunded orders owe nothing. */
export function balanceDue(order: Pick<Order, "total" | "amountPaid" | "paymentStatus">): number {
  if (order.paymentStatus !== "PENDING" && order.paymentStatus !== "PARTIAL") return 0;
  return Math.max(0, order.total - order.amountPaid);
}

/** Payment status for an order after `amountPaid` of `total` has been received. */
export function paymentStatusFor(total: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return "PENDING";
  return amountPaid >= total ? "PAID" : "PARTIAL";
}

export const purchaseBalance = (p: Pick<Purchase, "grandTotal" | "amountPaid">): number => Math.max(0, p.grandTotal - p.amountPaid);

export function purchasePaymentStatusFor(grandTotal: number, amountPaid: number): PurchasePaymentStatus {
  if (amountPaid <= 0) return "UNPAID";
  return amountPaid >= grandTotal ? "PAID" : "PARTIAL";
}

/**
 * UPI deep link (NPCI spec) that any UPI app opens with the payee and amount filled in.
 * Amount is optional: without it the payer types the amount.
 */
export function upiPaymentUri(input: { upiId: string; payeeName: string; amount?: number; note?: string }): string {
  const params = new URLSearchParams({ pa: input.upiId.trim(), pn: input.payeeName.trim(), cu: "INR" });
  if (input.amount && input.amount > 0) params.set("am", input.amount.toFixed(2));
  if (input.note) params.set("tn", input.note.slice(0, 50));
  return `upi://pay?${params.toString()}`;
}
