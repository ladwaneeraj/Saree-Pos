import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Percentage change vs a comparison period. */
  delta?: number | null;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, delta, loading, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground/70" />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</div>
      )}
      <div className="mt-1 flex min-h-5 items-center gap-2 text-xs text-muted-foreground">
        {delta != null && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta >= 0 ? "text-success" : "text-destructive")}>
            {delta >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(Math.round(delta))}%
          </span>
        )}
        {hint}
      </div>
    </div>
  );
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
