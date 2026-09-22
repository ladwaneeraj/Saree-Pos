"use client";

import { Boxes, Gem, Hourglass, Layers, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/shared/stat-card";
import { AgingBars, BarList, ChartSkeleton, SERIES } from "./charts";
import { Panel } from "./panel";
import { CsvButton, TableSection } from "./table-section";
import type { InventoryReport } from "@/services/reports";
import { formatINR, formatINRCompact, formatNumber, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

type Old = InventoryReport["oldStock"][number];
type Fast = InventoryReport["fastMoving"][number];
type Slow = InventoryReport["slowMoving"][number];

export function InventoryReportView({ data, canSeeCost }: { data: InventoryReport | undefined; canSeeCost: boolean }) {
  const router = useRouter();
  const t = data?.totals;
  const open = (id: string) => router.push(`/designs/view?id=${id}`);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pieces in stock" icon={Boxes} loading={!t} value={t && formatNumber(t.pieces)} hint="Available and reserved" />
        <StatCard label="Designs in stock" icon={Layers} loading={!t} value={t && formatNumber(t.designs)} hint="With at least one piece" />
        <StatCard label="Retail value" icon={Gem} loading={!t} value={t && formatINRCompact(t.retail)} hint="At current selling prices" />
        {canSeeCost && <StatCard label="Cost value" icon={Wallet} loading={!t} value={t && formatINRCompact(t.cost)} hint={t && t.retail > 0 ? `${Math.round((1 - t.cost / t.retail) * 100)}% margin locked in stock` : undefined} />}
      </div>

      {canSeeCost && <MoneyStuck aging={data?.aging} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Inventory aging" description="Pieces by days since received">
          {data ? <AgingBars data={data.aging} showCost={canSeeCost} /> : <ChartSkeleton className="h-48" />}
        </Panel>
        <ValuePanel title="Inventory value by fabric" rows={data?.byFabric} canSeeCost={canSeeCost} filename="stock-by-fabric" colour={SERIES[1]} />
        <ValuePanel title="Inventory value by category" rows={data?.byCategory} canSeeCost={canSeeCost} filename="stock-by-category" colour={SERIES[3]} />
      </div>

      <TableSection<Old>
        title="Old stock"
        description="Designs with pieces on the shelf for more than 180 days. Consider a festive offer or a WhatsApp broadcast."
        rows={data?.oldStock}
        rowKey={(r) => r.design.id}
        onRowClick={(r) => open(r.design.id)}
        empty="No pieces older than 180 days."
        csv={{ filename: "old-stock", header: ["Design", "Code", "Pieces", "Oldest (days)", ...(canSeeCost ? ["Cost value"] : []), "Retail value"], row: (r) => [r.design.name, r.design.code, r.pieces, r.oldestDays, ...(canSeeCost ? [r.cost] : []), r.retail] }}
        columns={[
          { key: "design", header: "Design", cell: (r) => <DesignCell name={r.design.name} code={r.design.code} /> },
          { key: "pieces", header: "Pieces", align: "right", cell: (r) => formatNumber(r.pieces) },
          { key: "oldest", header: "Oldest", align: "right", cell: (r) => <span className="text-destructive">{r.oldestDays} days</span> },
          ...(canSeeCost ? [{ key: "cost", header: "Cost value", align: "right" as const, cell: (r: Old) => <span className="font-medium">{formatINR(r.cost)}</span> }] : []),
          { key: "retail", header: "Retail value", align: "right", cell: (r) => formatINR(r.retail) },
        ]}
        mobileCard={(r) => <MobileRow name={r.design.name} sub={`${pluralize(r.pieces, "piece")} · oldest ${r.oldestDays} days`} value={formatINRCompact(canSeeCost ? r.cost : r.retail)} />}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <TableSection<Fast>
          title="Fast moving"
          description="Most pieces sold in the last 30 days. Sell-through = sold ÷ (sold + in stock)."
          rows={data?.fastMoving}
          rowKey={(r) => r.design.id}
          onRowClick={(r) => open(r.design.id)}
          csv={{ filename: "fast-moving", header: ["Design", "Code", "Sold (30 days)", "In stock", "Sell-through %", "Revenue"], row: (r) => [r.design.name, r.design.code, r.units, r.available, Math.round(r.sellThrough * 100), r.revenue] }}
          columns={[
            { key: "design", header: "Design", cell: (r) => <DesignCell name={r.design.name} code={r.design.code} /> },
            { key: "sold", header: "Sold", align: "right", cell: (r) => formatNumber(r.units) },
            { key: "stock", header: "In stock", align: "right", cell: (r) => formatNumber(r.available) },
            { key: "st", header: "Sell-through", align: "right", cell: (r) => <SellThrough value={r.sellThrough} /> },
          ]}
          mobileCard={(r) => <MobileRow name={r.design.name} sub={`${formatNumber(r.units)} sold · ${formatNumber(r.available)} in stock`} value={`${Math.round(r.sellThrough * 100)}%`} />}
        />
        <TableSection<Slow>
          title="Slow moving"
          description="Under 5% of the shelf sold in 90 days, average age over 45 days"
          rows={data?.slowMoving}
          rowKey={(r) => r.design.id}
          onRowClick={(r) => open(r.design.id)}
          empty="No slow moving designs. Stock is rotating well."
          csv={{ filename: "slow-moving", header: ["Design", "Code", "In stock", "Sold (90 days)", "Average age (days)", ...(canSeeCost ? ["Cost value"] : [])], row: (r) => [r.design.name, r.design.code, r.available, r.unitsSold90d, r.avgAgeDays, ...(canSeeCost ? [r.cost] : [])] }}
          columns={[
            { key: "design", header: "Design", cell: (r) => <DesignCell name={r.design.name} code={r.design.code} /> },
            { key: "stock", header: "In stock", align: "right", cell: (r) => formatNumber(r.available) },
            { key: "sold", header: "Sold 90d", align: "right", cell: (r) => formatNumber(r.unitsSold90d) },
            { key: "age", header: "Avg. age", align: "right", cell: (r) => `${r.avgAgeDays} d` },
            ...(canSeeCost ? [{ key: "cost", header: "Cost", align: "right" as const, cell: (r: Slow) => formatINRCompact(r.cost) }] : []),
          ]}
          mobileCard={(r) => <MobileRow name={r.design.name} sub={`${formatNumber(r.available)} in stock · ${r.avgAgeDays} days avg.`} value={canSeeCost ? formatINRCompact(r.cost) : `${r.unitsSold90d} sold`} />}
        />
      </div>
    </div>
  );
}

function MoneyStuck({ aging }: { aging: InventoryReport["aging"] | undefined }) {
  const total = aging?.reduce((s, a) => s + a.cost, 0) ?? 0;
  const old = aging?.[aging.length - 1];
  return (
    <section className="overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-br from-wine-50 via-card to-card shadow-xs">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="lg:w-72 lg:shrink-0">
          <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary">
            <Hourglass className="size-4" /> MONEY STUCK IN STOCK
          </div>
          {aging ? <div className="mt-2 font-display text-5xl tracking-tight tabular">{formatINRCompact(total)}</div> : <Skeleton className="mt-3 h-12 w-40" />}
          <p className="mt-1 text-sm text-muted-foreground">
            Purchase cost of every piece on the shelf.{" "}
            {old && old.cost > 0 && <span className="font-medium text-destructive">{formatINRCompact(old.cost)} has been sitting for over 180 days.</span>}
          </p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          {(aging ?? Array.from({ length: 4 }, () => null)).map((a, i) => (
            <div key={a?.key ?? i} className={cn("rounded-lg border bg-card/80 p-3.5", i === 3 && "border-destructive/30 bg-danger-soft/40")}>
              {a ? (
                <>
                  <div className={cn("text-xs font-medium text-muted-foreground", i === 3 && "text-destructive")}>{a.label}</div>
                  <div className="mt-1 text-xl font-semibold tabular">{formatINRCompact(a.cost)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground tabular">
                    {formatNumber(a.pieces)} pcs · {total ? Math.round((a.cost / total) * 100) : 0}%
                  </div>
                </>
              ) : (
                <Skeleton className="h-14 w-full" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ValuePanel({ title, rows, canSeeCost, filename, colour }: { title: string; rows: InventoryReport["byFabric"] | undefined; canSeeCost: boolean; filename: string; colour: string }) {
  const metric = (r: InventoryReport["byFabric"][number]) => (canSeeCost ? r.cost : r.retail);
  return (
    <Panel
      title={title}
      description={canSeeCost ? "At cost, retail value alongside" : "At selling price"}
      action={<CsvButton rows={rows} spec={{ filename, header: ["Name", "Pieces", ...(canSeeCost ? ["Cost value"] : []), "Retail value"], row: (r) => [r.name, r.count, ...(canSeeCost ? [r.cost] : []), r.retail] }} />}
    >
      {rows ? (
        <BarList
          colour={colour}
          items={[...rows].sort((a, b) => metric(b) - metric(a)).slice(0, 8).map((r) => ({ key: r.key, label: r.name, value: metric(r), display: formatINRCompact(metric(r)), hint: canSeeCost ? `${formatNumber(r.count)} pcs · ${formatINRCompact(r.retail)} retail` : `${formatNumber(r.count)} pcs` }))}
        />
      ) : (
        <ChartSkeleton className="h-48" />
      )}
    </Panel>
  );
}

function DesignCell({ name, code }: { name: string; code: string }) {
  return (
    <div className="min-w-0">
      <div className="max-w-64 truncate font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">{code}</div>
    </div>
  );
}

function SellThrough({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: SERIES[1] }} />
      </span>
      <span className="w-9 font-medium">{pct}%</span>
    </span>
  );
}

function MobileRow({ name, sub, value }: { name: string; sub: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      <span className="text-sm font-semibold tabular">{value}</span>
    </div>
  );
}
