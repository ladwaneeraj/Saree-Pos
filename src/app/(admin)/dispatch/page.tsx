"use client";

import { Truck } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DispatchCardView, type DispatchCardHandlers } from "@/components/dispatch/dispatch-card";
import { DispatchDialog } from "@/components/dispatch/dispatch-dialog";
import { PickListDialog, type PickTarget } from "@/components/dispatch/pick-list-dialog";
import { useOrderAction } from "@/components/orders/use-order-action";
import { useLive } from "@/hooks/use-live";
import { advanceShipment, getDispatchBoard, markDelivered, startPacking, type DispatchCard, type DispatchColumn } from "@/services/dispatch";
import type { Order, ShipmentStatus } from "@/domain/types";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLUMNS: { key: DispatchColumn; label: string; hint: string; accent: string }[] = [
  { key: "TO_PACK", label: "To pack", hint: "Paid and reserved", accent: "bg-primary" },
  { key: "READY", label: "Ready to dispatch", hint: "Packed, waiting for pickup", accent: "bg-gold" },
  { key: "DISPATCHED", label: "Dispatched", hint: "Handed to courier", accent: "bg-info" },
  { key: "IN_TRANSIT", label: "In transit", hint: "On the way", accent: "bg-info" },
  { key: "DELIVERED", label: "Delivered", hint: "Last 7 days", accent: "bg-success" },
];

const SHIPMENT_LABEL: Record<ShipmentStatus, string> = {
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
};

function pickTarget(card: DispatchCard): PickTarget {
  return {
    id: card.order.id,
    number: card.order.number,
    customerName: card.order.customer.name,
    lines: card.items.map((i, idx) => ({ id: i.id, sku: i.sku, designName: i.designName, colourName: i.colourName, imageId: i.imageId, location: card.locations[idx] ?? null })),
  };
}

export default function DispatchPage() {
  const { data: board } = useLive(getDispatchBoard, []);
  const [tab, setTab] = useState<DispatchColumn>("TO_PACK");
  const [pick, setPick] = useState<PickTarget | null>(null);
  const [dispatching, setDispatching] = useState<Order | null>(null);

  const pack = useOrderAction(startPacking, "Packing started");
  const advance = useOrderAction(advanceShipment, (s: ShipmentStatus) => `Tracking updated: ${SHIPMENT_LABEL[s]}`);
  const deliver = useOrderAction(markDelivered, "Marked as delivered");

  const handlers: DispatchCardHandlers = {
    busy: pack.pending || advance.pending || deliver.pending,
    onPack: async (card) => {
      if (await pack.run(card.order.id)) setPick(pickTarget(card));
    },
    onPickList: (card) => setPick(pickTarget(card)),
    onDispatch: (card) => setDispatching(card.order),
    onAdvance: (card) => void advance.run(card.order.id),
    onDelivered: (card) => void deliver.run(card.order.id),
  };

  const toPackValue = board?.TO_PACK.reduce((s, c) => s + c.order.total, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Dispatch"
        description={
          board ? (
            <>
              {board.TO_PACK.length} to pack ({formatINR(toPackValue)}) · {board.READY.length} ready for pickup · {board.DISPATCHED.length + board.IN_TRANSIT.length} on the way
            </>
          ) : (
            "Loading shipments…"
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as DispatchColumn)} className="mb-4 lg:hidden">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none">
          <TabsList>
            {COLUMNS.map((c) => (
              <TabsTrigger key={c.key} value={c.key} className="gap-1.5">
                {c.label}
                <span className="text-xs text-muted-foreground tabular">{board?.[c.key].length ?? ""}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        <div className="lg:grid lg:min-w-[1360px] lg:grid-cols-5 lg:gap-3">
          {COLUMNS.map((c) => {
            const cards = board?.[c.key];
            return (
              <section key={c.key} className={cn("flex-col rounded-xl lg:flex lg:bg-muted/50 lg:p-2", tab === c.key ? "flex" : "hidden")}>
                <header className="mb-2 hidden items-center gap-2 px-1 pt-1 lg:flex">
                  <span className={cn("size-2 rounded-full", c.accent)} />
                  <h2 className="text-sm font-semibold whitespace-nowrap">{c.label}</h2>
                  <span className="rounded-full bg-card px-1.5 text-xs font-medium text-muted-foreground tabular ring-1 ring-border">{cards?.length ?? 0}</span>
                  <span className="ml-auto truncate text-[11px] text-muted-foreground">{c.hint}</span>
                </header>
                <div className="space-y-2">
                  {!cards && Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
                  {cards?.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card/50 px-3 py-8 text-center text-xs text-muted-foreground">
                      <Truck className="size-4" />
                      Nothing here right now
                    </div>
                  )}
                  {cards?.map((card) => <DispatchCardView key={card.order.id} card={card} column={c.key} handlers={handlers} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <PickListDialog target={pick} open={!!pick} onOpenChange={(o) => !o && setPick(null)} />
      <DispatchDialog order={dispatching} open={!!dispatching} onOpenChange={(o) => !o && setDispatching(null)} />
    </>
  );
}
