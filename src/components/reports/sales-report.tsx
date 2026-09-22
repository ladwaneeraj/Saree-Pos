"use client";

import { BadgePercent, IndianRupee, Package, ReceiptText, RotateCcw, ShoppingBag, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot } from "@/components/shared/misc";
import { StatCard } from "@/components/shared/stat-card";
import { BarList, ChartSkeleton, DonutBreakdown, MonthlyBarChart, SERIES, SalesAreaChart } from "./charts";
import { Panel } from "./panel";
import { CsvButton, TableSection } from "./table-section";
import type { DesignMetric, SalesReport } from "@/services/reports";
import { formatINR, formatINRCompact, formatNumber } from "@/lib/format";

export function SalesReportView({ data, canSeeCost, rangeLabel }: { data: SalesReport | undefined; canSeeCost: boolean; rangeLabel: string }) {
  const router = useRouter();
  const t = data?.totals;
  const loading = !t;
  const marginPct = t && t.gross > 0 ? Math.round((t.margin / t.gross) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Gross sales" icon={IndianRupee} loading={loading} value={t && formatINRCompact(t.gross)} hint={t && formatINR(t.gross)} />
        <StatCard label="Orders" icon={ReceiptText} loading={loading} value={t && formatNumber(t.orders)} hint="Paid orders" />
        <StatCard label="Units sold" icon={ShoppingBag} loading={loading} value={t && formatNumber(t.units)} hint="Sarees" />
        <StatCard label="Avg. order value" icon={Wallet} loading={loading} value={t && formatINR(t.aov)} hint="Per paid order" />
        <StatCard label="Refunds" icon={RotateCcw} loading={loading} value={t && formatINRCompact(t.refunds)} hint={t && `${formatINRCompact(t.discounts)} discounts given`} />
        <StatCard label="Net sales" icon={Package} loading={loading} value={t && formatINRCompact(t.net)} hint="After refunds" />
        {canSeeCost && <StatCard label="Gross margin" icon={BadgePercent} loading={loading} value={t && formatINRCompact(t.margin)} hint={t && `${marginPct}% of sales`} className="col-span-2 md:col-span-1" />}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel className="lg:col-span-3" title="Sales by day" description={rangeLabel}>
          {data ? <SalesAreaChart data={data.daily} /> : <ChartSkeleton />}
        </Panel>
        <Panel className="lg:col-span-2" title="Sales by month" description="Last 12 months">
          {data ? <MonthlyBarChart data={data.monthly} /> : <ChartSkeleton />}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Sales by channel" description={rangeLabel}>
          {data ? <DonutBreakdown data={data.byChannel} centerLabel="gross" /> : <ChartSkeleton className="h-48" />}
        </Panel>
        <Panel title="Payment methods" description="Payments received">
          {data ? <DonutBreakdown data={data.byPayment} valueLabel="Received" centerLabel="received" /> : <ChartSkeleton className="h-48" />}
        </Panel>
        <Panel
          title="Top fabrics"
          description="Net sales after discounts"
          className="md:col-span-2 xl:col-span-1"
          action={<CsvButton rows={data?.topFabrics} spec={{ filename: "top-fabrics", header: ["Fabric", "Pieces sold", "Net sales"], row: (r) => [r.name, r.count, r.value] }} />}
        >
          {data ? <BarList colour={SERIES[1]} items={data.topFabrics.slice(0, 8).map((f) => ({ key: f.key, label: f.name, value: f.value, display: formatINRCompact(f.value), hint: `${formatNumber(f.count)} pcs` }))} empty="No sales in this period." /> : <ChartSkeleton className="h-48" />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <TableSection<DesignMetric>
            title="Top designs"
            description="By net revenue in this period"
            rows={data?.topDesigns}
            rowKey={(r) => r.design.id}
            onRowClick={(r) => router.push(`/designs/view?id=${r.design.id}`)}
            csv={{ filename: "top-designs", header: ["Design", "Code", "Units sold", "Revenue", "In stock"], row: (r) => [r.design.name, r.design.code, r.units, r.revenue, r.available] }}
            columns={[
              { key: "rank", header: "#", className: "w-8 text-muted-foreground tabular", cell: (r) => (data?.topDesigns.indexOf(r) ?? 0) + 1 },
              {
                key: "design",
                header: "Design",
                cell: (r) => (
                  <div className="flex items-center gap-3">
                    <MediaImage id={r.imageId} alt={r.design.name} thumb className="w-8 shrink-0" rounded="rounded" />
                    <div className="min-w-0">
                      <div className="max-w-60 truncate font-medium">{r.design.name}</div>
                      <div className="text-xs text-muted-foreground">{r.design.code}</div>
                    </div>
                  </div>
                ),
              },
              { key: "units", header: "Sold", align: "right", cell: (r) => formatNumber(r.units) },
              { key: "revenue", header: "Revenue", align: "right", cell: (r) => <span className="font-medium">{formatINR(r.revenue)}</span> },
              { key: "stock", header: "In stock", align: "right", cell: (r) => formatNumber(r.available) },
            ]}
            mobileCard={(r) => (
              <div className="flex items-center gap-3">
                <MediaImage id={r.imageId} alt={r.design.name} thumb className="w-10 shrink-0" rounded="rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.design.name}</div>
                  <div className="text-xs text-muted-foreground">{formatNumber(r.units)} sold · {formatNumber(r.available)} in stock</div>
                </div>
                <span className="text-sm font-semibold tabular">{formatINRCompact(r.revenue)}</span>
              </div>
            )}
          />
        </div>
        <Panel
          className="xl:col-span-2"
          title="Top colours"
          description="Net sales by saree colour"
          action={<CsvButton rows={data?.topColours} spec={{ filename: "top-colours", header: ["Colour", "Pieces sold", "Net sales"], row: (r) => [r.name, r.count, r.value] }} />}
        >
          {data ? (
            <BarList
              colour={SERIES[2]}
              items={data.topColours.map((c) => ({ key: c.key, leading: <ColourDot hex={c.hex} className="size-5" />, label: c.name, value: c.value, display: formatINRCompact(c.value), hint: `${formatNumber(c.count)} pcs` }))}
              empty="No sales in this period."
            />
          ) : (
            <ChartSkeleton />
          )}
        </Panel>
      </div>
    </div>
  );
}
