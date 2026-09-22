"use client";

import { ScanLine } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useLive } from "@/hooks/use-live";
import { cn } from "@/lib/utils";
import { getScanSamples } from "@/services/pos";
import { Barcode } from "@/components/shared/barcode";
import { blockedLabel } from "./piece-picker-dialog";

const SCAN_MS = 650;

/** Demo stand-in for a handheld scanner: click a printed label to "scan" it. */
export function ScanDialog({ open, onOpenChange, onScan }: { open: boolean; onOpenChange: (o: boolean) => void; onScan: (sku: string) => Promise<unknown> }) {
  const { data } = useLive(() => (open ? getScanSamples(6) : Promise.resolve(null)), [open]);
  const [scanning, setScanning] = useState<string | null>(null);

  const scan = (sku: string) => {
    if (scanning) return;
    setScanning(sku);
    setTimeout(async () => {
      await onScan(sku);
      setScanning(null);
    }, SCAN_MS);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <style>{`@keyframes pos-laser{0%{top:8%;opacity:0}15%{opacity:1}50%{top:88%}85%{opacity:1}100%{top:8%;opacity:0}}`}</style>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ScanLine className="size-5 text-primary" /> Simulate barcode scan</DialogTitle>
          <DialogDescription>Click a label to scan it, exactly like a USB scanner at the counter. The last labels belong to pieces that cannot be sold, so you can see the scanner refuse them.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {!data
            ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-36 rounded-lg" />)
            : data.map((s) => {
                const active = scanning === s.item.sku;
                return (
                  <button
                    key={s.item.id}
                    type="button"
                    data-testid="scan-label"
                    data-sku={s.item.sku}
                    onClick={() => scan(s.item.sku)}
                    disabled={!!scanning}
                    className={cn(
                      "group relative flex flex-col items-center gap-1 overflow-hidden rounded-lg border bg-white px-2 pt-2.5 pb-2 text-center text-black shadow-xs transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait",
                      active && "ring-2 ring-primary",
                      s.blockedReason && "border-dashed",
                    )}
                  >
                    <div className="w-full truncate text-[10px] font-semibold tracking-wide uppercase">Dhanvi Silks</div>
                    <Barcode value={s.item.sku} height={36} moduleWidth={1.1} className="max-w-full" />
                    <div className="font-mono text-xs font-semibold">{s.item.sku}</div>
                    <div className="w-full truncate text-[10px] text-neutral-500">{s.designName} · {s.colourName}</div>
                    {s.blockedReason && (
                      <div className="mt-0.5 w-full truncate rounded bg-warning-soft px-1 text-[10px] font-medium text-[oklch(0.5_0.12_65)]">{blockedLabel(s.blockedReason, s.item.sku)}</div>
                    )}
                    {active && <span className="pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.7)]" style={{ animation: `pos-laser ${SCAN_MS}ms ease-in-out` }} />}
                  </button>
                );
              })}
        </div>
        <p className="text-xs text-muted-foreground">Tip: with a real scanner you can scan anywhere on this page. The search box does not need focus.</p>
      </DialogContent>
    </Dialog>
  );
}
