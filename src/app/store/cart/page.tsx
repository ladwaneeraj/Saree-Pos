"use client";

import { AlertCircle, ArrowRight, Lock, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot } from "@/components/shared/misc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { useNow } from "@/hooks/use-now";
import { formatINR } from "@/lib/format";
import { sweepExpiredReservations } from "@/services/maintenance";
import { removeFromCart } from "@/services/storefront";
import { ReservationTimer, SummaryRows } from "@/components/store/cart-bits";
import { Container } from "@/components/store/sections";
import { useStore } from "@/components/store/store-context";

interface SeenLine {
  itemId: string;
  name: string;
  expiresAt: number | null;
}

export default function CartPage() {
  const { cart, shopperId, settings } = useStore();
  const now = useNow(1000);
  const remove = useAction(removeFromCart, { success: "Removed from cart" });
  const [seen, setSeen] = useState<SeenLine[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const lines = cart?.lines.filter((l) => !l.expiresAt || l.expiresAt > now);
  // Remember every line shown so we can explain lines that disappear when their hold expires.
  const unseen = cart?.lines.filter((l) => !seen.some((s) => s.itemId === l.item.id)) ?? [];
  if (unseen.length) setSeen([...seen, ...unseen.map((l) => ({ itemId: l.item.id, name: l.design.name, expiresAt: l.expiresAt }))]);

  const expired = seen.filter(
    (s) => !removed.includes(s.itemId) && !dismissed.includes(s.itemId) && s.expiresAt !== null && s.expiresAt <= now && !lines?.some((l) => l.item.id === s.itemId),
  );
  const hasStale = (cart?.lines.length ?? 0) !== (lines?.length ?? 0);

  useEffect(() => {
    if (hasStale) void sweepExpiredReservations().catch(() => undefined);
  }, [hasStale]);

  const subtotal = lines?.reduce((s, l) => s + l.price, 0) ?? 0;
  const freeAbove = settings?.shipping.freeAbove ?? 2999;
  const shippingFee = subtotal === 0 || subtotal >= freeAbove ? 0 : settings?.shipping.flatFee ?? 0;

  return (
    <Container className="pt-8 sm:pt-12">
      <h1 className="font-display text-4xl sm:text-6xl">Your cart</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Each saree is a single piece, so we hold it for you for {settings?.store.cartReservationMinutes ?? 15} minutes while you check out.
      </p>

      {expired.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm" role="status" data-testid="expired-notice">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex-1">
            <p className="font-medium">Your reservation expired</p>
            <p className="text-muted-foreground">
              {expired.map((e) => e.name).join(", ")} {expired.length === 1 ? "was" : "were"} released so other shoppers can buy {expired.length === 1 ? "it" : "them"}. Add again if still available.
            </p>
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setDismissed([...dismissed, ...expired.map((e) => e.itemId)])} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}

      {!lines ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : lines.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Find a saree you love. We will hold it for you while you check out."
          action={<Button asChild><Link href="/store/sarees">Shop sarees</Link></Button>}
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-12">
          <ul className="divide-y border-y">
            {lines.map((l) => (
              <li key={l.item.id} className="flex gap-4 py-5" data-testid="cart-line">
                <Link href={`/store/p?slug=${l.design.slug}`} className="w-24 shrink-0 sm:w-32">
                  <MediaImage id={l.imageId} alt={l.design.name} thumb rounded="rounded-md" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{l.fabricName}</p>
                      <Link href={`/store/p?slug=${l.design.slug}`} className="mt-0.5 block font-medium leading-snug hover:underline">{l.design.name}</Link>
                      {l.colour && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <ColourDot hex={l.colour.hex} /> {l.colour.name}
                        </p>
                      )}
                    </div>
                    <div className="text-right tabular">
                      <p className="font-semibold">{formatINR(l.price)}</p>
                      {l.mrp > l.price && <p className="text-xs text-muted-foreground line-through">{formatINR(l.mrp)}</p>}
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                    <ReservationTimer expiresAt={l.expiresAt} now={now} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      disabled={remove.pending}
                      onClick={async () => {
                        setRemoved([...removed, l.item.id]);
                        await remove.run(shopperId, l.item.id);
                      }}
                    >
                      <Trash2 /> Remove
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-xl border bg-card p-5 sm:p-6 lg:sticky lg:top-32">
            <h2 className="font-display text-2xl">Order summary</h2>
            <div className="mt-5">
              <SummaryRows subtotal={subtotal} shippingFee={shippingFee} total={subtotal + shippingFee} count={lines.length} freeAbove={freeAbove} />
            </div>
            <Button asChild size="lg" className="mt-6 h-12 w-full" data-testid="checkout">
              <Link href="/store/checkout">
                Checkout <ArrowRight />
              </Link>
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" /> Secure payment · UPI, cards, net banking
            </p>
          </aside>
        </div>
      )}
    </Container>
  );
}
