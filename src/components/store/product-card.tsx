"use client";

import Link from "next/link";
import { MediaImage } from "@/components/shared/media-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { StoreProduct } from "@/services/storefront";
import { Price, availabilityLabel } from "./price";
import { useStore } from "./store-context";
import { WishlistButton } from "./wishlist-button";

export function ProductCard({ product, priority }: { product: StoreProduct; priority?: boolean }) {
  const { settings } = useStore();
  const availability = availabilityLabel(product.available, settings?.store.scarcityThreshold ?? 2);
  const soldOut = product.available === 0;
  return (
    <Link href={`/store/p?slug=${product.design.slug}`} className="group block min-w-0" data-testid="product-card">
      <div className="relative overflow-hidden rounded-md">
        <MediaImage id={product.imageId} alt={product.design.name} rounded="rounded-md" priority={priority} className={cn("transition duration-500 group-hover:scale-[1.02]", soldOut && "opacity-60")} />
        {product.hoverImageId && (
          <div className="pointer-events-none absolute inset-0 hidden opacity-0 transition-opacity duration-500 group-hover:opacity-100 md:block">
            <MediaImage id={product.hoverImageId} alt="" rounded="rounded-md" className="size-full" />
          </div>
        )}
        <WishlistButton designId={product.design.id} name={product.design.name} className="absolute top-2 right-2" />
        {availability && (
          <span
            className={cn(
              "absolute bottom-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-sm",
              availability.tone === "sold" ? "bg-foreground/85 text-background" : "bg-white/95 text-primary",
            )}
          >
            {availability.text}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 px-0.5">
        <p className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">{product.fabricName}</p>
        <h3 className="line-clamp-2 text-sm leading-snug text-foreground group-hover:underline group-hover:underline-offset-4">{product.design.name}</h3>
        <Price price={product.price} mrp={product.mrp} discount={product.discount} />
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[4/5] w-full rounded-md" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function ProductGrid({ products, loading, skeletons = 8, className }: { products: StoreProduct[] | undefined; loading?: boolean; skeletons?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4", className)}>
      {!products || loading
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products.map((p, i) => <ProductCard key={p.design.id} product={p} priority={i < 4} />)}
    </div>
  );
}
