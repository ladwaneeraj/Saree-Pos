import { Check } from "lucide-react";
import type { Order, OrderStatus, ShipmentStatus } from "@/domain/types";
import { formatShortDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  /** Statuses whose timeline event marks this step as reached. */
  statuses: OrderStatus[];
}

const SHIPPING_STEPS: Step[] = [
  { label: "Order placed", statuses: [] },
  { label: "Payment confirmed", statuses: ["CONFIRMED", "RESERVED"] },
  { label: "Packed", statuses: ["READY_TO_DISPATCH"] },
  { label: "Dispatched", statuses: ["DISPATCHED"] },
  { label: "In transit", statuses: ["IN_TRANSIT"] },
  { label: "Delivered", statuses: ["DELIVERED"] },
];

const STORE_STEPS: Step[] = [
  { label: "Order placed", statuses: [] },
  { label: "Payment confirmed", statuses: ["CONFIRMED", "RESERVED"] },
  { label: "Handed over", statuses: ["DELIVERED"] },
];

const SHIPPING_RANK: Record<OrderStatus, number> = {
  NEW: 0, PAYMENT_PENDING: 0, CONFIRMED: 1, RESERVED: 1, PACKING: 1, READY_TO_DISPATCH: 2, DISPATCHED: 3, IN_TRANSIT: 4,
  DELIVERED: 5, RETURN_REQUESTED: 5, RETURNED: 5, REFUNDED: 5, CANCELLED: -1,
};

/** Horizontal milestone bar: Order placed → Payment confirmed → Packed → Dispatched → In transit → Delivered. */
export function OrderProgress({ order, shipmentStatus }: { order: Order; shipmentStatus?: ShipmentStatus }) {
  if (order.status === "CANCELLED") return null;
  const shipping = order.fulfilment === "SHIPPING";
  const steps = shipping ? SHIPPING_STEPS : STORE_STEPS;
  let rank = SHIPPING_RANK[order.status];
  if (!shipping) rank = rank >= 5 ? 2 : Math.min(rank, 1);
  if (order.status === "PAYMENT_PENDING" || order.status === "NEW") rank = 0;
  else rank = Math.max(rank, 1);

  const at = (step: Step, i: number): number | null => {
    if (i === 0) return order.createdAt;
    const ev = order.timeline.find((e) => e.status && step.statuses.includes(e.status));
    if (ev) return ev.at;
    return i <= rank && i === 1 ? order.createdAt : null;
  };

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border bg-card px-4 py-4 shadow-xs scrollbar-none sm:px-6">
      <ol className="flex min-w-[560px] items-start">
        {steps.map((step, i) => {
          const done = i <= rank;
          const current = i === rank && i < steps.length - 1;
          const ts = done ? at(step, i) : null;
          return (
            <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
              {i > 0 && <span className={cn("absolute top-3 right-1/2 h-0.5 w-full -translate-y-1/2", i <= rank ? "bg-primary" : "bg-border")} />}
              <span
                className={cn(
                  "relative z-10 flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold",
                  done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                  current && "ring-4 ring-wine-100",
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn("mt-2 text-xs font-medium", done ? "text-foreground" : "text-muted-foreground")}>
                {step.label === "In transit" && shipmentStatus === "OUT_FOR_DELIVERY" ? "Out for delivery" : step.label}
              </span>
              <span className="text-[11px] text-muted-foreground tabular">{ts ? `${formatShortDate(ts)}, ${formatTime(ts)}` : " "}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
