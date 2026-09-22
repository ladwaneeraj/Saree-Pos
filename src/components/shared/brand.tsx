import { cn } from "@/lib/utils";

/** Dhanvi Silks monogram: a serif D with a zari underline. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <path d="M13 10.5h7.2c6.1 0 10.3 3.9 10.3 9.4s-4.2 9.6-10.3 9.6H13z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
      <path d="M13 33h14" className="stroke-gold" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-[22px] whitespace-nowrap">Dhanvi Silks</div>
          <div className="mt-1 text-[10px] font-medium tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase">Saree Commerce & Inventory</div>
        </div>
      )}
    </div>
  );
}
