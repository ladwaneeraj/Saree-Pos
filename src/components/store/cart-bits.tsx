"use client";

import { Clock } from "lucide-react";
import { formatCountdown, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ReservationTimer({ expiresAt, now, className }: { expiresAt: number | null; now: number; className?: string }) {
  if (!expiresAt) return null;
  const left = expiresAt - now;
  const urgent = left < 2 * 60_000;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular",
        urgent ? "bg-danger-soft text-destructive" : "bg-warning-soft text-[oklch(0.45_0.1_70)]",
        className,
      )}
      data-testid="reservation-timer"
    >
      <Clock className="size-3.5" /> Reserved for {formatCountdown(left)}
    </span>
  );
}

export function SummaryRows({ subtotal, shippingFee, total, count, freeAbove }: { subtotal: number; shippingFee: number; total: number; count: number; freeAbove: number }) {
  const gap = freeAbove - subtotal;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Subtotal ({count} {count === 1 ? "saree" : "sarees"})</span>
        <span className="tabular">{formatINR(subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Shipping</span>
        <span className={cn("tabular", shippingFee === 0 && "font-medium text-success")}>{shippingFee === 0 ? "Free" : formatINR(shippingFee)}</span>
      </div>
      {shippingFee > 0 && gap > 0 && <p className="rounded-md bg-wine-50 px-3 py-2 text-xs text-primary">Add {formatINR(gap)} more for free shipping.</p>}
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="font-medium">Total</span>
        <span className="text-xl font-semibold tabular" data-testid="order-total">{formatINR(total)}</span>
      </div>
      <p className="text-xs text-muted-foreground">Prices include GST.</p>
    </div>
  );
}
