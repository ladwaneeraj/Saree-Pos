"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR, formatINRCompact, formatNumber, formatShortDate, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Categorical order validated for colour-blind separation on the warm surface:
 * wine, teal, gold, indigo, sage. Colour follows the entity (see ENTITY_COLOURS), never its rank.
 */
export const SERIES = ["var(--chart-1)", "var(--chart-3)", "var(--chart-2)", "var(--chart-4)", "var(--chart-5)"] as const;
const OTHER = "var(--muted-foreground)";

export const ENTITY_COLOURS: Record<string, string> = {
  SHOP: SERIES[0],
  WEBSITE: SERIES[1],
  WHATSAPP: SERIES[2],
  UPI: SERIES[0],
  CASH: SERIES[1],
  CARD: SERIES[2],
  NETBANKING: SERIES[3],
};

export interface Slice {
  key: string;
  name: string;
  value: number;
  count?: number;
}

export function colourFor(key: string, index: number): string {
  return ENTITY_COLOURS[key] ?? SERIES[index] ?? OTHER;
}

/** Keeps at most `max` named slices; the rest fold into "Other" so no hue is ever generated. */
export function foldOther(rows: Slice[], max = 5): Slice[] {
  if (rows.length <= max) return rows;
  const head = rows.slice(0, max - 1);
  const rest = rows.slice(max - 1);
  return [...head, { key: "__other", name: "Other", value: rest.reduce((s, r) => s + r.value, 0), count: rest.reduce((s, r) => s + (r.count ?? 0), 0) }];
}

function TooltipBox({ title, rows }: { title?: React.ReactNode; rows: { label: React.ReactNode; value: React.ReactNode; colour?: string }[] }) {
  return (
    <div className="grid min-w-36 gap-1.5 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      {title && <div className="font-medium text-foreground">{title}</div>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            {r.colour && <span className="size-2 rounded-[2px]" style={{ background: r.colour }} />}
            {r.label}
          </span>
          <span className="font-medium text-foreground tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sales over time                                                     */
/* ------------------------------------------------------------------ */

const salesConfig = { sales: { label: "Sales", color: SERIES[0] } } satisfies ChartConfig;

export function SalesAreaChart({ data, className }: { data: { date: number; sales: number; orders: number }[]; className?: string }) {
  const dense = data.length > 45;
  return (
    <ChartContainer config={salesConfig} className={cn("aspect-auto h-64 w-full", className)}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-sales)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={dense ? 40 : 24} tickFormatter={(v: number) => formatShortDate(v)} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatINRCompact(v)} />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload;
            if (!p) return null;
            return (
              <TooltipBox
                title={formatWeekday(p.date)}
                rows={[
                  { label: "Sales", value: formatINR(p.sales), colour: SERIES[0] },
                  { label: "Orders", value: formatNumber(p.orders) },
                ]}
              />
            );
          }}
        />
        <Area dataKey="sales" type="monotone" stroke="var(--color-sales)" strokeWidth={2} fill="url(#sales-fill)" activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
      </AreaChart>
    </ChartContainer>
  );
}

export function MonthlyBarChart({ data, className }: { data: { month: string; sales: number; orders: number }[]; className?: string }) {
  return (
    <ChartContainer config={salesConfig} className={cn("aspect-auto h-64 w-full", className)}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatINRCompact(v)} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const p = active && payload?.[0]?.payload;
            if (!p) return null;
            return <TooltipBox title={p.month} rows={[{ label: "Sales", value: formatINR(p.sales), colour: SERIES[0] }, { label: "Orders", value: formatNumber(p.orders) }]} />;
          }}
        />
        <Bar dataKey="sales" fill="var(--color-sales)" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  );
}

/* ------------------------------------------------------------------ */
/* Part to whole                                                       */
/* ------------------------------------------------------------------ */

export function DonutBreakdown({ data, valueLabel = "Sales", centerLabel, format = formatINR }: { data: Slice[]; valueLabel?: string; centerLabel?: string; format?: (v: number) => string }) {
  const rows = foldOther(data);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const config = Object.fromEntries(rows.map((r, i) => [r.key, { label: r.name, color: r.key === "__other" ? OTHER : colourFor(r.key, i) }])) satisfies ChartConfig;
  if (total === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No sales in this period yet.</p>;
  return (
    <div className="@container">
    <div className="flex flex-col items-center gap-5 @md:flex-row">
      <div className="relative size-40 shrink-0">
        <ChartContainer config={config} className="aspect-square size-40">
          <PieChart>
            <ChartTooltip
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload;
                if (!p) return null;
                return <TooltipBox title={p.name} rows={[{ label: valueLabel, value: format(p.value) }, { label: "Share", value: `${Math.round((p.value / total) * 100)}%` }]} />;
              }}
            />
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
              {rows.map((r, i) => (
                <Cell key={r.key} fill={r.key === "__other" ? OTHER : colourFor(r.key, i)} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-semibold tabular">{formatINRCompact(total)}</span>
          {centerLabel && <span className="text-[11px] text-muted-foreground">{centerLabel}</span>}
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2.5 text-sm">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.key === "__other" ? OTHER : colourFor(r.key, i) }} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-xs text-muted-foreground tabular">{Math.round((r.value / total) * 100)}%</span>
            <span className="w-16 text-right font-medium tabular">{formatINRCompact(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranked lists                                                        */
/* ------------------------------------------------------------------ */

export interface BarListItem {
  key: string;
  label: React.ReactNode;
  value: number;
  display?: React.ReactNode;
  hint?: React.ReactNode;
  leading?: React.ReactNode;
  href?: string;
}

/** Horizontal bars in HTML: readable labels at any width, one hue for one measure. */
export function BarList({ items, colour = SERIES[0], empty = "Nothing to show yet." }: { items: BarListItem[]; colour?: string; empty?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.key} className="group flex items-center gap-3 rounded-md px-1.5 py-1.5 hover:bg-muted/60">
          {item.leading}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 font-medium tabular">{item.display ?? formatNumber(item.value)}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(2, (item.value / max) * 100)}%`, background: colour }} />
              </div>
              {item.hint && <span className="shrink-0 text-[11px] text-muted-foreground tabular">{item.hint}</span>}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Inventory aging                                                     */
/* ------------------------------------------------------------------ */

export interface AgingDatum {
  key: string;
  label: string;
  pieces: number;
  cost: number;
}

/**
 * Ordered buckets on one sequential hue (older = deeper). The oldest bucket is also named and
 * flagged with text, so "money stuck" never relies on colour alone.
 */
const AGING_STEPS = ["color-mix(in oklch, var(--chart-1) 30%, var(--card))", "color-mix(in oklch, var(--chart-1) 55%, var(--card))", "color-mix(in oklch, var(--chart-1) 80%, var(--card))", "var(--chart-1)"];

export function AgingBars({ data, showCost }: { data: AgingDatum[]; showCost: boolean }) {
  const metric = (d: AgingDatum) => (showCost ? d.cost : d.pieces);
  const max = Math.max(1, ...data.map(metric));
  const totalPieces = data.reduce((s, d) => s + d.pieces, 0);
  return (
    <div className="space-y-3.5">
      {data.map((d, i) => (
        <div key={d.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {d.label}
              {i === data.length - 1 && d.pieces > 0 && <span className="ml-2 text-xs font-normal text-destructive">Money stuck</span>}
            </span>
            <span className="text-muted-foreground tabular">
              <span className="font-medium text-foreground">{formatNumber(d.pieces)}</span> pcs
              {showCost && <> · <span className="font-medium text-foreground">{formatINRCompact(d.cost)}</span> at cost</>}
            </span>
          </div>
          <div className="flex h-2.5 items-center gap-2">
            <div className="h-full flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (metric(d) / max) * 100)}%`, background: AGING_STEPS[i] }} />
            </div>
            <span className="w-9 text-right text-[11px] text-muted-foreground tabular">{totalPieces ? Math.round((d.pieces / totalPieces) * 100) : 0}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-64 w-full rounded-lg", className)} />;
}
