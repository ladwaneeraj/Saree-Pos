"use client";

import { Trash2 } from "lucide-react";
import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImportColumn, ImportIssue, ImportRow } from "@/services/purchases";
import { cn } from "@/lib/utils";

export const GRID_COLUMNS: { key: ImportColumn; label: string; width: string; numeric?: boolean; mono?: boolean }[] = [
  { key: "sku", label: "SKU", width: "w-28", mono: true },
  { key: "design", label: "Design", width: "min-w-52" },
  { key: "colour", label: "Colour", width: "w-28" },
  { key: "fabric", label: "Fabric", width: "w-32" },
  { key: "collection", label: "Collection", width: "w-28" },
  { key: "quantity", label: "Qty", width: "w-16", numeric: true },
  { key: "cost", label: "Cost", width: "w-24", numeric: true },
  { key: "mrp", label: "MRP", width: "w-24", numeric: true },
  { key: "price", label: "Selling", width: "w-24", numeric: true },
  { key: "rack", label: "Rack", width: "w-20", mono: true },
];

export function ImportGrid({ rows, issues, onChange, onDelete }: { rows: ImportRow[]; issues: Map<string, ImportIssue[]>; onChange: (id: string, column: ImportColumn, value: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="w-10 px-3 py-2.5 font-medium">#</th>
            {GRID_COLUMNS.map((c) => (
              <th key={c.key} className={cn("px-1.5 py-2.5 font-medium", c.numeric && "text-right")}>{c.label}</th>
            ))}
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <GridRow key={row._id} row={row} index={i} issues={issues.get(row._id)} onChange={onChange} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GridRow = memo(function GridRow({ row, index, issues, onChange, onDelete }: { row: ImportRow; index: number; issues: ImportIssue[] | undefined; onChange: (id: string, column: ImportColumn, value: string) => void; onDelete: (id: string) => void }) {
  const byColumn = new Map<ImportColumn, string[]>();
  issues?.forEach((i) => byColumn.set(i.column, [...(byColumn.get(i.column) ?? []), i.message]));
  const ok = issues !== undefined && issues.length === 0;
  return (
    <tr className={cn("border-b last:border-0", issues?.length && "bg-danger-soft/30")}>
      <td className="px-3 py-1.5 text-xs text-muted-foreground tabular">{index + 1}</td>
      {GRID_COLUMNS.map((c) => {
        const messages = byColumn.get(c.key);
        const input = (
          <input
            value={row[c.key]}
            aria-label={`${c.label}, row ${index + 1}`}
            aria-invalid={!!messages}
            inputMode={c.numeric ? "numeric" : undefined}
            onChange={(e) => onChange(row._id, c.key, c.key === "sku" || c.key === "rack" ? e.target.value.toUpperCase() : e.target.value)}
            className={cn(
              "h-8 w-full rounded-md border border-transparent bg-transparent px-2 outline-none hover:border-border focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/30",
              c.width,
              c.numeric && "text-right tabular",
              c.mono && "font-mono text-xs",
              messages && "border-destructive/60 bg-card hover:border-destructive",
            )}
          />
        );
        return (
          <td key={c.key} className="px-1.5 py-1">
            {messages ? (
              <Tooltip>
                <TooltipTrigger asChild>{input}</TooltipTrigger>
                <TooltipContent>{messages.join(" · ")}</TooltipContent>
              </Tooltip>
            ) : (
              input
            )}
          </td>
        );
      })}
      <td className="max-w-64 px-3 py-1.5 text-xs">
        {issues === undefined ? <span className="text-muted-foreground">Checking…</span> : ok ? <span className="font-medium text-success">Ready</span> : <span className="line-clamp-2 text-destructive">{issues.map((i) => i.message).join(" · ")}</span>}
      </td>
      <td className="px-1.5 py-1">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete row ${index + 1}`} onClick={() => onDelete(row._id)}>
          <Trash2 />
        </Button>
      </td>
    </tr>
  );
});
