import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Price({ price, mrp, discount, size = "sm", className }: { price: number; mrp: number; discount: number; size?: "sm" | "lg"; className?: string }) {
  const showMrp = mrp > price;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular", className)}>
      <span className={cn("font-semibold text-foreground", size === "lg" ? "text-2xl" : "text-[15px]")}>{formatINR(price)}</span>
      {showMrp && <span className={cn("text-muted-foreground line-through", size === "lg" ? "text-base" : "text-xs")}>{formatINR(mrp)}</span>}
      {showMrp && discount > 0 && <span className={cn("font-medium text-success", size === "lg" ? "text-sm" : "text-xs")}>{discount}% off</span>}
    </div>
  );
}

/** Customer-facing availability line. Returns null when there is nothing worth saying. */
export function availabilityLabel(available: number, scarcityThreshold: number): { text: string; tone: "sold" | "scarce" } | null {
  if (available <= 0) return { text: "Sold out", tone: "sold" };
  if (available === 1) return { text: "Only 1 available", tone: "scarce" };
  if (available <= scarcityThreshold) return { text: `Only ${available} left`, tone: "scarce" };
  return null;
}
