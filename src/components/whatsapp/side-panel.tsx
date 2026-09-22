"use client";

import { Clock, ExternalLink, Hand, IndianRupee, PackageCheck, Search, Send, ShoppingCart, Store, Truck, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { customerType } from "@/domain/rules/customers";
import type { Order } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { handOverAtStore } from "@/services/dispatch";
import { listStoreProducts, type StoreProduct } from "@/services/storefront";
import { holdForConversation, releaseFromConversation, sendPaymentRequest, sendProduct } from "@/services/whatsapp";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot } from "@/components/shared/misc";
import { CustomerTypeBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import type { ConversationData } from "./chat-view";
import { WaAvatar } from "./conversation-list";
import { CreateOrderDialog } from "./create-order-dialog";
import { MarkPaidDialog } from "./mark-paid-dialog";

function Section({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-4">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        {count !== undefined && count > 0 && <span className="rounded-full bg-muted px-1.5 text-xs font-medium tabular">{count}</span>}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

export function SidePanel({ data, className }: { data: ConversationData | undefined; className?: string }) {
  const [orderOpen, setOrderOpen] = useState(false);
  if (!data) {
    return (
      <aside className={cn("space-y-4 bg-white p-4", className)}>
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </aside>
    );
  }
  const { conversation, held, orders, customer } = data;
  return (
    <aside className={cn("min-h-0 overflow-y-auto bg-white", className)} aria-label="Customer and catalogue">
      <CustomerCard data={data} />
      <Section
        title="Held for this chat"
        count={held.length}
        action={
          <Button size="xs" onClick={() => setOrderOpen(true)} disabled={held.length === 0} data-testid="wa-create-order">
            <ShoppingCart /> Create order
          </Button>
        }
      >
        <HeldList data={data} />
      </Section>
      {orders.length > 0 && (
        <Section title="Orders from this chat" count={orders.length}>
          <ul className="space-y-2">{orders.map((o) => <OrderRow key={o.id} order={o} conversationId={conversation.id} />)}</ul>
        </Section>
      )}
      <Section title="Catalogue">
        <CatalogueSearch conversationId={conversation.id} />
      </Section>
      <CreateOrderDialog open={orderOpen} onOpenChange={setOrderOpen} conversationId={conversation.id} defaultName={customer?.name ?? conversation.name} customer={customer} held={held} />
    </aside>
  );
}

function CustomerCard({ data }: { data: ConversationData }) {
  const settings = useSettings();
  const now = useNow(60_000);
  const { conversation, customer } = data;
  const type = customer && settings ? customerType(customer, now, settings.store) : null;
  const city = customer?.addresses[0]?.city;
  return (
    <section className="flex items-center gap-3 border-b px-4 py-4" data-testid="wa-customer">
      <WaAvatar name={conversation.name} className="size-12 text-base" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{customer?.name ?? conversation.name}</span>
          {type ? <CustomerTypeBadge type={type} /> : <span className="text-xs text-muted-foreground">New lead</span>}
        </div>
        <div className="text-sm text-muted-foreground tabular">+91 {conversation.phone}{city ? ` · ${city}` : ""}</div>
        {customer && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            {customer.stats.orderCount} order{customer.stats.orderCount === 1 ? "" : "s"} · {formatINR(customer.stats.totalSpend)} spent
            <Link href={`/customers/${customer.id}`} className="ml-2 text-primary hover:underline">Profile</Link>
          </div>
        )}
      </div>
    </section>
  );
}

function HeldList({ data }: { data: ConversationData }) {
  const now = useNow(30_000);
  const release = useAction(releaseFromConversation, { success: "Released back to stock" });
  if (data.held.length === 0) {
    return <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Hold a saree from the catalogue below so no other channel can sell it while the customer decides.</p>;
  }
  return (
    <ul className="space-y-2">
      {data.held.map((l) => {
        const left = (l.expiresAt ?? now) - now;
        const hours = Math.floor(left / 3_600_000);
        const mins = Math.max(0, Math.floor((left % 3_600_000) / 60_000));
        return (
          <li key={l.item.id} className="flex items-center gap-3 rounded-lg border p-2" data-testid="wa-held">
            <MediaImage id={l.imageId} alt={l.design.name} thumb className="w-10 shrink-0" rounded="rounded" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{l.design.name}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">{l.item.sku}</span>
                <ColourDot hex={l.colour?.hex ?? "#999"} className="size-2.5" />
                {l.colour?.name}
              </div>
              {l.expiresAt && (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[oklch(0.5_0.12_65)]" title={`Held until ${formatDateTime(l.expiresAt)}`}>
                  <Clock className="size-3" /> Held until {formatDateTime(l.expiresAt)} · {hours}h {mins}m left
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold tabular">{formatINR(l.price)}</div>
              <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" onClick={() => release.run(data.conversation.id, l.item.id)} aria-label={`Release ${l.item.sku}`}>
                <X />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function OrderRow({ order, conversationId }: { order: Order; conversationId: string }) {
  const [payOpen, setPayOpen] = useState(false);
  const request = useAction(sendPaymentRequest, { success: "Payment link sent in the chat" });
  const handOver = useAction(handOverAtStore, { success: `Order #${order.number} collected at store` });
  const { confirm, dialog } = useConfirm();
  const awaiting = order.paymentStatus === "PENDING" && (order.status === "PAYMENT_PENDING" || order.status === "NEW");

  return (
    <li className="rounded-lg border p-3" data-testid="wa-order">
      <div className="flex items-center gap-2">
        <Link href={`/orders/${order.number}`} className="font-medium hover:text-primary hover:underline">#{order.number}</Link>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {order.fulfilment === "SHIPPING" ? <Truck className="size-3.5" /> : <Store className="size-3.5" />}
          {order.fulfilment === "SHIPPING" ? "Delivery" : "Pickup"}
        </span>
        <span className="ml-auto font-semibold tabular">{formatINR(order.total)}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <OrderStatusBadge status={order.status} />
        {order.status !== "PAYMENT_PENDING" && <PaymentStatusBadge status={order.paymentStatus} />}
      </div>
      {awaiting && order.paymentDueAt && <div className="mt-1.5 text-xs text-muted-foreground">Pay by {formatDateTime(order.paymentDueAt)} or the pieces go back to stock</div>}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {awaiting && (
          <>
            <Button size="xs" variant="outline" onClick={() => request.run(conversationId, order.id)} disabled={request.pending} data-testid="wa-send-payment">
              <Send /> Send payment request
            </Button>
            <Button size="xs" onClick={() => setPayOpen(true)} data-testid="wa-mark-paid"><IndianRupee /> Mark paid</Button>
          </>
        )}
        {order.status === "RESERVED" && order.fulfilment === "IN_STORE" && (
          <Button
            size="xs"
            variant="outline"
            disabled={handOver.pending}
            onClick={async () => {
              const ok = await confirm({ title: `Hand over order #${order.number}?`, description: "The reserved pieces are marked sold and the order is completed.", confirmLabel: "Collected at store" });
              if (ok) await handOver.run(order.id);
            }}
            data-testid="wa-collected"
          >
            <PackageCheck /> Collected at store
          </Button>
        )}
        {order.status === "RESERVED" && order.fulfilment === "SHIPPING" && (
          <Button size="xs" variant="ghost" asChild><Link href="/dispatch"><Truck /> Waiting in Dispatch</Link></Button>
        )}
      </div>
      <MarkPaidDialog order={payOpen ? order : null} conversationId={conversationId} onOpenChange={setPayOpen} />
      {dialog}
    </li>
  );
}

function CatalogueSearch({ conversationId }: { conversationId: string }) {
  const [q, setQ] = useState("");
  const { data } = useLive(() => listStoreProducts({ q, sort: "featured" }), [q]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sarees to send or hold" className="pl-9" aria-label="Search catalogue" />
      </div>
      <ul className="space-y-2">
        {!data
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)
          : data.slice(0, 20).map((p) => <CatalogueRow key={p.design.id} product={p} conversationId={conversationId} />)}
        {data?.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No published sarees match.</li>}
      </ul>
    </div>
  );
}

function CatalogueRow({ product, conversationId }: { product: StoreProduct; conversationId: string }) {
  const [colourId, setColourId] = useState<string | null>(product.colours[0]?.colour.id ?? null);
  const send = useAction(sendProduct, { success: "Product sent" });
  const hold = useAction(holdForConversation, { success: (i) => `${i.sku} held for this customer` });
  return (
    <li className="rounded-lg border p-2" data-testid="wa-catalogue-row">
      <div className="flex gap-2.5">
        <MediaImage id={product.imageId} alt={product.design.name} thumb className="w-12 shrink-0" rounded="rounded" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{product.design.name}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular">{formatINR(product.price)}</span>
            {product.discount > 0 && <span className="text-xs text-muted-foreground line-through tabular">{formatINR(product.mrp)}</span>}
            <span className={cn("ml-auto text-xs", product.available <= 2 ? "text-[oklch(0.5_0.12_65)]" : "text-success")}>{product.available} available</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {product.colours.map((c) => (
              <button
                key={c.colour.id}
                type="button"
                onClick={() => setColourId(c.colour.id)}
                title={`${c.colour.name} · ${c.available} available`}
                aria-label={`${c.colour.name}, ${c.available} available`}
                className={cn("flex h-6 items-center gap-1 rounded-full border px-1.5 text-[11px]", colourId === c.colour.id ? "border-primary bg-wine-50" : "hover:bg-accent")}
              >
                <ColourDot hex={c.colour.hex} className="size-2.5" />
                {c.colour.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Button size="xs" variant="outline" onClick={() => send.run(conversationId, product.design.id)} disabled={send.pending} data-testid="wa-send-product"><Send /> Send</Button>
        <Button size="xs" variant="outline" onClick={() => hold.run(conversationId, { designId: product.design.id, colourId })} disabled={hold.pending || product.available === 0} data-testid="wa-hold"><Hand /> Hold</Button>
        <Button size="xs" variant="ghost" asChild><Link href={`/store/p/${product.design.slug}`} target="_blank"><ExternalLink /> View</Link></Button>
      </div>
    </li>
  );
}
