"use client";

import { AlertTriangle, Flame, Hourglass } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot } from "@/components/shared/misc";
import { Pill } from "@/components/shared/status-badge";
import { Panel } from "@/components/reports/panel";
import type { DashboardData } from "@/services/reports";
import { formatINRCompact, formatNumber, pluralize } from "@/lib/format";

function Row({ imageId, name, sub, right, href }: { imageId: string | null; name: string; sub: React.ReactNode; right: React.ReactNode; href: string }) {
  return (
    <li>
      <Link href={href} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
        <MediaImage id={imageId} alt={name} thumb className="w-9 shrink-0" rounded="rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{sub}</div>
        </div>
        <div className="shrink-0 text-right">{right}</div>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-11 w-9" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

const designHref = (id: string) => `/designs/view?id=${id}`;

export function LowStockPanel({ rows, threshold }: { rows: DashboardData["lowStock"] | undefined; threshold: number }) {
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> Low stock</span>} description="Selling colours with the fewest pieces left" bodyClassName="pt-2">
      {!rows ? <ListSkeleton /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Every published design is well stocked.</p> : (
        <ul>
          {rows.map((m) => (
            <Row
              key={`${m.design.id}-${m.colourName}`}
              href={designHref(m.design.id)}
              imageId={m.imageId}
              name={m.design.name}
              sub={<span className="inline-flex items-center gap-1.5"><ColourDot hex={m.colourHex} className="size-2.5" />{m.colourName} · {formatNumber(m.units)} sold in 30 days</span>}
              right={m.available === 0 ? <Pill tone="danger">Sold out</Pill> : <Pill tone={m.available <= threshold ? "warning" : "neutral"}>{m.available} left</Pill>}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function FastMovingPanel({ rows }: { rows: DashboardData["fastMoving"] | undefined }) {
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><Flame className="size-4 text-primary" /> Fast moving</span>} description="Most pieces sold in the last 30 days" bodyClassName="pt-2">
      {!rows ? <ListSkeleton /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No sales in the last 30 days.</p> : (
        <ul>
          {rows.map((m) => (
            <Row
              key={m.design.id}
              href={designHref(m.design.id)}
              imageId={m.imageId}
              name={m.design.name}
              sub={`${formatNumber(m.available)} in stock · ${formatINRCompact(m.revenue)} revenue`}
              right={<div className="text-sm font-semibold tabular">{formatNumber(m.units)} <span className="text-xs font-normal text-muted-foreground">sold</span></div>}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function OldStockPanel({ rows, canSeeCost }: { rows: DashboardData["oldStock"] | undefined; canSeeCost: boolean }) {
  const stuck = rows?.reduce((s, r) => s + r.cost, 0) ?? 0;
  return (
    <Panel
      title={<span className="inline-flex items-center gap-2"><Hourglass className="size-4 text-destructive" /> Old stock</span>}
      description={canSeeCost && rows?.length ? `180+ days on the shelf · ${formatINRCompact(stuck)} stuck at cost` : "Pieces on the shelf for over 180 days"}
      action={<Link href="/reports?tab=inventory" className="text-xs font-medium text-primary hover:underline">Full report</Link>}
      bodyClassName="pt-2"
    >
      {!rows ? <ListSkeleton /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">Nothing older than 180 days. Great rotation.</p> : (
        <ul>
          {rows.map((r) => (
            <Row
              key={r.design.id}
              href={designHref(r.design.id)}
              imageId={r.imageId}
              name={r.design.name}
              sub={`${pluralize(r.pieces, "piece")} · oldest ${r.oldestDays} days`}
              right={canSeeCost ? <div className="text-sm font-semibold text-destructive tabular">{formatINRCompact(r.cost)}</div> : <span className="text-xs text-muted-foreground">{r.oldestDays}d</span>}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
