"use client";

import { BarChart3, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MediaImage } from "@/components/shared/media-image";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import { FastMovingPanel, LowStockPanel, OldStockPanel } from "@/components/dashboard/stock-lists";
import { AgingBars, BarList, ChartSkeleton, DonutBreakdown, SERIES, SalesAreaChart } from "@/components/reports/charts";
import { Panel } from "@/components/reports/panel";
import { useLive } from "@/hooks/use-live";
import { formatINR, formatINRCompact, formatNumber } from "@/lib/format";
import { getDashboard } from "@/services/reports";
import { useCan, useSession } from "@/stores/session";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const longDate = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function DashboardPage() {
  const { data } = useLive(getDashboard, []);
  const user = useSession((s) => s.user);
  const canSeeCost = useCan("cost:view");
  const canPurchase = useCan("purchases:manage");
  const canReports = useCan("reports:view");
  const [agingMetric, setAgingMetric] = useState<"pieces" | "cost">(canSeeCost ? "cost" : "pieces");
  const [today] = useState(() => new Date());

  const month = data?.salesLast30.reduce((s, p) => s + p.sales, 0) ?? 0;
  const monthOrders = data?.salesLast30.reduce((s, p) => s + p.orders, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{longDate.format(today)}</p>
          <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
            {greeting(today.getHours())}, {user.name.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReports && (
            <Button variant="outline" asChild>
              <Link href="/reports"><BarChart3 /> Reports</Link>
            </Button>
          )}
          {canPurchase && (
            <Button asChild>
              <Link href="/purchases/new"><PackagePlus /> New purchase</Link>
            </Button>
          )}
        </div>
      </div>

      <DashboardKpis kpis={data?.kpis} canSeeCost={canSeeCost} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Sales, last 30 days"
          description={data ? `${formatINR(month)} from ${formatNumber(monthOrders)} paid orders` : " "}
        >
          {data ? <SalesAreaChart data={data.salesLast30} /> : <ChartSkeleton />}
        </Panel>
        <Panel title="Sales by channel" description="Last 30 days, paid orders">
          {data ? <DonutBreakdown data={data.salesByChannel} centerLabel="30 days" /> : <ChartSkeleton className="h-48" />}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Top 10 products" description="By pieces sold in the last 30 days" bodyClassName="pt-2">
          {data ? (
            <div className="grid gap-x-6 md:grid-cols-2">
              {[data.topProducts.slice(0, 5), data.topProducts.slice(5, 10)].map((col, ci) => (
                <BarList
                  key={ci}
                  empty={ci === 0 ? "No sales in the last 30 days." : ""}
                  items={col.map((m, i) => ({
                    key: m.design.id,
                    leading: (
                      <div className="relative shrink-0">
                        <MediaImage id={m.imageId} alt={m.design.name} thumb className="w-9" rounded="rounded-md" />
                        <span className="absolute -top-1.5 -left-1.5 flex size-4.5 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background tabular">{ci * 5 + i + 1}</span>
                      </div>
                    ),
                    label: <Link href={`/designs/view?id=${m.design.id}`} className="hover:underline">{m.design.name}</Link>,
                    value: m.units,
                    display: `${formatNumber(m.units)} sold`,
                    hint: formatINRCompact(m.revenue),
                  }))}
                />
              ))}
            </div>
          ) : (
            <ChartSkeleton />
          )}
        </Panel>
        <AttentionPanel attention={data?.attention} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Sales by category" description="Net of discounts, last 30 days">
          {data ? (
            <BarList colour={SERIES[1]} items={data.salesByCategory.map((c) => ({ key: c.key, label: c.name, value: c.value, display: formatINRCompact(c.value), hint: `${formatNumber(c.count)} pcs` }))} empty="No sales in the last 30 days." />
          ) : (
            <ChartSkeleton className="h-48" />
          )}
        </Panel>
        <Panel
          title="Inventory aging"
          description="Pieces in stock by days since received"
          action={
            canSeeCost && (
              <ToggleGroup type="single" size="sm" variant="outline" value={agingMetric} onValueChange={(v) => v && setAgingMetric(v as "pieces" | "cost")}>
                <ToggleGroupItem value="cost" className="px-2.5 text-xs">Cost</ToggleGroupItem>
                <ToggleGroupItem value="pieces" className="px-2.5 text-xs">Pieces</ToggleGroupItem>
              </ToggleGroup>
            )
          }
        >
          {data ? <AgingBars data={data.aging} showCost={canSeeCost && agingMetric === "cost"} /> : <ChartSkeleton className="h-48" />}
        </Panel>
        <Panel title="Payment methods" description="Payments received, last 30 days" className="md:col-span-2 xl:col-span-1">
          {data ? <DonutBreakdown data={data.paymentMethods} valueLabel="Received" centerLabel="received" /> : <ChartSkeleton className="h-48" />}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LowStockPanel rows={data?.lowStock} threshold={data?.lowStockThreshold ?? 3} />
        <FastMovingPanel rows={data?.fastMoving} />
        <OldStockPanel rows={data?.oldStock} canSeeCost={canSeeCost} />
      </div>
    </div>
  );
}
