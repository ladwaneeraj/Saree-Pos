"use client";

import { Download, ReceiptText, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { ChannelBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import type { SalesChannel } from "@/domain/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/domain/rules/orders";
import { useLive } from "@/hooks/use-live";
import { downloadFile, toCsv } from "@/lib/files";
import { formatDate, formatDateTime, formatINR, formatNumber, formatTime } from "@/lib/format";
import { CHANNEL_LABELS, searchOrders, type OrderQuery, type OrderRow, type OrderTab } from "@/services/orders";
import { DAY_MS, startOfDay } from "@/services/context";

const TABS: { value: OrderTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ATTENTION", label: "Needs attention" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CLOSED", label: "Closed" },
];

type Range = "today" | "7d" | "30d" | "all";
const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

function rangeStart(range: Range): number | null {
  const today = startOfDay(Date.now());
  if (range === "today") return today;
  if (range === "7d") return today - 6 * DAY_MS;
  if (range === "30d") return today - 29 * DAY_MS;
  return null;
}

const PAGE_SIZE = 25;

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}

const TAB_VALUES: OrderTab[] = ["ALL", "ATTENTION", "PROCESSING", "SHIPPED", "COMPLETED", "CLOSED"];

function OrdersView() {
  const router = useRouter();
  const params = useSearchParams();
  const initialTab = params.get("tab") as OrderTab | null;
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<OrderTab>(initialTab && TAB_VALUES.includes(initialTab) ? initialTab : "ALL");
  const [channel, setChannel] = useState<SalesChannel | "ALL">("ALL");
  const [range, setRange] = useState<Range>("all");
  const [page, setPage] = useState(1);

  const query: OrderQuery = { q, tab, channel, from: rangeStart(range), page, pageSize: PAGE_SIZE };
  const { data } = useLive(() => searchOrders(query), [q, tab, channel, range, page]);
  const filtersActive = !!q || channel !== "ALL" || range !== "all";
  const reset = () => {
    setQ("");
    setChannel("ALL");
    setRange("all");
    setPage(1);
  };

  const exportCsv = async () => {
    const all = await searchOrders({ ...query, page: 1, pageSize: Number.POSITIVE_INFINITY });
    const header = ["Order", "Date", "Channel", "Customer", "Phone", "City", "Items", "Total", "Payment", "Status"];
    const rows = all.rows.map(({ order: o }) => [
      `#${o.number}`,
      formatDateTime(o.createdAt),
      CHANNEL_LABELS[o.channel],
      o.customer.name,
      o.customer.phone,
      o.shippingAddress?.city ?? "",
      o.itemCount,
      o.total,
      PAYMENT_STATUS_LABELS[o.paymentStatus],
      ORDER_STATUS_LABELS[o.status],
    ]);
    downloadFile(`dhanvi-orders-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
  };

  const columns: Column<OrderRow>[] = [
    { key: "number", header: "Order", cell: ({ order }) => <span className="font-semibold tabular">#{order.number}</span> },
    {
      key: "date",
      header: "Date",
      cell: ({ order }) => (
        <div className="leading-tight">
          <div>{formatDate(order.createdAt)}</div>
          <div className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: ({ order }) => (
        <div className="max-w-48 leading-tight">
          <div className="truncate font-medium">{order.customer.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[order.customer.phone, order.shippingAddress?.city].filter(Boolean).join(" · ") || "Counter sale"}
          </div>
        </div>
      ),
    },
    { key: "channel", header: "Channel", cell: ({ order }) => <ChannelBadge channel={order.channel} /> },
    {
      key: "items",
      header: "Items",
      cell: (r) => (
        <div className="flex max-w-60 items-center gap-2.5">
          <MediaImage id={r.firstImageId} alt={r.firstItemName} thumb className="w-8 shrink-0" rounded="rounded" />
          <div className="min-w-0 leading-tight">
            <div className="truncate">{r.firstItemName}</div>
            {r.order.itemCount > 1 && <div className="text-xs text-muted-foreground">+{r.order.itemCount - 1} more</div>}
          </div>
        </div>
      ),
    },
    { key: "total", header: "Total", align: "right", cell: ({ order }) => <span className="font-medium">{formatINR(order.total)}</span> },
    { key: "payment", header: "Payment", cell: ({ order }) => <PaymentStatusBadge status={order.paymentStatus} /> },
    { key: "status", header: "Status", cell: ({ order }) => <OrderStatusBadge status={order.status} /> },
  ];

  const counts = data?.tabCounts;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Every order from the website, WhatsApp and the shop counter in one place."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Export CSV
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v as OrderTab); setPage(1); }} className="mb-4">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.label}
                {counts && (
                  <span className={t.value === "ATTENTION" && counts.ATTENTION > 0 ? "rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white tabular" : "text-xs text-muted-foreground tabular"}>
                    {formatNumber(counts[t.value])}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search order #, customer, phone, city…" className="md:w-80" />
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Select value={channel} onValueChange={(v) => { setChannel(v as SalesChannel | "ALL"); setPage(1); }}>
            <SelectTrigger className="w-full bg-card md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All channels</SelectItem>
              <SelectItem value="WEBSITE">Website</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="SHOP">Shop</SelectItem>
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => { setRange(v as Range); setPage(1); }}>
            <SelectTrigger className="w-full bg-card md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={reset} className="self-start md:self-auto">
            <X /> Clear filters
          </Button>
        )}
        {data && <span className="text-sm text-muted-foreground md:ml-auto tabular">{formatNumber(data.total)} orders</span>}
      </div>

      <DataTable
        columns={columns}
        rows={data?.rows}
        rowKey={(r) => r.order.id}
        onRowClick={(r) => router.push(`/orders/view?number=${r.order.number}`)}
        mobileCard={(r) => (
          <div className="flex gap-3">
            <MediaImage id={r.firstImageId} alt={r.firstItemName} thumb className="w-12 shrink-0" rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold tabular">#{r.order.number}</span>
                <span className="font-semibold tabular">{formatINR(r.order.total)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.order.customer.name}</span>
                <ChannelBadge channel={r.order.channel} />
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {r.firstItemName}
                {r.order.itemCount > 1 && ` +${r.order.itemCount - 1}`} · {formatDateTime(r.order.createdAt)}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <OrderStatusBadge status={r.order.status} />
                <PaymentStatusBadge status={r.order.paymentStatus} />
              </div>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={ReceiptText}
            title="No orders found"
            description={filtersActive ? "Try a different search or widen the date range." : "Orders from every channel will appear here."}
            action={filtersActive ? <Button variant="outline" onClick={reset}>Clear filters</Button> : undefined}
          />
        }
      />
      {data && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
    </>
  );
}
