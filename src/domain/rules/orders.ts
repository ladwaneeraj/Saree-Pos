import { DomainError } from "../errors";
import type { Order, OrderStatus, PaymentStatus } from "../types";

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  NEW: ["PAYMENT_PENDING", "CONFIRMED", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["RESERVED", "CANCELLED"],
  RESERVED: ["PACKING", "DELIVERED", "CANCELLED"],
  PACKING: ["READY_TO_DISPATCH", "RESERVED", "CANCELLED"],
  READY_TO_DISPATCH: ["DISPATCHED", "PACKING", "CANCELLED"],
  DISPATCHED: ["IN_TRANSIT", "DELIVERED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  RETURNED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextOrderStatuses(from: OrderStatus): readonly OrderStatus[] {
  return TRANSITIONS[from];
}

export function assertOrderTransition(order: Pick<Order, "number" | "status">, to: OrderStatus): void {
  if (!canTransitionOrder(order.status, to)) {
    throw new DomainError(
      `Order #${order.number} cannot move from ${humanizeOrderStatus(order.status)} to ${humanizeOrderStatus(to)}`,
      "INVALID_TRANSITION",
    );
  }
}

/** Statuses where items are still with the shop and the order can be cancelled. */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  "NEW",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "RESERVED",
  "PACKING",
  "READY_TO_DISPATCH",
];

/** Orders waiting for the packing team. */
export const PENDING_DISPATCH_STATUSES: readonly OrderStatus[] = ["CONFIRMED", "RESERVED", "PACKING", "READY_TO_DISPATCH"];

/**
 * An order counts toward sales once it is committed: not cancelled, and either paid (fully or partly)
 * or already handed over on credit. Orders still waiting for the first payment do not count.
 */
export function countsAsSale(order: Pick<Order, "status" | "paymentStatus">): boolean {
  if (order.status === "CANCELLED") return false;
  if (order.paymentStatus !== "PENDING") return true;
  return order.status === "DELIVERED";
}

export function humanizeOrderStatus(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "New",
  PAYMENT_PENDING: "Payment pending",
  CONFIRMED: "Confirmed",
  RESERVED: "Reserved",
  PACKING: "Packing",
  READY_TO_DISPATCH: "Ready to dispatch",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partly paid",
  PAID: "Paid",
  PARTIALLY_REFUNDED: "Partly refunded",
  REFUNDED: "Refunded",
};

/** Customer-facing tracking steps, derived from order status and shipment status. */
export const TRACKING_STEPS = [
  { key: "CONFIRMED", label: "Order confirmed" },
  { key: "PACKED", label: "Packed" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered" },
] as const;

export function trackingStepIndex(status: OrderStatus, shipmentStatus?: string | null): number {
  if (status === "DELIVERED" || status === "RETURN_REQUESTED" || status === "RETURNED" || status === "REFUNDED") return 5;
  if (shipmentStatus === "OUT_FOR_DELIVERY") return 4;
  if (status === "IN_TRANSIT") return 3;
  if (status === "DISPATCHED") return 2;
  if (status === "READY_TO_DISPATCH") return 1;
  if (status === "CONFIRMED" || status === "RESERVED" || status === "PACKING") return 0;
  return -1;
}
