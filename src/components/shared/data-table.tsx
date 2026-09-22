"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Enables header sorting with this key. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
  align?: "left" | "right" | "center";
  /** Hidden when the user toggles it off in column settings. */
  hidden?: boolean;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Card rendering for small screens. Falls back to the table when omitted. */
  mobileCard?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  loadingRows?: number;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  selectable,
  selected,
  onSelectedChange,
  mobileCard,
  empty,
  loadingRows = 8,
  className,
}: DataTableProps<T>) {
  const visible = columns.filter((c) => !c.hidden);
  const pageKeys = rows?.map(rowKey) ?? [];
  const allSelected = pageKeys.length > 0 && pageKeys.every((k) => selected?.has(k));
  const someSelected = pageKeys.some((k) => selected?.has(k));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) pageKeys.forEach((k) => next.delete(k));
    else pageKeys.forEach((k) => next.add(k));
    onSelectedChange?.(next);
  };
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedChange?.(next);
  };
  const clickSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange(sort?.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  };

  if (rows && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={className}>
      {mobileCard && (
        <div className="space-y-2 md:hidden">
          {rows
            ? rows.map((row) => (
                <div
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn("rounded-xl border bg-card p-3", onRowClick && "cursor-pointer active:bg-accent")}
                >
                  {mobileCard(row)}
                </div>
              ))
            : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      )}
      <div className={cn("overflow-x-auto rounded-xl border bg-card", mobileCard && "hidden md:block")}>
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={toggleAll} aria-label="Select all on page" />
                </th>
              )}
              {visible.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-3 py-2.5 font-medium whitespace-nowrap",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.headerClassName,
                  )}
                >
                  {c.sortKey && onSortChange ? (
                    <button type="button" onClick={() => clickSort(c.sortKey!)} className={cn("inline-flex items-center gap-1 hover:text-foreground", c.align === "right" && "flex-row-reverse")}>
                      {c.header}
                      {sort?.key === c.sortKey ? sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              ? rows.map((row) => {
                  const key = rowKey(row);
                  const isSelected = selected?.has(key);
                  return (
                    <tr
                      key={key}
                      onClick={() => onRowClick?.(row)}
                      className={cn("border-b last:border-0 transition-colors", onRowClick && "cursor-pointer hover:bg-accent/60", isSelected && "bg-wine-50/60")}
                    >
                      {selectable && (
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={!!isSelected} onCheckedChange={() => toggle(key)} aria-label="Select row" />
                        </td>
                      )}
                      {visible.map((c) => (
                        <td key={c.key} className={cn("px-3 py-2 align-middle", c.align === "right" && "text-right tabular", c.align === "center" && "text-center", c.className)}>
                          {c.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              : Array.from({ length: loadingRows }, (_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {selectable && <td className="px-3 py-3"><Skeleton className="size-4" /></td>}
                    {visible.map((c) => (
                      <td key={c.key} className="px-3 py-3">
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 pt-3 text-sm text-muted-foreground">
      <span className="tabular">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
