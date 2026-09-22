"use client";

import { Suspense } from "react";
import { useQueryParam } from "@/hooks/use-query-param";

import { Ban, PackageCheck, PackageSearch, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { ColourDot, KeyValue } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryStatusBadge } from "@/components/shared/status-badge";
import { PurchaseStatusBadge } from "@/components/purchases/purchase-status-badge";
import { ReceivedDialog, type ReceivedInfo } from "@/components/purchases/received-dialog";
import type { InventoryItem } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { cancelPurchase, getPurchaseDetail, receivePurchase, type PurchaseDetail } from "@/services/purchases";
import { useCan } from "@/stores/session";

type Line = PurchaseDetail["lines"][number];
const PIECES_PAGE = 40;

function PurchaseDetailPageView() {
  const id = useQueryParam("id");
  const { data, loading } = useLive(() => getPurchaseDetail(id), [id]);
  const catalog = useCatalog();
  const canSeeCost = useCan("cost:view");
  const { confirm, dialog } = useConfirm();
  const receive = useAction(receivePurchase);
  const cancel = useAction(cancelPurchase, { success: "Draft cancelled" });
  const [received, setReceived] = useState<ReceivedInfo | null>(null);
  const [page, setPage] = useState(1);

  const designNames = useMemo(() => new Map(data?.lines.map((l) => [l.designId, l.designName])), [data]);

  if (!data) {
    if (!loading && data === null) {
      return <EmptyState icon={PackageSearch} title="Purchase not found" description="It may have been removed when demo data was reset." action={<Button asChild variant="outline"><Link href="/purchases">Back to purchases</Link></Button>} />;
    }
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const { purchase, supplier, lines, pieces } = data;
  const retail = lines.reduce((s, l) => s + l.quantity * l.price, 0);

  const doReceive = async () => {
    const ok = await confirm({ title: `Receive ${purchase.pieceCount} pieces?`, description: "Each piece gets its own SKU and becomes available on POS, website and WhatsApp.", confirmLabel: "Receive stock" });
    if (!ok) return;
    const items = await receive.run(purchase.id);
    if (items) setReceived({ purchaseId: purchase.id, number: purchase.number, pieces: items.length, totalCost: purchase.totalCost, firstSku: items[0]?.sku, lastSku: items.at(-1)?.sku });
  };
  const doCancel = async () => {
    const ok = await confirm({ title: `Cancel ${purchase.number}?`, description: "The draft is kept for your records but can no longer be received.", confirmLabel: "Cancel draft", destructive: true });
    if (ok) await cancel.run(purchase.id);
  };

  const lineColumns: Column<Line>[] = [
    { key: "design", header: "Design", cell: (l) => <Link href={`/designs/view?id=${l.designId}`} className="font-medium hover:underline">{l.designName}</Link> },
    { key: "colour", header: "Colour", cell: (l) => <span className="inline-flex items-center gap-2"><ColourDot hex={catalog?.colourById.get(l.colourId)?.hex ?? "#999"} />{l.colourName}</span> },
    { key: "qty", header: "Qty", align: "right", cell: (l) => formatNumber(l.quantity) },
    ...(canSeeCost ? [{ key: "cost", header: "Cost", align: "right" as const, cell: (l: Line) => formatINR(l.cost) }] : []),
    { key: "mrp", header: "MRP", align: "right", cell: (l) => formatINR(l.mrp) },
    { key: "price", header: "Selling", align: "right", cell: (l) => formatINR(l.price) },
    { key: "rack", header: "Rack", cell: (l) => <span className="font-mono text-xs">{l.location || "-"}</span> },
    ...(canSeeCost ? [{ key: "total", header: "Line total", align: "right" as const, cell: (l: Line) => <span className="font-medium">{formatINR(l.quantity * l.cost)}</span> }] : []),
  ];

  const pieceColumns: Column<InventoryItem>[] = [
    { key: "sku", header: "SKU", cell: (p) => <Link href={`/inventory/item?sku=${p.sku}`} className="font-mono text-[13px] font-medium text-primary hover:underline">{p.sku}</Link> },
    { key: "design", header: "Design", cell: (p) => <span className="block max-w-64 truncate">{designNames.get(p.designId)}</span> },
    { key: "colour", header: "Colour", cell: (p) => { const c = catalog?.colourById.get(p.colourId); return <span className="inline-flex items-center gap-2"><ColourDot hex={c?.hex ?? "#999"} />{c?.name}</span>; } },
    { key: "rack", header: "Rack", cell: (p) => <span className="font-mono text-xs">{p.location}</span> },
    { key: "status", header: "Status", cell: (p) => <InventoryStatusBadge status={p.status} /> },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/purchases", label: "Purchases" }}
        title={<span className="inline-flex flex-wrap items-center gap-3">{purchase.number} <PurchaseStatusBadge status={purchase.status} /></span>}
        description={<>{supplier?.name ?? "Unknown supplier"} · Invoice {purchase.invoiceNumber} · {formatDate(purchase.date)}</>}
        actions={
          <>
            {purchase.status === "DRAFT" && (
              <>
                <Button variant="outline" onClick={doCancel} disabled={cancel.pending}><Ban /> Cancel draft</Button>
                <Button onClick={doReceive} disabled={receive.pending}><PackageCheck /> {receive.pending ? "Receiving…" : `Receive ${purchase.pieceCount} pieces`}</Button>
              </>
            )}
            {purchase.status === "RECEIVED" && pieces.length > 0 && (
              <Button asChild>
                <Link href={`/labels?purchase=${purchase.id}`}><Printer /> Print {pieces.length} labels</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Invoice lines</h2>
            <DataTable
              columns={lineColumns}
              rows={lines}
              rowKey={(l) => l.id}
              mobileCard={(l) => (
                <div>
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{l.designName}</span><span className="tabular">× {l.quantity}</span></div>
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{l.colourName} · Rack {l.location || "-"}</span><span>{formatINR(l.price)}{canSeeCost && ` · cost ${formatINR(l.cost)}`}</span></div>
                </div>
              )}
            />
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Received pieces {pieces.length > 0 && <span className="font-normal text-muted-foreground">· {formatNumber(pieces.length)} SKUs</span>}</h2>
            </div>
            {pieces.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title={purchase.status === "CANCELLED" ? "This draft was cancelled" : "Stock not received yet"}
                description={purchase.status === "DRAFT" ? "Receive the stock when the parcel arrives. SKUs and labels are created then." : undefined}
              />
            ) : (
              <>
                <DataTable
                  columns={pieceColumns}
                  rows={pieces.slice((page - 1) * PIECES_PAGE, page * PIECES_PAGE)}
                  rowKey={(p) => p.id}
                  mobileCard={(p) => (
                    <Link href={`/inventory/item?sku=${p.sku}`} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-medium text-primary">{p.sku}</div>
                        <div className="truncate text-xs text-muted-foreground">{designNames.get(p.designId)} · {catalog?.colourById.get(p.colourId)?.name}</div>
                      </div>
                      <InventoryStatusBadge status={p.status} />
                    </Link>
                  )}
                />
                {pieces.length > PIECES_PAGE && <Pagination page={page} pageSize={PIECES_PAGE} total={pieces.length} onPageChange={setPage} />}
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border bg-card p-5 shadow-xs">
            <h2 className="mb-2 text-sm font-semibold">Summary</h2>
            <div className="divide-y">
              <KeyValue label="Pieces">{formatNumber(purchase.pieceCount)}</KeyValue>
              {canSeeCost && <KeyValue label="Total cost">{formatINR(purchase.totalCost)}</KeyValue>}
              <KeyValue label="Retail value">{formatINR(retail)}</KeyValue>
              {canSeeCost && retail > 0 && <KeyValue label="Margin">{Math.round((1 - purchase.totalCost / retail) * 100)}%</KeyValue>}
              <KeyValue label="Created">{formatDateTime(purchase.createdAt)}</KeyValue>
              {purchase.receivedAt && <KeyValue label="Received">{formatDateTime(purchase.receivedAt)}</KeyValue>}
            </div>
            {purchase.notes && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">{purchase.notes}</p>}
          </div>
          {supplier && (
            <div className="rounded-xl border bg-card p-5 shadow-xs">
              <h2 className="text-sm font-semibold">{supplier.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {[supplier.contactName, supplier.city].filter(Boolean).join(" · ")}
                {supplier.phone && <><br />{supplier.phone}</>}
                {supplier.gstin && <><br />GSTIN {supplier.gstin}</>}
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
                <Link href={`/purchases?supplier=${supplier.id}`}>All purchases from this supplier</Link>
              </Button>
            </div>
          )}
        </aside>
      </div>
      <ReceivedDialog info={received} canSeeCost={canSeeCost} onPurchasePage onClose={() => setReceived(null)} />
      {dialog}
    </>
  );
}

export default function PurchaseDetailPage() {
  return (
    <Suspense>
      <PurchaseDetailPageView />
    </Suspense>
  );
}
