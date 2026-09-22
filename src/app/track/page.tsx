"use client";

import { Suspense } from "react";
import { useQueryParam } from "@/hooks/use-query-param";

import { Check, ChevronDown, MapPin, MessageCircle, PackageSearch, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { CopyButton } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TRACKING_STEPS, trackingStepIndex } from "@/domain/rules/orders";
import { useLive } from "@/hooks/use-live";
import { formatDate, formatDateTime, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RETURN_STATUS_LABELS } from "@/services/returns";
import { getTrackingView, type TrackingView } from "@/services/storefront";
import { whatsappLink } from "@/components/store/constants";
import { OrderLines, WhatsAppBubble } from "@/components/store/order-bits";
import { ReturnSection, ReviewSection } from "@/components/store/tracking-forms";
import type { ReturnStatus } from "@/domain/types";

function TrackOrderPageView() {
  const orderId = useQueryParam("id");
  const { data: view } = useLive(() => getTrackingView(orderId), [orderId]);

  useEffect(() => {
    if (view && window.location.hash === "#review") document.getElementById("review")?.scrollIntoView({ behavior: "smooth" });
  }, [view]);

  if (view === undefined)
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  if (view === null)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <EmptyState icon={PackageSearch} title="We could not find this order" description="The tracking link may be incomplete. Look up your order with its number and mobile." action={<Button asChild><Link href="/store/track">Find my order</Link></Button>} />
      </div>
    );
  return <Tracking view={view} />;
}

function headline(view: TrackingView, idx: number): string {
  const s = view.order.status;
  if (s === "CANCELLED") return "This order was cancelled";
  if (s === "RETURN_REQUESTED") return "Your return request is being reviewed";
  if (s === "RETURNED" || s === "REFUNDED") return "Your return is complete";
  return ["Your order is confirmed", "Your order is packed", "Your order has been dispatched", "Your order is on its way", "Out for delivery today", "Delivered"][idx] ?? "Order received";
}

function Tracking({ view }: { view: TrackingView }) {
  const { order, shipment } = view;
  const [showEvents, setShowEvents] = useState(false);
  const idx = trackingStepIndex(order.status, shipment?.status);
  const cancelled = order.status === "CANCELLED";
  const delivered = idx === 5;
  const checkpoints = [
    ...order.timeline.map((e) => ({ key: e.id, title: e.label, detail: e.note, at: e.at })),
    ...(shipment?.events ?? []).map((e, i) => ({ key: `s${i}`, title: e.description, detail: e.location, at: e.at })),
  ].sort((a, b) => b.at - a.at);
  const messages = [...view.messages].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:py-10">
      <section className="rounded-xl border bg-card p-5 sm:p-8">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Order #{order.number}</p>
        <h1 className="mt-2 font-display text-[34px] leading-tight sm:text-5xl" data-testid="tracking-headline">{headline(view, idx)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Placed {formatDate(order.createdAt)}
          {shipment && !delivered && !cancelled && <> · Expected by <span className="font-medium text-foreground">{formatWeekday(shipment.expectedDeliveryAt)}</span></>}
          {shipment?.deliveredAt && <> · Delivered {formatDateTime(shipment.deliveredAt)}</>}
        </p>

        {cancelled ? (
          <p className="mt-6 flex items-center gap-2 rounded-lg bg-danger-soft p-4 text-sm text-destructive"><XCircle className="size-4" /> If you were charged, the refund is on its way to your original payment method.</p>
        ) : (
          <ol className="mt-8 grid gap-0 sm:grid-cols-6" data-testid="tracking-steps">
            {TRACKING_STEPS.map((step, i) => {
              const done = i < idx || (i === idx && (delivered || i === 0));
              const current = i === idx && !done;
              return (
                <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center">
                  {i < TRACKING_STEPS.length - 1 && (
                    <span className={cn("absolute top-7 bottom-0 left-[13px] w-0.5 sm:top-[13px] sm:left-[calc(50%+14px)] sm:h-0.5 sm:w-[calc(100%-28px)]", i < idx ? "bg-success" : "bg-border")} />
                  )}
                  <span
                    className={cn(
                      "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 bg-card text-xs",
                      done && "border-success bg-success text-white",
                      current && "border-primary",
                      !done && !current && "border-border",
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="size-4" strokeWidth={3} /> : current ? <span className="size-2.5 animate-pulse rounded-full bg-primary" /> : null}
                  </span>
                  <span className={cn("pt-1 text-sm sm:pt-0 sm:text-xs", done || current ? "font-medium text-foreground" : "text-muted-foreground")}>
                    <span className="sr-only">{done ? "Done: " : current ? "Current: " : "Upcoming: "}</span>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {view.openReturn && (
          <p className="mt-6 rounded-lg bg-info-soft p-3 text-sm">
            Return <span className="font-medium">{view.openReturn.number}</span>: {RETURN_STATUS_LABELS[view.openReturn.status as ReturnStatus] ?? view.openReturn.status}
          </p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wine-50 text-primary"><Truck className="size-5" /></span>
          {shipment ? (
            <div className="min-w-0 flex-1">
              <p className="font-medium">{shipment.courier}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                AWB <span className="font-mono text-foreground">{shipment.awb}</span>
                <CopyButton text={shipment.awb} size="icon-sm" variant="ghost" />
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <p className="font-medium">Courier details</p>
              <p className="text-sm text-muted-foreground">{cancelled ? "This order was not shipped." : "We will share the courier and AWB number as soon as your saree is dispatched."}</p>
            </div>
          )}
        </div>
        <Button variant="outline" className="mt-4 h-12 w-full text-xs font-semibold tracking-[0.14em] uppercase" onClick={() => setShowEvents((v) => !v)} aria-expanded={showEvents} data-testid="track-shipment">
          Track shipment <ChevronDown className={cn("transition", showEvents && "rotate-180")} />
        </Button>
        {showEvents && (
          <ol className="mt-5 space-y-0" data-testid="checkpoints">
            {checkpoints.map((c, i) => (
              <li key={c.key} className="relative flex gap-4 pb-5 last:pb-0">
                {i < checkpoints.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-border" />}
                <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full", i === 0 ? "bg-primary ring-4 ring-wine-100" : "bg-border")} />
                <div className="min-w-0">
                  <p className={cn("text-sm", i === 0 && "font-medium")}>{c.title}</p>
                  {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground tabular">{formatDateTime(c.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {order.status === "DELIVERED" && <ReviewSection view={view} />}
      {view.canRequestReturn && <ReturnSection view={view} />}

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="font-display text-2xl">Items</h2>
        <div className="mt-2"><OrderLines view={view} /></div>
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p>Delivering to {order.customer.name.split(" ")[0]}{view.city && <>, {view.city}</>}</p>
            <p className="text-xs text-muted-foreground">Mobile {view.maskedPhone}</p>
          </div>
        </div>
      </section>

      {messages.length > 0 && (
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl"><MessageCircle className="size-5 text-[#1faa53]" /> Messages sent to you</h2>
          <div className="mt-4 space-y-3">
            {messages.map((m) => <WhatsAppBubble key={m.id} message={m.message} at={m.createdAt} />)}
          </div>
        </section>
      )}

      <a
        href={whatsappLink(view.storePhone, `Hi ${view.storeName}, I need help with order #${order.number}.`)}
        target="_blank"
        rel="noreferrer"
        className="flex h-14 items-center justify-center gap-2 rounded-xl bg-[#1faa53] text-sm font-medium text-white shadow-sm hover:bg-[#1a9549]"
      >
        <MessageCircle className="size-5" /> Chat with {view.storeName} on WhatsApp
      </a>
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense>
      <TrackOrderPageView />
    </Suspense>
  );
}
