"use client";

import Link from "next/link";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InventoryStatus } from "@/domain/types";
import { formatDate, formatINR } from "@/lib/format";
import type { InventoryRow } from "@/services/inventory";
import { ColourDot } from "@/components/shared/misc";
import { InventoryStatusBadge } from "@/components/shared/status-badge";

type Filter = "ALL" | "AVAILABLE" | "RESERVED" | "SOLD" | "OTHER";
const FILTERS: { value: Filter; label: string; match: (s: InventoryStatus) => boolean }[] = [
  { value: "ALL", label: "All", match: () => true },
  { value: "AVAILABLE", label: "Available", match: (s) => s === "AVAILABLE" },
  { value: "RESERVED", label: "Reserved", match: (s) => s === "RESERVED" },
  { value: "SOLD", label: "Sold", match: (s) => s === "SOLD" },
  { value: "OTHER", label: "Damaged / returned", match: (s) => s === "DAMAGED" || s === "RETURNED" },
];

/** Every physical piece of a design, grouped by colour. */
export function DesignPieces({ pieces }: { pieces: InventoryRow[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const match = FILTERS.find((f) => f.value === filter)!.match;
  const shown = pieces.filter((p) => match(p.item.status));
  const groups = new Map<string, InventoryRow[]>();
  for (const p of shown) {
    const key = p.colour?.id ?? "none";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const ordered = [...groups.values()].sort((a, b) => b.filter((p) => p.item.status === "AVAILABLE").length - a.filter((p) => p.item.status === "AVAILABLE").length);

  return (
    <div>
      <div className="border-b px-4 py-2.5 sm:px-5">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-auto max-w-full flex-wrap justify-start">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="gap-1.5">
                {f.label}
                <span className="text-xs text-muted-foreground tabular">{pieces.filter((p) => f.match(p.item.status)).length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No pieces in this view.</p>
      ) : (
        <div className="max-h-[32rem] overflow-y-auto">
          {ordered.map((group) => {
            const colour = group[0]!.colour;
            const available = group.filter((p) => p.item.status === "AVAILABLE").length;
            return (
              <div key={colour?.id ?? "none"}>
                <div className="sticky top-0 z-[1] flex items-center gap-2 border-b bg-muted/70 px-4 py-2 text-xs font-medium backdrop-blur sm:px-5">
                  <ColourDot hex={colour?.hex ?? "#999"} className="size-3.5" />
                  {colour?.name ?? "No colour"}
                  <span className="font-normal text-muted-foreground">
                    · {group.length} piece{group.length === 1 ? "" : "s"} · {available} available
                  </span>
                </div>
                <ul className="divide-y">
                  {group.map((p) => (
                    <li key={p.item.id}>
                      <Link href={`/inventory/${p.item.sku}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-accent/50 sm:grid-cols-[6.5rem_7.5rem_minmax(0,1fr)_7rem_5.5rem] sm:px-5">
                        <span className="font-mono text-[13px] font-medium">{p.item.sku}</span>
                        <span className="justify-self-end sm:justify-self-start"><InventoryStatusBadge status={p.item.status} /></span>
                        <span className="col-span-2 truncate text-xs text-muted-foreground sm:col-span-1">Rack <span className="font-mono">{p.item.location}</span> · received {formatDate(p.item.receivedAt)}</span>
                        <span className="text-right text-xs text-gold-foreground max-sm:hidden">{p.priceSource === "OVERRIDE" ? "Individual price" : ""}</span>
                        {p.item.status === "SOLD" ? (
                          <span className="justify-self-end text-xs text-muted-foreground">Order price</span>
                        ) : (
                          <span className="justify-self-end font-medium tabular">{formatINR(p.price)}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
