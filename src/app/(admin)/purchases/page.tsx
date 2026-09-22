"use client";

import { FileSpreadsheet, Package, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { PurchaseStatusBadge } from "@/components/purchases/purchase-status-badge";
import type { PurchaseStatus } from "@/domain/types";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatDate, formatINR, formatINRCompact, formatNumber } from "@/lib/format";
import { listPurchases, type PurchaseRow } from "@/services/purchases";
import { useCan } from "@/stores/session";

const ALL = "__all";
const PAGE_SIZE = 25;
const TABS: { value: PurchaseStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PurchasesPage() {
  return (
    <Suspense>
      <Purchases />
    </Suspense>
  );
}

function Purchases() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const supplierId = params.get("supplier") ?? "";
  const catalog = useCatalog();
  const canSeeCost = useCan("cost:view");
  const { data } = useLive(listPurchases, []);
  const [status, setStatus] = useState<PurchaseStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const setSupplier = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete("supplier");
    else next.set("supplier", value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
    setPage(1);
  };

  const bySupplier = useMemo(() => data?.filter((r) => !supplierId || r.purchase.supplierId === supplierId), [data, supplierId]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bySupplier?.filter(
      (r) =>
        (status === "ALL" || r.purchase.status === status) &&
        (!needle || [r.purchase.number, r.purchase.invoiceNumber, r.supplier?.name ?? ""].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [bySupplier, status, q]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: bySupplier?.length ?? 0, DRAFT: 0, RECEIVED: 0, CANCELLED: 0 };
    bySupplier?.forEach((r) => c[r.purchase.status]!++);
    return c;
  }, [bySupplier]);
  const received = bySupplier?.filter((r) => r.purchase.status === "RECEIVED") ?? [];
  const totalPieces = received.reduce((s, r) => s + r.purchase.pieceCount, 0);
  const totalCost = received.reduce((s, r) => s + r.purchase.totalCost, 0);
  const pageRows = rows?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const supplierName = supplierId ? catalog?.supplierById.get(supplierId)?.name : null;

  const columns: Column<PurchaseRow>[] = [
    { key: "number", header: "Purchase ID", cell: (r) => <span className="font-mono text-[13px] font-medium">{r.purchase.number}</span> },
    {
      key: "supplier",
      header: "Supplier",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.supplier?.name ?? "Unknown supplier"}</div>
          {r.supplier?.city && <div className="text-xs text-muted-foreground">{r.supplier.city}</div>}
        </div>
      ),
    },
    { key: "invoice", header: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.purchase.invoiceNumber}</span> },
    { key: "date", header: "Date", cell: (r) => formatDate(r.purchase.date) },
    { key: "pieces", header: "Pieces", align: "right", cell: (r) => formatNumber(r.purchase.pieceCount) },
    ...(canSeeCost ? [{ key: "cost", header: "Total cost", align: "right" as const, cell: (r: PurchaseRow) => <span className="font-medium">{formatINR(r.purchase.totalCost)}</span> }] : []),
    { key: "status", header: "Status", cell: (r) => <PurchaseStatusBadge status={r.purchase.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Purchases"
        description={
          data ? (
            <>
              {supplierName ? `${supplierName}: ` : ""}
              {formatNumber(totalPieces)} pieces received
              {canSeeCost && <> worth {formatINRCompact(totalCost)}</>} across {formatNumber(received.length)} purchases
            </>
          ) : (
            "Loading purchases…"
          )
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/purchases/import"><FileSpreadsheet /> Import Excel / CSV</Link>
            </Button>
            <Button asChild>
              <Link href="/purchases/new"><Plus /> New purchase</Link>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={status} onValueChange={(v) => { setStatus(v as PurchaseStatus | "ALL"); setPage(1); }}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.label}
                {data && <span className="text-xs text-muted-foreground tabular">{counts[t.value]}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row lg:justify-end">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search purchase ID, invoice, supplier…" className="sm:w-72" />
          <Select value={supplierId || ALL} onValueChange={setSupplier}>
            <SelectTrigger className="w-full bg-card sm:w-60">
              <SelectValue placeholder="All suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All suppliers</SelectItem>
              {catalog?.suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {supplierId && (
            <Button variant="ghost" onClick={() => setSupplier(ALL)}>
              <X /> Clear
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={pageRows}
        rowKey={(r) => r.purchase.id}
        onRowClick={(r) => router.push(`/purchases/${r.purchase.id}`)}
        mobileCard={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-medium">{r.purchase.number}</span>
              <PurchaseStatusBadge status={r.purchase.status} />
            </div>
            <div className="mt-0.5 truncate text-sm">{r.supplier?.name}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDate(r.purchase.date)} · {r.purchase.invoiceNumber}</span>
              <span className="font-medium text-foreground">{formatNumber(r.purchase.pieceCount)} pcs{canSeeCost && ` · ${formatINRCompact(r.purchase.totalCost)}`}</span>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={Package}
            title={q || supplierId || status !== "ALL" ? "No purchases match" : "No purchases yet"}
            description="Record a supplier invoice to receive stock with SKUs and labels."
            action={<Button asChild><Link href="/purchases/new"><Plus /> New purchase</Link></Button>}
          />
        }
      />
      {rows && rows.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />}
    </>
  );
}
