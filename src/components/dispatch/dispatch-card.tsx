"use client";

import { withBase } from "@/lib/base-path";

import { CheckCircle2, ExternalLink, MapPin, MoreHorizontal, Navigation, Package, PackageOpen, ScrollText, Truck } from "lucide-react";
import Link from "next/link";
import { useNow } from "@/hooks/use-now";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PaymentStatusBadge, Pill } from "@/components/shared/status-badge";
import { MediaImage } from "@/components/shared/media-image";
import type { DispatchCard as Card, DispatchColumn } from "@/services/dispatch";
import { formatINR, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DispatchCardHandlers {
  onPack: (card: Card) => void;
  onPickList: (card: Card) => void;
  onDispatch: (card: Card) => void;
  onAdvance: (card: Card) => void;
  onDelivered: (card: Card) => void;
  busy: boolean;
}

const HOUR = 3_600_000;

export function DispatchCardView({ card, column, handlers }: { card: Card; column: DispatchColumn; handlers: DispatchCardHandlers }) {
  const { order, items, locations, shipment } = card;
  const now = useNow(60_000);
  const ageMs = now - order.createdAt;
  const late = (column === "TO_PACK" || column === "READY") && ageMs > 24 * HOUR;
  const racks = [...new Set(locations.filter(Boolean))].sort();
  const packing = order.status === "PACKING";
  const lastEvent = shipment?.events.at(-1);

  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/orders/view?number=${order.number}`} className="font-semibold tabular hover:underline">
            #{order.number}
          </Link>
          <div className="truncate text-sm">{order.customer.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {order.shippingAddress ? `${order.shippingAddress.city}, ${order.shippingAddress.state}` : "No address"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-semibold tabular">{formatINR(order.total)}</span>
          <span className={cn("text-[11px] tabular", late ? "font-medium text-destructive" : "text-muted-foreground")}>{formatRelative(order.createdAt, now)}</span>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5">
        {items.slice(0, 4).map((i) => (
          <MediaImage key={i.id} id={i.imageId} alt={i.designName} thumb className="w-8" rounded="rounded" />
        ))}
        <span className="ml-1 text-xs whitespace-nowrap text-muted-foreground">{pluralize(items.length, "saree")}</span>
        <div className="ml-auto">
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      {(column === "TO_PACK" || column === "READY") && racks.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <MapPin className="size-3 text-muted-foreground" />
          {racks.map((r) => (
            <span key={r} className="rounded bg-wine-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
              {r}
            </span>
          ))}
        </div>
      )}
      {packing && (
        <div className="mt-2">
          <Pill tone="gold">Packing in progress</Pill>
        </div>
      )}
      {shipment && (
        <div className="mt-2.5 rounded-lg bg-muted/60 px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{shipment.courier}</span>
            <span className="font-mono text-muted-foreground">{shipment.awb}</span>
          </div>
          {lastEvent && (
            <div className="mt-0.5 truncate text-muted-foreground">
              {lastEvent.description} · {lastEvent.location}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1.5">
        {column === "TO_PACK" &&
          (packing ? (
            <Button size="sm" className="flex-1" onClick={() => handlers.onPickList(card)} disabled={handlers.busy}>
              <ScrollText /> Pick list
            </Button>
          ) : (
            <Button size="sm" className="flex-1" onClick={() => handlers.onPack(card)} disabled={handlers.busy}>
              <PackageOpen /> Pack
            </Button>
          ))}
        {column === "READY" && (
          <Button size="sm" className="flex-1" onClick={() => handlers.onDispatch(card)} disabled={handlers.busy}>
            <Truck /> Dispatch
          </Button>
        )}
        {(column === "DISPATCHED" || column === "IN_TRANSIT") && (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => handlers.onAdvance(card)} disabled={handlers.busy}>
              <Navigation /> Update
            </Button>
            <Button size="sm" className="flex-1" onClick={() => handlers.onDelivered(card)} disabled={handlers.busy}>
              <CheckCircle2 /> Delivered
            </Button>
          </>
        )}
        {column === "DELIVERED" && (
          <span className="inline-flex flex-1 items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="size-3.5" />
            Delivered {shipment?.deliveredAt ? formatRelative(shipment.deliveredAt) : formatRelative(order.updatedAt)}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/orders/view?number=${order.number}`}>
                <Package /> Open order
              </Link>
            </DropdownMenuItem>
            {column === "TO_PACK" && packing && (
              <DropdownMenuItem onSelect={() => handlers.onPickList(card)}>
                <ScrollText /> Mark ready
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a href={withBase(`/track?id=${order.id}`)} target="_blank" rel="noreferrer">
                <ExternalLink /> Tracking page
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
