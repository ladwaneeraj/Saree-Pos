"use client";

import { Check, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PosCatalogEntry } from "@/services/pos";
import { MediaImage } from "@/components/shared/media-image";
import { Pill } from "@/components/shared/status-badge";

/** Lists every piece of a design so staff can pick the exact saree the customer is holding. */
export function PiecePickerDialog({ entry, onOpenChange, onAdd, pending }: { entry: PosCatalogEntry | null; onOpenChange: (o: boolean) => void; onAdd: (itemId: string) => void; pending: boolean }) {
  return (
    <Dialog open={!!entry} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        {entry && (
          <>
            <DialogHeader className="flex-row items-center gap-4 border-b p-5 text-left">
              <MediaImage id={entry.imageId} alt={entry.design.name} thumb className="w-16 shrink-0" rounded="rounded-md" />
              <div className="min-w-0 space-y-1">
                <DialogTitle className="truncate">{entry.design.name}</DialogTitle>
                <DialogDescription>
                  {entry.design.code} · {entry.fabricName} · {entry.available} of {entry.pieces.length} piece{entry.pieces.length === 1 ? "" : "s"} available
                </DialogDescription>
              </div>
            </DialogHeader>
            <ul className="max-h-[60vh] divide-y overflow-y-auto">
              {sortPieces(entry.pieces).map((p) => {
                const inCart = p.blockedReason === "In this cart";
                const blocked = !!p.blockedReason;
                return (
                  <li key={p.item.id} className={cn("flex items-center gap-3 px-5 py-3", blocked && !inCart && "bg-muted/40")}>
                    <span className="size-8 shrink-0 rounded-md ring-1 ring-black/10" style={{ background: p.colourHex }} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-medium">{p.item.sku}</span>
                        <span className="text-sm text-muted-foreground">{p.colourName}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3" />Rack {p.item.location}</span>
                        {blocked && !inCart && <Pill tone="warning" className="h-5 text-[11px]">{blockedLabel(p.blockedReason!, p.item.sku)}</Pill>}
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium tabular">{formatINR(p.price)}</div>
                    {inCart ? (
                      <Button size="sm" variant="secondary" disabled className="w-24"><Check /> In bill</Button>
                    ) : (
                      <Button size="sm" className="w-24" disabled={blocked || pending} onClick={() => onAdd(p.item.id)} aria-label={`Add ${p.item.sku}`}>
                        <Plus /> Add
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "SAR-00012 is reserved in a website cart" reads better without the SKU in a row that already shows it. */
export function blockedLabel(reason: string, sku: string): string {
  const text = reason.replace(sku, "").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const rank = (reason: string | null) => (reason === null ? 0 : reason === "In this cart" ? 1 : 2);

/** Sellable pieces first (oldest stock first), then pieces already in the bill, then blocked ones. */
function sortPieces(pieces: PosCatalogEntry["pieces"]) {
  return [...pieces].sort((a, b) => rank(a.blockedReason) - rank(b.blockedReason));
}
