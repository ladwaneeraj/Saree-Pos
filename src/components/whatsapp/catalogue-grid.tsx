"use client";

import { PackageSearch, Send, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { useLive } from "@/hooks/use-live";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listStoreProducts } from "@/services/storefront";
import { sendProduct } from "@/services/whatsapp";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { SearchInput } from "@/components/shared/misc";
import { ShareProductDialog, type ShareProduct } from "@/components/shared/share-product-dialog";

/** The WhatsApp Business catalogue: published designs with live prices and stock. */
export function CatalogueGrid({ conversation, className }: { conversation: { id: string; name: string } | null; className?: string }) {
  const [q, setQ] = useState("");
  const [share, setShare] = useState<ShareProduct | null>(null);
  const { data } = useLive(() => listStoreProducts({ q, sort: "featured" }), [q]);
  const send = useAction(sendProduct, { success: conversation ? `Sent to ${conversation.name}` : "Sent" });

  return (
    <section className={cn("@container min-h-0 overflow-y-auto bg-[#f7f5f2]", className)} aria-label="WhatsApp catalogue">
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-[#f7f5f2]/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">WhatsApp catalogue</h2>
          <p className="text-xs text-muted-foreground">{data ? `${data.length} published sarees` : "Loading…"} · prices and stock are live, a price change in inventory shows here at once</p>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search catalogue" className="sm:w-72" />
      </div>
      <div className="p-4 sm:p-6">
        {!data ? (
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[4/6] rounded-xl" />)}</div>
        ) : data.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No sarees match" description="Try another name, fabric or colour." />
        ) : (
          <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-4 @6xl:grid-cols-5">
            {data.map((p) => {
              const shareable: ShareProduct = { name: p.design.name, slug: p.design.slug, price: p.price, description: p.design.description, available: p.available, imageId: p.imageId };
              return (
                <article key={p.design.id} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs" data-testid="wa-catalogue-card">
                  <MediaImage id={p.imageId} alt={p.design.name} thumb rounded="rounded-none" />
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="line-clamp-2 text-sm leading-snug font-medium">{p.design.name}</h3>
                    <div className="text-xs text-muted-foreground">{p.fabricName}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-semibold tabular" data-testid="wa-catalogue-price">{formatINR(p.price)}</span>
                      {p.discount > 0 && <span className="text-xs text-muted-foreground line-through tabular">{formatINR(p.mrp)}</span>}
                    </div>
                    <div className={cn("text-xs", p.available <= 2 ? "text-[oklch(0.5_0.12_65)]" : "text-success")}>{p.available === 1 ? "Only 1 piece left" : `${p.available} available`}</div>
                    <div className="mt-auto grid gap-1.5 pt-2">
                      <Button size="sm" className="bg-[#1faa53] text-[12px] font-semibold tracking-wide text-white hover:bg-[#1a9549]" onClick={() => setShare(shareable)}>
                        <Share2 /> SHARE ON WHATSAPP
                      </Button>
                      {conversation && (
                        <Button size="sm" variant="outline" onClick={() => send.run(conversation.id, p.design.id)} disabled={send.pending}>
                          <Send /> <span className="truncate">Send to {conversation.name.split(" ")[0]}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <ShareProductDialog product={share} open={!!share} onOpenChange={(o) => !o && setShare(null)} />
    </section>
  );
}
