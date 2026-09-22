"use client";

import { Bell, Heart, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useLive } from "@/hooks/use-live";
import { formatRelative } from "@/lib/format";
import { getShopperWishlist } from "@/services/storefront";
import { listShopperNotifications } from "@/services/wishlist";
import { ProductGrid } from "@/components/store/product-card";
import { Container } from "@/components/store/sections";
import { useStore } from "@/components/store/store-context";

export default function WishlistPage() {
  const { shopperId } = useStore();
  const { data: products } = useLive(() => getShopperWishlist(shopperId), [shopperId]);
  const { data: notes } = useLive(() => listShopperNotifications(shopperId), [shopperId]);
  const [hidden, setHidden] = useState<string[]>([]);
  const backInStock = (notes ?? []).filter((n) => n.event === "BACK_IN_STOCK" && !hidden.includes(n.id)).slice(0, 3);
  const available = products?.filter((p) => p.available > 0).length ?? 0;

  return (
    <Container className="pt-8 sm:pt-12">
      <h1 className="font-display text-4xl sm:text-6xl">Wishlist</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {products?.length
          ? `${products.length} saved ${products.length === 1 ? "saree" : "sarees"}, ${available} available now. We will message you when a sold out piece is back.`
          : "Tap the heart on any saree to save it here."}
      </p>

      {backInStock.length > 0 && (
        <div className="mt-6 space-y-2">
          {backInStock.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-soft p-4 text-sm" data-testid="back-in-stock">
              <Bell className="mt-0.5 size-4 shrink-0 text-success" />
              <div className="flex-1">
                <p className="font-medium">Good news! The saree you saved is available again.</p>
                <p className="mt-0.5 text-muted-foreground">{n.message.replace(/https?:\/\/\S+/g, "").trim()}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.createdAt)}</p>
              </div>
              {n.ctaUrl && (
                <Button asChild size="sm" variant="outline" className="bg-card">
                  <Link href={new URL(n.ctaUrl, "http://x").pathname}>View saree</Link>
                </Button>
              )}
              <button type="button" aria-label="Dismiss" onClick={() => setHidden([...hidden, n.id])} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        {products && products.length === 0 ? (
          <EmptyState icon={Heart} title="Nothing saved yet" description="Save sarees you love and come back to them. If one sells out, we will tell you when it is available again." action={<Button asChild><Link href="/store/sarees">Discover sarees</Link></Button>} />
        ) : (
          <ProductGrid products={products} skeletons={4} />
        )}
      </div>
    </Container>
  );
}
