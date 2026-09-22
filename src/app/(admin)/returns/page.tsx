"use client";

import { PackageSearch, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Pill, ReturnStatusBadge } from "@/components/shared/status-badge";
import { ReturnDrawer } from "@/components/returns/return-drawer";
import type { ReturnRequest, ReturnStatus } from "@/domain/types";
import { useLive } from "@/hooks/use-live";
import { useNow } from "@/hooks/use-now";
import { formatDate, formatINR, formatRelative } from "@/lib/format";
import { listReturns } from "@/services/returns";

type Tab = "OPEN" | "DONE" | "REJECTED" | "ALL";
const TAB_STATUSES: Record<Exclude<Tab, "ALL">, ReturnStatus[]> = {
  OPEN: ["REQUESTED", "APPROVED", "RECEIVED", "QC_COMPLETED"],
  DONE: ["REFUNDED", "EXCHANGED"],
  REJECTED: ["REJECTED"],
};
const TABS: { value: Tab; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "DONE", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export default function ReturnsPage() {
  return (
    <Suspense>
      <Returns />
    </Suspense>
  );
}

function Returns() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("open");
  const [tab, setTab] = useState<Tab>("OPEN");
  const [q, setQ] = useState("");
  const { data } = useLive(listReturns, []);
  const now = useNow(60_000);

  const setOpen = (id: string | null) => router.replace(id ? `/returns?open=${id}` : "/returns", { scroll: false });

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { OPEN: 0, DONE: 0, REJECTED: 0, ALL: data?.length ?? 0 };
    for (const r of data ?? []) for (const [t, s] of Object.entries(TAB_STATUSES)) if (s.includes(r.status)) c[t as Tab]++;
    return c;
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, "");
    return data?.filter(
      (r) =>
        (tab === "ALL" || TAB_STATUSES[tab].includes(r.status)) &&
        (!needle || `${r.number} ${r.orderNumber} ${r.customerName} ${r.lines.map((l) => l.sku).join(" ")}`.toLowerCase().includes(needle)),
    );
  }, [data, tab, q]);

  const byStatus = (s: ReturnStatus) => data?.filter((r) => r.status === s).length ?? 0;
  const refunded30d = data?.filter((r) => r.status === "REFUNDED" && r.updatedAt > now - 30 * 86_400_000).reduce((s, r) => s + r.refundAmount, 0) ?? 0;

  const columns: Column<ReturnRequest>[] = [
    { key: "number", header: "Return", cell: (r) => <span className="font-semibold">{r.number}</span> },
    { key: "date", header: "Requested", cell: (r) => <span title={formatDate(r.createdAt)}>{formatRelative(r.createdAt)}</span> },
    { key: "order", header: "Order", cell: (r) => <span className="tabular">#{r.orderNumber}</span> },
    { key: "customer", header: "Customer", cell: (r) => <span className="font-medium">{r.customerName}</span> },
    { key: "type", header: "Type", cell: (r) => <Pill tone={r.type === "EXCHANGE" ? "gold" : "neutral"} dot={false}>{r.type === "EXCHANGE" ? "Exchange" : "Return"}</Pill> },
    {
      key: "items",
      header: "Pieces",
      cell: (r) => (
        <div className="max-w-44 truncate">
          {r.lines[0]?.designName}
          {r.lines.length > 1 && <span className="text-muted-foreground"> +{r.lines.length - 1}</span>}
        </div>
      ),
    },
    { key: "reason", header: "Reason", cell: (r) => <div className="max-w-48 truncate text-muted-foreground" title={r.reason}>{r.reason}</div> },
    { key: "value", header: "Value", align: "right", cell: (r) => formatINR(r.refundAmount) },
    { key: "status", header: "Status", cell: (r) => <ReturnStatusBadge status={r.status} /> },
  ];

  return (
    <>
      <PageHeader title="Returns & exchanges" description="Approve requests, receive parcels, quality check every piece and settle refunds or exchanges." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Awaiting approval" value={byStatus("REQUESTED")} loading={!data} hint="Reply within 24 hours" />
        <StatCard label="Awaiting parcel" value={byStatus("APPROVED")} loading={!data} hint="Reverse pickup scheduled" />
        <StatCard label="Quality check / settle" value={byStatus("RECEIVED") + byStatus("QC_COMPLETED")} loading={!data} hint="At the shop" />
        <StatCard label="Refunded, 30 days" value={formatINR(refunded30d)} loading={!data} />
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.label}
                <span className="text-xs text-muted-foreground tabular">{data ? counts[t.value] : ""}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput value={q} onChange={setQ} placeholder="Search return, order #, customer, SKU…" className="md:w-80" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={(r) => setOpen(r.id)}
        mobileCard={(r) => (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{r.number}</span>
              <ReturnStatusBadge status={r.status} />
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{r.customerName} · #{r.orderNumber}</span>
              <span className="font-medium tabular">{formatINR(r.refundAmount)}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {r.type === "EXCHANGE" ? "Exchange" : "Return"} · {r.reason}
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={tab === "OPEN" ? RotateCcw : PackageSearch}
            title={tab === "OPEN" ? "No open returns" : "Nothing here"}
            description={tab === "OPEN" ? "Return and exchange requests from customers and staff will appear here." : "Try another tab or clear the search."}
          />
        }
      />

      <ReturnDrawer returnId={openId} onClose={() => setOpen(null)} />
    </>
  );
}
