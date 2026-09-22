"use client";

import { ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Order } from "@/domain/types";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatINR } from "@/lib/format";
import { getPosCart } from "@/services/pos";
import { CartPanel } from "@/components/pos/cart-panel";
import { CatalogPanel } from "@/components/pos/catalog-panel";
import { usePosDraft } from "@/components/pos/pos-store";
import { computePosTotals } from "@/components/pos/pos-totals";
import { ReceiptDialog } from "@/components/pos/receipt-dialog";

export default function PosPage() {
  const { data: lines } = useLive(getPosCart, []);
  const settings = useSettings();
  const draft = usePosDraft();
  const [completed, setCompleted] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const total = computePosTotals(lines ?? [], draft, settings?.tax.gstRate ?? 5).total;
  const count = lines?.length ?? 0;

  const onCompleted = (order: Order) => {
    setSheetOpen(false);
    setCompleted(order);
  };

  return (
    <div className="flex flex-col pb-16 lg:-mb-8 lg:h-[calc(100dvh-3.5rem)] lg:flex-row lg:pb-0">
      <CatalogPanel className="min-h-[calc(100dvh-3.5rem)] flex-1 lg:min-h-0" />
      <CartPanel lines={lines} onCompleted={onCompleted} className="hidden w-[400px] shrink-0 border-l lg:flex 2xl:w-[460px]" />

      {/* Phones and tablets: the bill lives in a bottom sheet. */}
      <div className="fixed inset-x-0 bottom-14 z-20 border-t bg-card/95 px-4 py-2.5 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur lg:hidden">
        <button type="button" onClick={() => setSheetOpen(true)} className="flex w-full items-center gap-3 text-left" data-testid="pos-mobile-bar">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">{count === 0 ? "Bill is empty" : `${count} ${count === 1 ? "saree" : "sarees"} in bill`}</div>
            <div className="text-lg font-semibold tabular">{formatINR(total)}</div>
          </div>
          <Button asChild size="lg" className="rounded-xl" disabled={count === 0}>
            <span>View bill <ChevronUp /></span>
          </Button>
        </button>
      </div>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="h-[92dvh] gap-0 rounded-t-2xl p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Current bill</SheetTitle>
          <CartPanel lines={lines} onCompleted={onCompleted} onClose={() => setSheetOpen(false)} className="h-full rounded-t-2xl" />
        </SheetContent>
      </Sheet>

      <ReceiptDialog order={completed} onNewSale={() => setCompleted(null)} />
    </div>
  );
}
