"use client";

import { Suspense } from "react";
import { useQueryParam } from "@/hooks/use-query-param";

import { AlertTriangle, Copy, ExternalLink, ImagePlus, Info, MoreHorizontal, Pencil, Printer, SearchX, Share2, Warehouse, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { usePrintLabels } from "@/hooks/use-labels";
import { useLive } from "@/hooks/use-live";
import { discountPercent } from "@/domain/rules/pricing";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { getInventoryDetail, listLocations, setPieceImages, type InventoryDetail } from "@/services/inventory";
import { useCan } from "@/stores/session";
import { Barcode } from "@/components/shared/barcode";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageManager } from "@/components/shared/image-manager";
import { ColourDot, CopyButton, KeyValue } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { ShareProductDialog } from "@/components/shared/share-product-dialog";
import { ChannelBadge, InventoryStatusBadge, OrderStatusBadge, Pill } from "@/components/shared/status-badge";
import { Gallery } from "@/components/inventory/gallery";
import { MovementTimeline } from "@/components/inventory/movement-timeline";
import { Panel } from "@/components/inventory/panel";
import { DamageDialog, PriceOverrideDialog, RackDialog } from "@/components/inventory/piece-dialogs";

type Open = null | "price" | "rack" | "damage" | "photos" | "share";

function InventoryDetailPageView() {
  const sku = useQueryParam("sku");
  const key = decodeURIComponent(sku ?? "");
  const { data, loading } = useLive(() => getInventoryDetail(key), [key]);

  if (data === undefined || (loading && !data)) return <DetailSkeleton />;
  if (data === null) {
    return (
      <EmptyState
        icon={SearchX}
        title={`No piece found for ${key}`}
        description="Check the SKU on the label or search inventory."
        action={
          <Button asChild variant="outline">
            <Link href="/inventory">Back to inventory</Link>
          </Button>
        }
      />
    );
  }
  return <Detail detail={data} />;
}

function Detail({ detail }: { detail: InventoryDetail }) {
  const router = useRouter();
  const printLabels = usePrintLabels();
  const canEdit = useCan("inventory:edit");
  const canPrice = useCan("pricing:edit");
  const canSeeCost = useCan("cost:view");
  const [open, setOpen] = useState<Open>(null);
  const { data: locations } = useLive(listLocations, []);
  const photos = useAction(setPieceImages);

  const { item, design } = detail;
  const openStock = item.status === "AVAILABLE" || (item.status === "RESERVED" && item.reservation?.kind !== "ORDER");
  const discount = discountPercent(detail.mrp, detail.price);
  const lastSale = item.status === "SOLD" ? [...detail.sales].sort((a, b) => b.orderItem.createdAt - a.orderItem.createdAt)[0] : undefined;
  const margin = detail.price - item.cost;
  const close = (o: boolean) => !o && setOpen(null);

  return (
    <>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{item.sku}</span>
            <InventoryStatusBadge status={item.status} />
            {detail.priceSource === "OVERRIDE" && <Pill tone="gold">Individual price</Pill>}
          </span>
        }
        description={
          <>
            <Link href={`/designs/view?id=${design.id}`} className="font-medium text-foreground hover:underline">
              {design.name}
            </Link>{" "}
            · {detail.colour?.name} · {detail.fabric?.name} · received {formatDate(item.receivedAt)} ({detail.ageDays} days in stock)
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => printLabels({ skus: [item.sku] })}>
              <Printer /> Print barcode
            </Button>
            <Button variant="outline" onClick={() => setOpen("share")}>
              <Share2 /> Share
            </Button>
            {canEdit && (
              <Button onClick={() => router.push(`/inventory/new?from=${item.id}`)}>
                <Copy /> Duplicate & change
              </Button>
            )}
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setOpen("rack")}>
                    <Warehouse /> Move rack
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setOpen("photos")}>
                    <ImagePlus /> Manage photos
                  </DropdownMenuItem>
                  {item.status === "AVAILABLE" && (
                    <DropdownMenuItem variant="destructive" onSelect={() => setOpen("damage")}>
                      <AlertTriangle /> Mark damaged
                    </DropdownMenuItem>
                  )}
                  {item.status === "DAMAGED" && canPrice && (
                    <DropdownMenuItem onSelect={() => setOpen("damage")}>
                      <Wrench /> Restore to stock
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {item.status === "DAMAGED" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-danger-soft p-3.5 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="font-medium">This saree is marked damaged and hidden from every sales channel.</p>
            <p className="text-muted-foreground">{item.notes || "Restore it once it has been repaired or cleaned."}</p>
          </div>
          {canPrice && (
            <Button size="sm" variant="outline" className="bg-card" onClick={() => setOpen("damage")}>
              Restore
            </Button>
          )}
        </div>
      )}
      {item.status === "RESERVED" && item.reservation && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-sm">
          <Info className="size-4 shrink-0 text-[oklch(0.5_0.12_65)]" />
          <span>
            Reserved {item.reservation.kind === "CART" ? "in a website cart" : item.reservation.kind === "HOLD" ? "on hold" : "for an order"} via <ChannelBadge channel={item.reservation.channel} className="align-middle" />
            {item.reservation.expiresAt && <> · releases {formatDate(item.reservation.expiresAt)}</>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-3 lg:col-span-5 xl:col-span-4">
          <Gallery imageIds={detail.imageIds} alt={`${design.name} ${detail.colour?.name ?? ""}`} />
          {detail.usesDesignImages && (
            <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" />
              Showing design photos. Add photos of this exact saree so customers see its true colour.
            </p>
          )}
          {canEdit && (
            <Button variant="outline" className="w-full" onClick={() => setOpen("photos")}>
              <ImagePlus /> {detail.usesDesignImages ? "Add piece photos" : "Manage piece photos"}
            </Button>
          )}
        </div>

        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Pricing">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">{lastSale ? "Sold for" : "Current selling price"}</div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{formatINR(lastSale ? lastSale.orderItem.lineTotal : detail.price)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {lastSale ? (
                      <>Order #{lastSale.order?.number} keeps this price · design price now {formatINR(design.price)}</>
                    ) : detail.priceSource === "OVERRIDE" ? (
                      <>Individual price for this piece · design price {formatINR(design.price)}</>
                    ) : (
                      <>Follows the design price</>
                    )}
                  </div>
                </div>
                {canPrice && openStock && (
                  <Button variant="outline" size="sm" onClick={() => setOpen("price")}>
                    <Pencil /> Edit price
                  </Button>
                )}
              </div>
              <div className="mt-4 divide-y border-t">
                <KeyValue label="MRP">
                  <span className="tabular">{formatINR(detail.mrp)}</span>
                  {discount > 0 && <span className="ml-2 text-xs font-medium text-success">{discount}% off</span>}
                </KeyValue>
                {canSeeCost && (
                  <KeyValue label="Purchase price">
                    <span className="tabular">{formatINR(item.cost)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">margin {formatINR(margin)}</span>
                  </KeyValue>
                )}
                <KeyValue label="Price source">{detail.priceSource === "OVERRIDE" ? "Individual override" : "Design default"}</KeyValue>
              </div>
            </Panel>

            <Panel title="Barcode label" action={<span className="text-xs text-muted-foreground">SKU only, never the price</span>}>
              <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed bg-white px-3 py-4">
                <span className="max-w-full truncate text-xs font-medium text-neutral-700">{design.name}</span>
                <Barcode value={item.sku} height={48} moduleWidth={1.5} className="max-w-full" />
                <span className="font-mono text-sm font-semibold tracking-wider text-neutral-900">{item.sku}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => printLabels({ skus: [item.sku] })}>
                  <Printer /> Print barcode
                </Button>
                <CopyButton text={item.sku} label="Copy SKU" className="flex-1" />
              </div>
            </Panel>
          </div>

          <Panel title="Details">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div className="divide-y">
                <KeyValue label="SKU"><span className="font-mono">{item.sku}</span></KeyValue>
                <KeyValue label="Design">
                  <Link href={`/designs/view?id=${design.id}`} className="text-primary hover:underline">
                    {design.name}
                  </Link>
                  <div className="text-xs font-normal text-muted-foreground">{design.code}</div>
                </KeyValue>
                <KeyValue label="Colour">
                  <span className="inline-flex items-center gap-2">
                    <ColourDot hex={detail.colour?.hex ?? "#999"} />
                    {detail.colour?.name}
                  </span>
                </KeyValue>
                <KeyValue label="Fabric">{detail.fabric?.name}</KeyValue>
                <KeyValue label="Category">{detail.category?.name ?? "None"}</KeyValue>
                <KeyValue label="Collection">{detail.collectionNames.join(", ") || "None"}</KeyValue>
              </div>
              <div className="divide-y max-sm:border-t">
                <KeyValue label="Pattern">{design.pattern || "Not set"}</KeyValue>
                <KeyValue label="Border">{design.border || "Not set"}</KeyValue>
                <KeyValue label="Saree length">{design.lengthM} m</KeyValue>
                <KeyValue label="Blouse piece">{design.blouseIncluded ? "Included" : "Not included"}</KeyValue>
                <KeyValue label="Status"><InventoryStatusBadge status={item.status} /></KeyValue>
                <KeyValue label="Rack">
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono">{item.location}</span>
                    {canEdit && (
                      <Button size="xs" variant="ghost" onClick={() => setOpen("rack")}>
                        <Pencil /> Change
                      </Button>
                    )}
                  </span>
                </KeyValue>
              </div>
            </div>
          </Panel>

          <Tabs defaultValue="movements">
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              <TabsTrigger value="movements">
                Movement timeline <span className="text-xs text-muted-foreground tabular">{detail.movements.length}</span>
              </TabsTrigger>
              <TabsTrigger value="sales">
                Sales history <span className="text-xs text-muted-foreground tabular">{detail.sales.length}</span>
              </TabsTrigger>
              <TabsTrigger value="purchase">Purchase history</TabsTrigger>
            </TabsList>
            <TabsContent value="movements">
              <Panel>
                <MovementTimeline movements={detail.movements} />
              </Panel>
            </TabsContent>
            <TabsContent value="sales">
              <SalesHistory detail={detail} />
            </TabsContent>
            <TabsContent value="purchase">
              <PurchaseHistory detail={detail} canSeeCost={canSeeCost} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <PriceOverrideDialog detail={detail} open={open === "price"} onOpenChange={close} />
      <RackDialog detail={detail} open={open === "rack"} onOpenChange={close} locations={locations ?? []} />
      <DamageDialog detail={detail} open={open === "damage"} onOpenChange={close} />
      <Dialog open={open === "photos"} onOpenChange={close}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Photos of {item.sku}</DialogTitle>
            <DialogDescription>These photos are used for this exact saree on POS, the website and WhatsApp. Without them the design photos are shown.</DialogDescription>
          </DialogHeader>
          <ImageManager imageIds={item.imageIds} onChange={(ids) => void photos.run(item.id, ids)} emptyHint="No piece photos yet. The design photos are shown until you add some." />
        </DialogContent>
      </Dialog>
      <ShareProductDialog
        open={open === "share"}
        onOpenChange={close}
        product={{ name: design.name, slug: design.slug, price: detail.price, description: design.description, available: item.status === "AVAILABLE" ? 1 : 0, imageId: detail.imageIds[0] ?? null }}
      />
    </>
  );
}

function SalesHistory({ detail }: { detail: InventoryDetail }) {
  if (detail.sales.length === 0) {
    return (
      <Panel>
        <p className="py-6 text-center text-sm text-muted-foreground">This saree has not been sold yet.</p>
      </Panel>
    );
  }
  return (
    <Panel bodyClassName="p-0 sm:p-0">
      <ul className="divide-y">
        {[...detail.sales]
          .sort((a, b) => b.orderItem.createdAt - a.orderItem.createdAt)
          .map(({ orderItem, order }) => (
            <li key={orderItem.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <Link href={order ? `/orders/view?number=${order.number}` : "#"} className="font-medium text-primary hover:underline">
                  Order #{order?.number ?? "?"}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {formatDate(orderItem.createdAt)} · {order?.customer.name ?? "Walk-in customer"}
                  {orderItem.status !== "ACTIVE" && <> · {orderItem.status.toLowerCase()}</>}
                </div>
              </div>
              {order && <ChannelBadge channel={order.channel} />}
              {order && <OrderStatusBadge status={order.status} />}
              <div className="text-right">
                <div className="font-medium tabular">{formatINR(orderItem.lineTotal)}</div>
                <div className="text-xs text-muted-foreground tabular">
                  price charged{orderItem.discount > 0 && <> · {formatINR(orderItem.discount)} off</>}
                </div>
              </div>
            </li>
          ))}
      </ul>
    </Panel>
  );
}

function PurchaseHistory({ detail, canSeeCost }: { detail: InventoryDetail; canSeeCost: boolean }) {
  const { purchase, supplier, item } = detail;
  if (!purchase) {
    return (
      <Panel>
        <div className="divide-y">
          <KeyValue label="Source">Added directly to stock (no purchase bill)</KeyValue>
          <KeyValue label="Received">{formatDate(item.receivedAt)}</KeyValue>
          {supplier && <KeyValue label="Supplier">{supplier.name}</KeyValue>}
          {canSeeCost && <KeyValue label="Purchase price">{formatINR(item.cost)}</KeyValue>}
        </div>
      </Panel>
    );
  }
  return (
    <Panel
      action={
        <Button asChild size="sm" variant="ghost">
          <Link href={`/purchases/view?id=${purchase.id}`}>
            Open purchase <ExternalLink />
          </Link>
        </Button>
      }
      title={purchase.number}
    >
      <div className="grid gap-x-8 sm:grid-cols-2">
        <div className="divide-y">
          <KeyValue label="Purchase">
            <Link href={`/purchases/view?id=${purchase.id}`} className="text-primary hover:underline">
              {purchase.number}
            </Link>
          </KeyValue>
          <KeyValue label="Supplier">{supplier?.name ?? "Unknown"}</KeyValue>
          <KeyValue label="Supplier invoice">{purchase.invoiceNumber}</KeyValue>
        </div>
        <div className="divide-y max-sm:border-t">
          <KeyValue label="Bill date">{formatDate(purchase.date)}</KeyValue>
          <KeyValue label="Pieces in batch">{formatNumber(purchase.pieceCount)}</KeyValue>
          {canSeeCost && <KeyValue label="Cost of this piece">{formatINR(item.cost)}</KeyValue>}
        </div>
      </div>
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <Skeleton className="aspect-[4/5] rounded-xl lg:col-span-5 xl:col-span-4" />
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function InventoryDetailPage() {
  return (
    <Suspense>
      <InventoryDetailPageView />
    </Suspense>
  );
}
