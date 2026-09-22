"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLive } from "@/hooks/use-live";
import { getStoreHome } from "@/services/storefront";
import { CollectionTiles, Container, Eyebrow, ProductRail, ReviewCard, SectionHeading } from "@/components/store/sections";
import { whatsappLink } from "@/components/store/constants";
import { StockImage } from "@/components/store/stock-image";
import { useStore } from "@/components/store/store-context";
import { TrustStrip } from "@/components/store/store-shell";

export default function StoreHomePage() {
  const { data: home } = useLive(getStoreHome, []);
  const { settings } = useStore();
  const name = settings?.business.name ?? "Dhanvi Silks";

  return (
    <>
      <section className="relative">
        <StockImage photo="bridalSilkGroup" alt="Brides in Kanchipuram silk sarees" className="h-[78svh] min-h-[520px] w-full sm:h-[82vh]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10 sm:bg-gradient-to-r sm:from-black/70 sm:via-black/30 sm:to-transparent" />
        <Container className="absolute inset-0 flex flex-col justify-end pb-12 text-white sm:justify-center sm:pb-0">
          <div className="max-w-xl">
            <Eyebrow className="text-gold">The Wedding Edit · 2026</Eyebrow>
            <h1 className="mt-4 font-display text-[44px] leading-[0.95] sm:text-7xl">
              Silks woven for <em className="text-gold">the day</em> you will remember
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/80">
              Kanjivarams, Banarasis and heirloom silks from master weavers. Every saree at {name} is a single, one of a kind piece.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-white px-7 text-foreground hover:bg-white/90">
                <Link href="/store/collections/wedding">
                  Shop wedding silks <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-white/50 bg-transparent px-7 text-white hover:bg-white/10 hover:text-white">
                <Link href="/store/sarees">Explore all sarees</Link>
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <div className="border-b bg-card">
        <Container className="py-6 sm:py-8">
          <TrustStrip />
        </Container>
      </div>

      <ProductRail eyebrow="Just in" title="New Arrivals" products={home?.newArrivals} href="/store/sarees?sort=newest" />

      <section className="py-10 sm:py-14">
        <Container>
          <SectionHeading eyebrow="Curated" title="Shop by collection" href="/store/collections" />
          <CollectionTiles collections={home?.collections} limit={6} />
        </Container>
      </section>

      <ProductRail eyebrow="For the bride" title="Wedding Collection" products={home?.wedding} href="/store/collections/wedding" />

      <section className="my-10 bg-primary text-primary-foreground sm:my-14">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <StockImage photo="loomWeaver" alt="A weaver at a handloom" width={1200} className="aspect-[4/3] w-full lg:aspect-auto lg:min-h-[520px]" />
          <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
            <Eyebrow className="text-gold">Our story</Eyebrow>
            <h2 className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl">Woven by hand, one saree at a time</h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-primary-foreground/80">
              We work directly with weaving families in Kanchipuram, Varanasi and Chanderi. A single bridal silk can take three weeks on the loom. That is why we never repeat a piece, and why the one you choose is truly yours.
            </p>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-white/15 pt-6">
              {[
                ["40+", "weaver families"],
                ["100%", "pure zari silks"],
                ["1 of 1", "every piece"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display text-3xl text-gold">{v}</p>
                  <p className="mt-1 text-xs text-primary-foreground/70">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ProductRail eyebrow="Pure silk" title="Silk Sarees" products={home?.silk} href="/store/sarees?q=silk" />
      <ProductRail eyebrow="Loved by many" title="Best Sellers" products={home?.bestSellers} href="/store/sarees?sort=bestselling" />
      <ProductRail eyebrow="Fresh on the website" title="Recently Added" products={home?.recentlyAdded} href="/store/sarees?sort=newest" />

      {home && home.reviews.length > 0 && (
        <section className="bg-[oklch(0.97_0.006_70)] py-14 sm:py-20">
          <Container>
            <SectionHeading eyebrow="Kind words" title="From our customers" />
            <div className="snap-gallery scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {home.reviews.map((r) => (
                <div key={r.id} className="w-[82%] shrink-0 sm:w-auto">
                  <ReviewCard review={r} />
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      <section className="relative overflow-hidden">
        <StockImage photo="goldenThreads" alt="Golden zari threads" width={1600} className="h-72 w-full sm:h-80" />
        <div className="absolute inset-0 bg-black/45" />
        <Container className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
          <h2 className="font-display text-4xl sm:text-5xl">Need help choosing?</h2>
          <p className="mt-3 max-w-md text-sm text-white/80">Send us a message on WhatsApp. We will share live photos and videos of any saree before you buy.</p>
          <Button asChild size="lg" className="mt-6 h-12 rounded-full bg-[#1faa53] px-7 text-white hover:bg-[#1a9549]">
            <a href={whatsappLink(settings?.business.whatsapp ?? "", `Hi ${name}, I need help choosing a saree.`)} target="_blank" rel="noreferrer">
              Chat on WhatsApp
            </a>
          </Button>
        </Container>
      </section>
    </>
  );
}
