"use client";

import { CheckCircle2, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";

export interface ReceivedInfo {
  purchaseId: string;
  number: string;
  pieces: number;
  totalCost: number;
  firstSku?: string;
  lastSku?: string;
}

/** Shown right after stock is received so labels are printed before pieces reach the racks. */
export function ReceivedDialog({ info, onClose, canSeeCost, onPurchasePage = false }: { info: ReceivedInfo | null; onClose: () => void; canSeeCost: boolean; onPurchasePage?: boolean }) {
  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {info && (
          <>
            <DialogHeader className="items-center text-center sm:text-center">
              <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-success-soft">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <DialogTitle className="font-display text-3xl font-normal">
                {info.pieces} {info.pieces === 1 ? "piece" : "pieces"} received
              </DialogTitle>
              <DialogDescription>
                {info.number}
                {canSeeCost && <> · {formatINR(info.totalCost)} at cost</>}
                {info.firstSku && (
                  <>
                    <br />
                    SKUs {info.firstSku}
                    {info.lastSku && info.lastSku !== info.firstSku && <> to {info.lastSku}</>} are now in stock and live on every channel.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">Print and tag labels now, before the sarees go to the racks. Labels show the SKU barcode only, never the price.</p>
            <DialogFooter className="sm:flex-col sm:space-x-0 gap-2">
              <Button size="lg" asChild className="w-full">
                <Link href={`/labels?purchase=${info.purchaseId}`}>
                  <Printer /> Print {info.pieces} {info.pieces === 1 ? "label" : "labels"}
                </Link>
              </Button>
              {onPurchasePage ? (
                <Button variant="outline" className="w-full" onClick={onClose}>Done</Button>
              ) : (
                <Button variant="outline" asChild className="w-full">
                  <Link href={`/purchases/view?id=${info.purchaseId}`}>View purchase</Link>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
