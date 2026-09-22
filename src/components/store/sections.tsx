"use client";

import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MediaImage } from "@/components/shared/media-image";
import { Skeleton } from "@/components/ui/skeleton";
import type { Review } from "@/domain/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StoreHome, StoreProduct } from "@/services/storefront";
import { ProductCard, ProductCardSkeleton } from "./product-card";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[11px] font-semibold tracking-[0.2em] text-gold-foreground uppercase", className)}>{children}</p>;
}

export function SectionHeading({ eyebrow, title, href, linkLabel = "View all", className }: { eyebrow?: string; title: string; href?: string; linkLabel?: string; className?: string }) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4 sm:mb-8", className)}>
      <div>
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 className="font-display text-3xl leading-none sm:text-[40px]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
          {linkLabel} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/** Horizontal swipe row on mobile, four-up grid on desktop. */
export function ProductRail({ products, eyebrow, title, href }: { products: StoreProduct[] | undefined; eyebrow?: string; title: string; href?: string }) {
  if (products && products.length === 0) return null;
  return (
    <section className="py-10 sm:py-14">
      <Container>
        <SectionHeading eyebrow={eyebrow} title={title} href={href} />
      </Container>
      <div className="snap-gallery scrollbar-none flex gap-3 overflow-x-auto scroll-px-4 px-4 sm:gap-5 sm:px-6 lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-4 lg:overflow-visible lg:px-8">
        {(products ?? Array.from({ length: 4 }, () => null)).slice(0, 4).map((p, i) => (
          <div key={p?.design.id ?? i} className="w-[46%] shrink-0 sm:w-[31%] lg:w-auto">
            {p ? <ProductCard product={p} /> : <ProductCardSkeleton />}
          </div>
        ))}
      </div>
    </section>
  );
}

export function CollectionTiles({ collections, limit }: { collections: StoreHome["collections"] | undefined; limit?: number }) {
  const rows = collections?.filter((c) => c.count > 0).slice(0, limit);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {!rows
        ? Array.from({ length: limit ?? 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-md" />)
        : rows.map((c) => (
            <Link key={c.slug} href={`/store/collections/${c.slug}`} className="group relative block overflow-hidden rounded-md">
              <MediaImage id={c.imageId} alt={c.name} rounded="rounded-md" className="transition duration-700 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-6">
                <h3 className="font-display text-2xl leading-none sm:text-4xl">{c.name}</h3>
                <p className="mt-2 hidden max-w-xs text-sm text-white/80 sm:block">{c.description}</p>
                <p className="mt-2 text-[11px] font-medium tracking-[0.14em] text-white/80 uppercase">{c.count} sarees</p>
              </div>
            </Link>
          ))}
    </div>
  );
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn("flex gap-0.5", className)} aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= rating ? "fill-gold text-gold" : "text-border")} />
      ))}
    </div>
  );
}

export function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="flex h-full flex-col rounded-lg border bg-card p-5 sm:p-6">
      <Stars rating={review.rating} />
      <blockquote className="mt-4 flex-1 font-display text-xl leading-snug">&ldquo;{review.body}&rdquo;</blockquote>
      <figcaption className="mt-5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{review.customerName}</span>
        {review.city && `, ${review.city}`} · {formatShortDate(review.createdAt)}
      </figcaption>
    </figure>
  );
}
