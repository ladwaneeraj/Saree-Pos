"use client";

import { Suspense } from "react";
import { useQueryParam } from "@/hooks/use-query-param";

import { ArrowRight, Check, MapPin, MessageCircle, PackageSearch } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLive } from "@/hooks/use-live";
import { formatDateTime } from "@/lib/format";
import { getTrackingView } from "@/services/storefront";
import { OrderLines, WhatsAppBubble } from "@/components/store/order-bits";
import { Container, Eyebrow } from "@/components/store/sections";

function OrderSuccessPageView() {
  const id = useQueryParam("id");
  const { data: view } = useLive(() => getTrackingView(id), [id]);

  if (view === undefined)
    return (
      <Container className="max-w-2xl space-y-4 py-12">
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  if (view === null)
    return (
      <Container className="py-12">
        <EmptyState icon={PackageSearch} title="Order not found" description="Check the link or look up your order with its number and phone." action={<Button asChild><Link href="/store/track">Track an order</Link></Button>} />
      </Container>
    );

  const { order } = view;
  const confirmation = view.messages.find((m) => m.event === "ORDER_CONFIRMED");
  const a = order.shippingAddress;

  return (
    <Container className="max-w-3xl pt-10 sm:pt-16">
      <div className="text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <Check className="size-8" strokeWidth={2.5} />
        </div>
        <Eyebrow className="mt-6 text-success">Payment successful</Eyebrow>
        <h1 className="mt-2 font-display text-5xl tracking-wide sm:text-7xl" data-testid="order-confirmed">ORDER CONFIRMED</h1>
        <p className="mt-3 text-lg">
          Order <span className="font-semibold tabular" data-testid="order-number">#{order.number}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Thank you, {order.customer.name.split(" ")[0]}. Placed on {formatDateTime(order.createdAt)}. Your saree is reserved and our team is preparing it for dispatch.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-7">
            <Link href={`/track?id=${order.id}`}>
              Track order <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-7">
            <Link href="/store/sarees">Continue shopping</Link>
          </Button>
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <section className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="font-display text-2xl">Your order</h2>
          <div className="mt-2">
            <OrderLines view={view} />
          </div>
        </section>
        <div className="space-y-6">
          {a && (
            <section className="rounded-xl border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-display text-2xl"><MapPin className="size-5 text-muted-foreground" /> Delivering to</h2>
              <address className="mt-3 text-sm leading-relaxed not-italic">
                <span className="font-medium">{a.name}</span>
                <br />
                {a.line1}
                {a.line2 && <>, {a.line2}</>}
                <br />
                {a.city}, {a.state} {a.pincode}
                <br />
                <span className="text-muted-foreground">{view.maskedPhone}</span>
              </address>
            </section>
          )}
          {confirmation && (
            <section className="rounded-xl border bg-card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="size-4 text-[#1faa53]" /> WhatsApp confirmation sent to {view.maskedPhone}
              </h2>
              <div className="mt-3">
                <WhatsAppBubble message={confirmation.message} at={confirmation.createdAt} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Simulated message for this demo.</p>
            </section>
          )}
        </div>
      </div>
    </Container>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense>
      <OrderSuccessPageView />
    </Suspense>
  );
}
