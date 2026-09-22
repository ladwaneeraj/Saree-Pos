"use client";

import { AlertTriangle, ArrowUpRight, Clock, Mail, MapPin, Phone, ReceiptText, RotateCcw, Truck, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { CopyButton, KeyValue } from "@/components/shared/misc";
import { PageHeader, SectionTitle } from "@/components/shared/page-header";
import { ChannelBadge, OrderStatusBadge, PaymentStatusBadge, Pill, ReturnStatusBadge } from "@/components/shared/status-badge";
import { Timeline, type TimelineEntry } from "@/components/shared/timeline";
import { MessageList } from "@/components/orders/message-list";
import { OrderActions } from "@/components/orders/order-actions";
import { OrderProgress } from "@/components/orders/order-progress";
import type { Order, OrderEvent } from "@/domain/types";
import { useLive } from "@/hooks/use-live";
import { useNow } from "@/hooks/use-now";
import { formatDate, formatDateTime, formatINR, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, getOrderDetail, type OrderDetail, type OrderLine } from "@/services/orders";

function eventTone(e: OrderEvent): TimelineEntry["tone"] {
  if (e.status === "CANCELLED" || e.status === "RETURN_REQUESTED") return "danger";
  if (e.status === "DELIVERED" || e.status === "REFUNDED") return "success";
  if (e.status === "PAYMENT_PENDING") return "warning";
  if (e.status === null) return "muted";
  return "default";
}

export default function OrderDetailPage() {
  const params = useParams<{ number: string }>();
  const key = decodeURIComponent(params.number);
  const { data } = useLive(() => getOrderDetail(key), [key]);

  if (data === undefined) return <DetailSkeleton />;
  if (data === null)
    return (
      <EmptyState
        icon={ReceiptText}
        title={`Order ${key.startsWith("#") ? key : `#${key}`} not found`}
        description="Check the order number or search from the orders list."
        action={<Link href="/orders" className="text-sm font-medium text-primary hover:underline">Back to orders</Link>}
        className="mt-10"
      />
    );

  const { order } = data;
  return (
    <>
      <PageHeader
        back={{ href: "/orders", label: "Orders" }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            Order #{order.number}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ChannelBadge channel={order.channel} />
            <span>·</span>
            <span>Placed {formatDateTime(order.createdAt)}</span>
            <span>·</span>
            <span>{order.fulfilment === "SHIPPING" ? "Home delivery" : "Collect at store"}</span>
            {order.exchangeOfOrderId && (
              <>
                <span>·</span>
                <Pill tone="gold" dot={false}>Exchange order</Pill>
              </>
            )}
          </span>
        }
        actions={<OrderActions detail={data} />}
      />

      <Banners order={order} />
      <OrderProgress order={order} shipmentStatus={data.shipment?.status} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionTitle>{pluralize(order.itemCount, "saree")}</SectionTitle>
            <ul className="divide-y">
              {data.lines.map((l) => <LineRow key={l.id} line={l} />)}
            </ul>
          </Card>

          <Card>
            <SectionTitle>Payment</SectionTitle>
            <PaymentSummary detail={data} />
          </Card>

          <Card>
            <SectionTitle>Order timeline</SectionTitle>
            <Timeline
              entries={order.timeline.map((e) => ({
                id: e.id,
                title: e.label,
                at: e.at,
                tone: eventTone(e),
                meta: (
                  <>
                    {e.actorName}
                    {e.note && <span className="text-foreground/80"> · {e.note}</span>}
                  </>
                ),
              }))}
            />
          </Card>

          <Card>
            <SectionTitle>Messages sent to customer</SectionTitle>
            <MessageList notifications={data.notifications} emptyText="Order updates sent on WhatsApp will appear here." />
          </Card>
        </div>

        <div className="space-y-6">
          <CustomerCard detail={data} />
          {order.shippingAddress && (
            <Card>
              <SectionTitle>Shipping address</SectionTitle>
              <div className="flex gap-2.5 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">{order.shippingAddress.name}</div>
                  <div className="text-muted-foreground">
                    {[order.shippingAddress.line1, order.shippingAddress.line2].filter(Boolean).join(", ")}
                    <br />
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
                  </div>
                  {order.shippingAddress.phone && <div className="mt-1 text-muted-foreground">+91 {order.shippingAddress.phone}</div>}
                </div>
              </div>
            </Card>
          )}
          <ShipmentCard detail={data} />
          {data.returns.length > 0 && (
            <Card>
              <SectionTitle>Returns and exchanges</SectionTitle>
              <ul className="space-y-2">
                {data.returns.map((r) => (
                  <li key={r.id}>
                    <Link href={`/returns?open=${r.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/50">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium">
                          <RotateCcw className="size-3.5 text-muted-foreground" />
                          {r.number} · {r.type === "EXCHANGE" ? "Exchange" : "Return"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{r.reason}</div>
                      </div>
                      <ReturnStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {order.notes && (
            <Card>
              <SectionTitle>Order notes</SectionTitle>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", className)}>{children}</section>;
}

function Banners({ order }: { order: Order }) {
  const now = useNow(30_000);
  if (order.status === "PAYMENT_PENDING" && order.paymentDueAt) {
    const overdue = order.paymentDueAt < now;
    return (
      <div className={cn("mb-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm", overdue ? "border-destructive/30 bg-danger-soft" : "border-warning/30 bg-warning-soft")}>
        <Clock className={cn("size-4 shrink-0", overdue ? "text-destructive" : "text-warning")} />
        <span>
          Awaiting payment of <strong>{formatINR(order.total)}</strong>. The sarees are held until {formatDateTime(order.paymentDueAt)}
          {overdue ? " (payment window has passed)." : ` (${formatRelative(order.paymentDueAt, now)}).`}
        </span>
      </div>
    );
  }
  if (order.status === "CANCELLED") {
    const ev = [...order.timeline].reverse().find((e) => e.status === "CANCELLED");
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-xl border bg-muted px-4 py-3 text-sm">
        <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
        <span>
          Cancelled {ev ? `on ${formatDateTime(ev.at)} by ${ev.actorName}` : ""}
          {ev?.note ? `: ${ev.note}` : ""}. Reserved pieces were released back to stock.
        </span>
      </div>
    );
  }
  return null;
}

function LineRow({ line }: { line: OrderLine }) {
  const priceChanged = line.currentPrice !== null && line.currentPrice !== line.unitPrice;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0 sm:gap-4">
      <MediaImage id={line.imageId} alt={line.designName} thumb className="w-16 shrink-0 sm:w-[72px]" rounded="rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <div className="font-medium">{line.designName}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <Link href={`/inventory/${line.sku}`} className="font-mono font-medium text-primary hover:underline">
                {line.sku}
              </Link>
              <span>·</span>
              <span>{line.colourName}</span>
              <span>·</span>
              <span>{line.fabricName}</span>
              {line.location && line.currentStatus === "RESERVED" && (
                <>
                  <span>·</span>
                  <span>Rack {line.location}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-semibold tabular">{formatINR(line.lineTotal)}</div>
            {line.mrp > line.lineTotal && <div className="text-xs text-muted-foreground line-through tabular">{formatINR(line.mrp)}</div>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {line.status !== "ACTIVE" && <Pill tone={line.status === "RETURNED" ? "neutral" : "gold"}>{line.status === "RETURNED" ? "Returned" : "Exchanged"}</Pill>}
          {line.discount > 0 && <Pill tone="info" dot={false}>{formatINR(line.discount)} line discount</Pill>}
          {priceChanged && (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground" title="Order prices are a snapshot from the time of sale and never change.">
              Charged <strong className="mx-1 text-foreground tabular">{formatINR(line.unitPrice)}</strong> · current price <span className="ml-1 tabular">{formatINR(line.currentPrice!)}</span>
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function PaymentSummary({ detail }: { detail: OrderDetail }) {
  const { order, payments } = detail;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="divide-y divide-dashed">
        <div>
          <KeyValue label={`Subtotal (${pluralize(order.itemCount, "item")})`}>{formatINR(order.subtotal)}</KeyValue>
          {order.discount > 0 && <KeyValue label="Order discount"><span className="text-success">-{formatINR(order.discount)}</span></KeyValue>}
          <KeyValue label="Shipping">{order.shippingFee > 0 ? formatINR(order.shippingFee) : order.fulfilment === "SHIPPING" ? "Free" : "Not applicable"}</KeyValue>
        </div>
        <div>
          <KeyValue label="Total" className="text-base">
            <span className="text-base font-semibold tabular">{formatINR(order.total)}</span>
          </KeyValue>
          <p className="-mt-1 text-right text-xs text-muted-foreground">Includes GST {formatINR(order.taxAmount)} ({order.taxRate}%)</p>
        </div>
      </div>
      <div className="md:border-l md:pl-5">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Transactions</div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment received yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...payments].sort((a, b) => a.createdAt - b.createdAt).map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.kind === "REFUND" && <Pill tone="danger" dot={false} className="h-5 px-1.5 text-[10px]">Refund</Pill>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.reference ? <span className="font-mono">{p.reference}</span> : "No reference"} · {formatDate(p.createdAt)}
                  </div>
                </div>
                <span className={cn("font-medium tabular", p.kind === "REFUND" && "text-destructive")}>
                  {p.kind === "REFUND" ? "-" : ""}
                  {formatINR(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(detail.paid > 0 || detail.refunded > 0) && (
          <div className="mt-3 flex justify-between border-t pt-2 text-sm">
            <span className="text-muted-foreground">Net received</span>
            <span className="font-semibold tabular">{formatINR(detail.paid - detail.refunded)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerCard({ detail }: { detail: OrderDetail }) {
  const { order, customer } = detail;
  return (
    <Card>
      <SectionTitle
        action={
          customer && (
            <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              View profile <ArrowUpRight className="size-3" />
            </Link>
          )
        }
      >
        Customer
      </SectionTitle>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-wine-50 text-primary">
          <User className="size-4" />
        </div>
        <div className="min-w-0">
          {customer ? (
            <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">{order.customer.name}</Link>
          ) : (
            <div className="font-medium">{order.customer.name}</div>
          )}
          {customer && (
            <div className="text-xs text-muted-foreground">
              {pluralize(customer.stats.orderCount, "order")} · {formatINR(customer.stats.totalSpend)} lifetime
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        {order.customer.phone && (
          <a href={`tel:+91${order.customer.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <Phone className="size-3.5" /> +91 {order.customer.phone}
          </a>
        )}
        {order.customer.email && (
          <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 truncate text-muted-foreground hover:text-foreground">
            <Mail className="size-3.5" /> {order.customer.email}
          </a>
        )}
      </div>
    </Card>
  );
}

const SHIPMENT_TONE = { DISPATCHED: "default", IN_TRANSIT: "default", OUT_FOR_DELIVERY: "warning", DELIVERED: "success" } as const;

function ShipmentCard({ detail }: { detail: OrderDetail }) {
  const { shipment, order } = detail;
  if (order.fulfilment !== "SHIPPING") return null;
  return (
    <Card>
      <SectionTitle>Shipment</SectionTitle>
      {!shipment ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <Truck className="size-4 shrink-0" />
          {order.status === "CANCELLED" ? "Not shipped." : "Not dispatched yet. Courier and AWB are added at dispatch."}
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-muted/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{shipment.courier}</span>
              <CopyButton text={shipment.awb} label="Copy AWB" size="sm" variant="ghost" className="h-7 px-2 text-xs" />
            </div>
            <div className="font-mono text-sm">{shipment.awb}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {shipment.deliveredAt ? `Delivered ${formatDateTime(shipment.deliveredAt)}` : `Expected by ${formatDate(shipment.expectedDeliveryAt)}`}
            </div>
          </div>
          <div className="mt-4">
            <Timeline
              reverse
              entries={shipment.events.map((e, i) => ({ id: `${i}`, title: e.description, meta: e.location, at: e.at, tone: SHIPMENT_TONE[e.status] }))}
            />
          </div>
        </>
      )}
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
