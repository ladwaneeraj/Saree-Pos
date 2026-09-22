"use client";

import { ExternalLink, History, Info, Pencil, Plus, SearchX, Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { discountPercent } from "@/domain/rules/pricing";
import { useAction } from "@/hooks/use-action";
import { useLive } from "@/hooks/use-live";
import { formatDate, formatINR, formatRelative } from "@/lib/format";
import { listAuditForEntity } from "@/services/audit";
import { setDesignImages, updateDesign } from "@/services/catalog";
import { getDesignOverview, type DesignOverview } from "@/services/inventory";
import { useCan } from "@/stores/session";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageManager } from "@/components/shared/image-manager";
import { PageHeader } from "@/components/shared/page-header";
import { ShareProductDialog } from "@/components/shared/share-product-dialog";
import { Pill } from "@/components/shared/status-badge";
import { Panel } from "@/components/inventory/panel";
import { ChannelPreviews } from "@/components/designs/channel-previews";
import { DesignAttributesForm } from "@/components/designs/design-attributes-form";
import { DesignPieces } from "@/components/designs/design-pieces";
import { PriceChangeDialog } from "@/components/designs/price-change-dialog";

export default function DesignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useLive(() => getDesignOverview(id), [id]);
  if (data === undefined) return <DesignSkeleton />;
  if (data === null) {
    return (
      <EmptyState
        icon={SearchX}
        title="Design not found"
        description="It may have been removed. Search from Products / Designs."
        action={
          <Button asChild variant="outline">
            <Link href="/designs">Back to designs</Link>
          </Button>
        }
      />
    );
  }
  return <DesignDetail overview={data} />;
}

function DesignDetail({ overview }: { overview: DesignOverview }) {
  const { design, stock, pieces } = overview;
  const canEdit = useCan("designs:edit");
  const canPrice = useCan("pricing:edit");
  const canAddStock = useCan("inventory:edit");
  const [priceOpen, setPriceOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const photos = useAction(setDesignImages, { success: "Photos updated on every channel" });
  const publish = useAction(updateDesign);
  const { data: audit } = useLive(() => listAuditForEntity(design.id), [design.id]);
  const off = discountPercent(design.mrp, design.price);
  const overrides = pieces.filter((p) => p.priceSource === "OVERRIDE" && (p.item.status === "AVAILABLE" || p.item.status === "RESERVED")).length;

  return (
    <>
      <PageHeader
        back={{ href: "/designs", label: "Products / Designs" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {design.name}
            {design.isPublished ? <Pill tone="success">Live on website</Pill> : <Pill>Hidden from website</Pill>}
          </span>
        }
        description={
          <>
            {design.code} · {overview.fabric?.name} · {overview.category?.name}
            {overview.collectionNames.length > 0 && <> · {overview.collectionNames.join(", ")}</>}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setShareOpen(true)}>
              <Share2 /> Share product
            </Button>
            <Button variant="outline" asChild>
              <a href={`/store/p/${design.slug}`} target="_blank" rel="noreferrer">
                View on website <ExternalLink />
              </a>
            </Button>
            {canAddStock && (
              <Button asChild>
                <Link href={`/inventory/new?design=${design.id}`}>
                  <Plus /> Add pieces
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-5 xl:col-span-4">
          <Panel title="Photos">
            <ImageManager imageIds={design.imageIds} disabled={!canEdit} onChange={(ids) => void photos.run(design.id, ids)} emptyHint="No design photos yet. Piece photos are used until you add some." />
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-wine-50 p-2.5 text-xs text-primary">
              <Info className="mt-px size-3.5 shrink-0" />
              These photos appear in Inventory, POS, Website and WhatsApp.
            </p>
          </Panel>

          <Panel title="Stock">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Available", value: stock.available, tone: "text-success" },
                { label: "Reserved", value: stock.reserved, tone: "text-[oklch(0.5_0.12_65)]" },
                { label: "Sold", value: stock.sold, tone: "text-foreground" },
                { label: "Damaged", value: stock.damaged + stock.returned, tone: "text-destructive" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-muted/50 px-1 py-2.5">
                  <div className={`text-xl font-semibold tabular ${s.tone}`}>{s.value}</div>
                  <div className="text-[11px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm">
              <div>
                <div className="font-medium">Show on website</div>
                <div className="text-xs text-muted-foreground">POS and WhatsApp can always sell it</div>
              </div>
              <Switch checked={design.isPublished} disabled={!canEdit} onCheckedChange={(on) => void publish.run(design.id, { isPublished: on })} aria-label="Published on website" />
            </div>
          </Panel>
        </div>

        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <Panel
            title="Price on every channel"
            action={
              canPrice && (
                <Button size="sm" onClick={() => setPriceOpen(true)}>
                  <Pencil /> Change price
                </Button>
              )
            }
          >
            <div className="mb-5 flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="text-xs font-medium text-muted-foreground">Current selling price</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatINR(design.price)}</div>
              </div>
              <div className="pb-1 text-sm">
                <span className="text-muted-foreground">MRP </span>
                <span className="tabular">{formatINR(design.mrp)}</span>
                {off > 0 && <span className="ml-2 font-medium text-success">{off}% off</span>}
              </div>
              {overrides > 0 && (
                <div className="pb-1 text-xs text-gold-foreground">
                  {overrides} piece{overrides === 1 ? " has" : "s have"} an individual price
                </div>
              )}
            </div>
            <ChannelPreviews design={design} imageId={overview.imageId} available={stock.available} fabricName={overview.fabric?.name ?? ""} />
            <p className="mt-4 text-xs text-muted-foreground">
              One price, read live by every channel. Changing it here updates POS, the website and WhatsApp together. SKUs and barcodes never change.
            </p>
          </Panel>

          <Panel title={`Pieces (${pieces.length})`} bodyClassName="p-0 sm:p-0">
            {pieces.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No pieces of this design yet.
                {canAddStock && (
                  <Button asChild variant="link" className="px-1">
                    <Link href={`/inventory/new?design=${design.id}`}>Add the first one</Link>
                  </Button>
                )}
              </div>
            ) : (
              <DesignPieces pieces={pieces} />
            )}
          </Panel>

          <Panel title="Design details">
            <DesignAttributesForm key={design.updatedAt} design={design} canEdit={canEdit} />
          </Panel>

          <Panel title="Recent changes" action={<History className="size-4 text-muted-foreground" />} bodyClassName="p-0 sm:p-0">
            {!audit ? (
              <div className="space-y-2 p-5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : audit.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No changes recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {audit.slice(0, 10).map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-3 sm:px-5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{a.summary}</p>
                      {a.before && a.after && a.action === "PRICE_CHANGED" && (
                        <p className="text-xs text-muted-foreground">
                          {a.before} → {a.after}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.actorName} · <span title={formatDate(a.createdAt)}>{formatRelative(a.createdAt)}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <PriceChangeDialog design={design} open={priceOpen} onOpenChange={setPriceOpen} />
      <ShareProductDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        product={{ name: design.name, slug: design.slug, price: design.price, description: design.description, available: stock.available, imageId: overview.imageId }}
      />
    </>
  );
}

function DesignSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <Skeleton className="h-96 rounded-xl lg:col-span-4" />
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
