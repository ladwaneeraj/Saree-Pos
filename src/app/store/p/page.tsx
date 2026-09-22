"use client";

import { Suspense } from "react";
import { useQueryParam } from "@/hooks/use-query-param";

import { BellRing, Check, ChevronRight, Clock, Share2, ShoppingBag, Sparkles, Truck, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { ShareProductDialog } from "@/components/shared/share-product-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLive } from "@/hooks/use-live";
import { useAction } from "@/hooks/use-action";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addToCart, getStoreProduct, type StoreProductDetail } from "@/services/storefront";
import { Price, availabilityLabel } from "@/components/store/price";
import { ProductGallery } from "@/components/store/product-gallery";
import { ProductGrid } from "@/components/store/product-card";
import { Container, ReviewCard, SectionHeading, Stars } from "@/components/store/sections";
import { useStore } from "@/components/store/store-context";
import { WishlistButton } from "@/components/store/wishlist-button";

function ProductPageView() {
  const slug = useQueryParam("slug");
  const { data: product } = useLive(() => getStoreProduct(slug), [slug]);

  if (product === undefined) return <ProductSkeleton />;
  if (product === null)
    return (
      <Container className="py-16">
        <EmptyState icon={Sparkles} title="This saree is no longer listed" description="It may have found its home. Explore similar pieces in our collection." action={<Button asChild><Link href="/store/sarees">Browse sarees</Link></Button>} />
      </Container>
    );
  return <ProductDetail product={product} />;
}

function ProductDetail({ product }: { product: StoreProductDetail }) {
  const router = useRouter();
  const { shopperId, cart, settings, wishlist, toggleSaved } = useStore();
  const [picked, setPicked] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const minutes = settings?.store.cartReservationMinutes ?? 15;
  const add = useAction(addToCart, { success: `Reserved for you for ${minutes} minutes` });

  const { design } = product;
  const colour = product.colours.find((c) => c.colour.id === picked) ?? product.colours[0] ?? null;
  const images = colour && colour.imageIds.length ? [...colour.imageIds, ...design.imageIds.filter((id) => !colour.imageIds.includes(id))] : design.imageIds;
  const inCart = cart?.lines.filter((l) => l.design.id === design.id) ?? [];
  const soldOut = product.available === 0;
  const reservedElsewhere = soldOut && inCart.length === 0 && product.reservedCount > 0;
  const saved = wishlist.has(design.id);
  const scarcity = availabilityLabel(colour?.available ?? product.available, product.scarcityThreshold);
  const avgRating = product.reviews.length ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length : 0;

  const onAdd = async (buyNow: boolean) => {
    if (soldOut && inCart.length > 0 && buyNow) return router.push("/store/checkout");
    const item = await add.run(shopperId, design.id, colour?.colour.id ?? null);
    if (item && buyNow) router.push("/store/checkout");
  };

  const notifyMe = async () => {
    if (!saved) await toggleSaved(design.id, design.name);
    else toast.success("We will let you know", { description: "This saree is already in your wishlist." });
  };

  const buyBox = soldOut ? (
    inCart.length > 0 ? (
      <div className="rounded-lg border border-success/30 bg-success-soft p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success"><Check className="size-4" /> This saree is reserved in your cart</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-12"><Link href="/store/cart">View cart</Link></Button>
          <Button asChild className="h-12"><Link href="/store/checkout">Checkout</Link></Button>
        </div>
      </div>
    ) : (
      <div className="rounded-lg border bg-muted/50 p-4" data-testid="unavailable">
        <p className="flex items-start gap-2 text-sm font-medium">
          {reservedElsewhere ? <Clock className="mt-0.5 size-4 shrink-0 text-warning" /> : <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          {reservedElsewhere ? "Currently reserved in another cart, check back in a few minutes" : "Sold out. This piece has found its home."}
        </p>
        <p className="mt-1 pl-6 text-xs text-muted-foreground">
          {reservedElsewhere ? "If the reservation expires, it will be available again." : "Save it and we will message you if a similar piece comes back."}
        </p>
        <Button className="mt-3 h-12 w-full" variant={saved ? "outline" : "default"} onClick={notifyMe}>
          <BellRing /> {saved ? "You will be notified" : "Notify me"}
        </Button>
      </div>
    )
  ) : (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <Button size="lg" variant="outline" className="h-12 border-foreground/80" disabled={add.pending} onClick={() => onAdd(false)} data-testid="add-to-cart">
        <ShoppingBag /> Add to cart
      </Button>
      <Button size="lg" className="h-12" disabled={add.pending} onClick={() => onAdd(true)} data-testid="buy-now">
        <Zap /> Buy now
      </Button>
      <WishlistButton designId={design.id} name={design.name} variant="outline" className="size-12" />
    </div>
  );

  return (
    <div className="pb-28 md:pb-0">
      <Container className="pt-0 sm:pt-6">
        <nav className="hidden items-center gap-1.5 py-2 text-xs text-muted-foreground sm:flex">
          <Link href="/store" className="hover:text-foreground">Home</Link>
          <ChevronRight className="size-3" />
          <Link href="/store/sarees" className="hover:text-foreground">Sarees</Link>
          <ChevronRight className="size-3" />
          <span className="truncate text-foreground">{design.name}</span>
        </nav>

        <div className="grid gap-6 sm:mt-4 md:grid-cols-[1.1fr_1fr] md:gap-10 lg:gap-16">
          <ProductGallery key={colour?.colour.id ?? "design"} imageIds={images} alt={design.name} />

          <div className="md:sticky md:top-32 md:self-start">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-gold-foreground uppercase">
              {product.fabricName} · {product.categoryName}
            </p>
            <h1 className="mt-2 font-display text-[34px] leading-[1.05] sm:text-5xl">{design.name}</h1>
            {product.reviews.length > 0 && (
              <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Stars rating={Math.round(avgRating)} /> {avgRating.toFixed(1)} · {product.reviews.length} review{product.reviews.length === 1 ? "" : "s"}
              </a>
            )}
            <div className="mt-4 flex items-center gap-3">
              <Price price={product.price} mrp={product.mrp} discount={product.discount} size="lg" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

            {product.colours.length > 0 && (
              <div className="mt-7">
                <p className="text-sm">
                  Colour: <span className="font-medium">{colour?.colour.name}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colours.map((c) => {
                    const on = c.colour.id === colour?.colour.id;
                    return (
                      <button
                        key={c.colour.id}
                        type="button"
                        onClick={() => setPicked(c.colour.id)}
                        aria-pressed={on}
                        className={cn("flex h-11 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm transition", on ? "border-primary bg-wine-50" : "hover:bg-accent")}
                      >
                        <span className="size-8 rounded-full ring-1 ring-black/10" style={{ background: c.colour.hex }} />
                        {c.colour.name}
                        <span className="text-xs text-muted-foreground tabular">({c.available})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {scarcity && !soldOut && (
              <p className="mt-5 flex items-center gap-2 text-sm font-medium text-primary">
                <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50" /><span className="relative inline-flex size-2 rounded-full bg-primary" /></span>
                {scarcity.text}
              </p>
            )}
            {inCart.length > 0 && !soldOut && (
              <p className="mt-3 flex items-center gap-2 text-sm text-success">
                <Check className="size-4" /> {inCart.length} in your cart. <Link href="/store/cart" className="underline underline-offset-4">View cart</Link>
              </p>
            )}

            <div className="mt-6">{buyBox}</div>

            <div className="mt-4 flex items-center justify-between gap-2 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <Truck className="size-4" />
                {product.price >= (settings?.shipping.freeAbove ?? 2999) ? "Free shipping" : `Free shipping above ${formatINR(settings?.shipping.freeAbove ?? 2999)}`} · Dispatch in 24 hours
              </p>
              <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)} className="shrink-0 text-xs font-semibold tracking-[0.12em] uppercase" data-testid="share-product">
                <Share2 /> Share product
              </Button>
            </div>

            <div className="mt-8 border-t pt-6">
              <p className="text-[15px] leading-relaxed text-foreground/85">{design.description}</p>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  ["Fabric", product.fabricName],
                  ["Pattern", design.pattern],
                  ["Border", design.border],
                  ["Length", `${design.lengthM} m`],
                  ["Blouse piece", design.blouseIncluded ? "Included" : "Not included"],
                  ["Design code", design.code],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v || "Not specified"}</dd>
                  </div>
                ))}
              </dl>
              {product.fabricCare && (
                <div className="mt-6 rounded-lg bg-muted/60 p-4 text-sm">
                  <p className="font-medium">Care</p>
                  <p className="mt-1 text-muted-foreground">{product.fabricCare}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>

      {product.similar.length > 0 && (
        <section className="mt-16 sm:mt-24">
          <Container>
            <SectionHeading eyebrow="Handpicked for you" title="You may also like" />
            <ProductGrid products={product.similar.slice(0, 4)} />
          </Container>
        </section>
      )}

      <section id="reviews" className="mt-16 scroll-mt-32 sm:mt-24">
        <Container>
          <SectionHeading eyebrow="Reviews" title={product.reviews.length ? "What customers say" : "No reviews yet"} />
          {product.reviews.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {product.reviews.slice(0, 6).map((r) => <ReviewCard key={r.id} review={r} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Be the first to share how you styled this saree after your order is delivered.</p>
          )}
        </Container>
      </section>

      {/* Sticky mobile purchase bar, above the bottom navigation */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{design.name}</p>
            <p className="font-semibold tabular">{formatINR(product.price)}</p>
          </div>
          {soldOut ? (
            inCart.length > 0 ? (
              <Button asChild className="h-11 px-6"><Link href="/store/checkout">Checkout</Link></Button>
            ) : (
              <Button variant="outline" className="h-11" onClick={notifyMe}><BellRing /> {saved ? "Saved" : "Notify me"}</Button>
            )
          ) : (
            <Button className="h-11 px-6" disabled={add.pending} onClick={() => onAdd(false)}>
              <ShoppingBag /> Add to cart
            </Button>
          )}
        </div>
      </div>

      <ShareProductDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        product={{ name: design.name, slug: design.slug, price: product.price, description: design.description, available: product.available, imageId: product.imageId }}
      />
    </div>
  );
}

function ProductSkeleton() {
  return (
    <Container className="grid gap-8 pt-6 md:grid-cols-[1.1fr_1fr] lg:gap-16">
      <Skeleton className="aspect-[4/5] w-full rounded-md" />
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-4/5" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </Container>
  );
}

export default function ProductPage() {
  return (
    <Suspense>
      <ProductPageView />
    </Suspense>
  );
}
