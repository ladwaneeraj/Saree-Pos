"use client";

import { AlertCircle, CheckCircle2, ChevronDown, GripVertical, ImagePlus, Lock, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { InventoryDraft } from "@/domain/types";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot } from "@/components/shared/misc";
import { CellEditor, type EditorExit } from "./cell-editor";
import { cellText, isLocked, parseClipboard, type ColDef, type ColKey, type Lookups, type RowCheck } from "./sheet";

export interface CellEntry {
  row: number;
  col: ColKey;
  text: string;
}

interface Pos {
  row: number;
  col: number;
}

export interface BulkGridProps {
  rows: InventoryDraft[];
  columns: ColDef[];
  lk: Lookups;
  checks: Map<string, RowCheck>;
  skus: Map<string, string> | null;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  onCommit: (entries: CellEntry[], label?: string) => void;
  onReorder: (movedIds: string[], beforeId: string | null) => void;
  onPhotoClick: (rowId: string) => void;
  onPhotoFiles: (rowId: string, files: File[]) => void;
}

const FIXED_LEFT = [36, 44, 56];
const FIXED_RIGHT = [92, 40];

/** Which cells to tint because the row is invalid there. */
function cellHasError(row: InventoryDraft, col: ColKey, lk: Lookups): boolean {
  const design = row.designId ? lk.designById.get(row.designId) : undefined;
  switch (col) {
    case "design": return !design && !row.designName.trim();
    case "colour": return !row.colourId;
    case "fabric": return !design && !!row.designName.trim() && !row.fabricId;
    case "cost": return row.cost == null;
    case "quantity": return !(row.quantity >= 1);
    case "mrp": return row.mrp == null || row.mrp <= 0;
    case "price": return row.price == null || row.price <= 0 || (row.mrp != null && row.price > row.mrp);
    default: return false;
  }
}

/** Callbacks with a stable identity that always call the latest version, so memoised rows never go stale. */
function useStableHandlers<T extends Record<string, (...args: never[]) => unknown>>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const [stable] = useState(() => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(handlers)) out[key] = (...args: never[]) => latest.current[key]!(...args);
    return out as T;
  });
  return stable;
}

export function BulkGrid(props: BulkGridProps) {
  const { rows, columns, lk, checks, skus, selected, onSelectedChange, onCommit, onReorder, onPhotoClick, onPhotoFiles } = props;
  const [active, setActive] = useState<Pos | null>(rows.length ? { row: 0, col: 0 } : null);
  const [editing, setEditing] = useState<{ seed: string | null } | null>(null);
  const [copied, setCopied] = useState<Pos | null>(null);
  const [dragIds, setDragIds] = useState<string[] | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const lastClicked = useRef<number | null>(null);

  const clamp = useCallback(
    (p: Pos): Pos => ({ row: Math.max(0, Math.min(rows.length - 1, p.row)), col: Math.max(0, Math.min(columns.length - 1, p.col)) }),
    [rows.length, columns.length],
  );
  const pos = active && rows.length ? clamp(active) : null;

  // Keep the active cell visible.
  useEffect(() => {
    if (!pos) return;
    const el = container.current?.querySelector<HTMLElement>(`[data-cell="${pos.row}:${pos.col}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pos?.row, pos?.col]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusGrid = () => container.current?.focus({ preventScroll: true });

  const move = (dr: number, dc: number, wrap = false) => {
    if (!pos) return setActive({ row: 0, col: 0 });
    let { row, col } = pos;
    col += dc;
    row += dr;
    if (wrap && col >= columns.length) {
      col = 0;
      row += 1;
    } else if (wrap && col < 0) {
      col = columns.length - 1;
      row -= 1;
    }
    setActive(clamp({ row, col }));
  };

  const startEdit = (seed: string | null) => {
    if (!pos) return;
    const row = rows[pos.row]!;
    const col = columns[pos.col]!;
    if (isLocked(row, col.key)) {
      toast.info(`${col.label} comes from the design ${cellText(row, "design", lk)}. Change the design to edit it.`);
      return;
    }
    setCopied(null);
    setEditing({ seed });
  };

  const finishEdit = (value: string | null, exit: EditorExit) => {
    const at = pos;
    setEditing(null);
    if (at && value !== null) onCommit([{ row: at.row, col: columns[at.col]!.key, text: value }]);
    if (exit === "down") move(1, 0);
    else if (exit === "up") move(-1, 0);
    else if (exit === "right") move(0, 1, true);
    else if (exit === "left") move(0, -1, true);
    if (exit !== "stay") requestAnimationFrame(focusGrid);
  };

  /** Rows the action applies to: the checked rows when the active row is among them, else just the active row. */
  const targetRows = (): number[] => {
    if (!pos) return [];
    const activeId = rows[pos.row]!.id;
    if (selected.size > 1 && selected.has(activeId)) return rows.flatMap((r, i) => (selected.has(r.id) ? [i] : []));
    return [pos.row];
  };

  const fillDown = (colIndex: number, fromRow: number) => {
    const col = columns[colIndex]!;
    const source = rows[fromRow];
    if (!source) return;
    const text = cellText(source, col.key, lk);
    const selectedBelow = rows.flatMap((r, i) => (i > fromRow && selected.has(r.id) ? [i] : []));
    const targets = selectedBelow.length ? selectedBelow : rows.map((_, i) => i).filter((i) => i > fromRow);
    if (targets.length === 0) return toast.info("Nothing below to fill");
    onCommit(targets.map((row) => ({ row, col: col.key, text })), `Filled ${targets.length} row${targets.length === 1 ? "" : "s"} with ${col.label.toLowerCase()} ${text ? `"${text}"` : "(empty)"}`);
  };

  const fillBlanks = (colIndex: number) => {
    const col = columns[colIndex]!;
    let last = "";
    const entries: CellEntry[] = [];
    rows.forEach((r, i) => {
      const t = cellText(r, col.key, lk);
      if (t) last = t;
      else if (last) entries.push({ row: i, col: col.key, text: last });
    });
    if (entries.length === 0) return toast.info(`No empty ${col.label.toLowerCase()} cells below a filled one`);
    onCommit(entries, `Filled ${entries.length} empty ${col.label.toLowerCase()} cell${entries.length === 1 ? "" : "s"}`);
  };

  const clearCells = (colIndex: number, rowIndexes: number[]) => {
    const col = columns[colIndex]!;
    onCommit(rowIndexes.map((row) => ({ row, col: col.key, text: "" })));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing || e.target !== container.current) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      if (pos) fillDown(pos.col, pos.row);
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      onSelectedChange(new Set(rows.map((r) => r.id)));
      return;
    }
    if (mod) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); return move(1, 0);
      case "ArrowUp": e.preventDefault(); return move(-1, 0);
      case "ArrowRight": e.preventDefault(); return move(0, 1);
      case "ArrowLeft": e.preventDefault(); return move(0, -1);
      case "Tab": e.preventDefault(); return move(0, e.shiftKey ? -1 : 1, true);
      case "Home": e.preventDefault(); return pos && setActive({ row: pos.row, col: 0 });
      case "End": e.preventDefault(); return pos && setActive({ row: pos.row, col: columns.length - 1 });
      case "Enter":
      case "F2": e.preventDefault(); return startEdit(null);
      case "Escape": setCopied(null); if (selected.size) onSelectedChange(new Set()); return;
      case "Delete":
      case "Backspace": e.preventDefault(); if (pos) clearCells(pos.col, targetRows().filter((i) => !isLocked(rows[i]!, columns[pos.col]!.key))); return;
      case " ":
        if (e.shiftKey && pos) {
          e.preventDefault();
          const id = rows[pos.row]!.id;
          const next = new Set(selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          onSelectedChange(next);
          return;
        }
    }
    if (e.key.length === 1 && !e.altKey) {
      e.preventDefault();
      startEdit(e.key);
    }
  };

  const onCopy = (e: React.ClipboardEvent) => {
    if (editing || !pos) return;
    const col = columns[pos.col]!;
    const text = targetRows().map((i) => cellText(rows[i]!, col.key, lk)).join("\n");
    e.clipboardData.setData("text/plain", text);
    e.preventDefault();
    setCopied(pos);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing || !pos) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const grid = parseClipboard(text);
    const entries: CellEntry[] = [];
    if (grid.length === 1 && grid[0]!.length === 1) {
      for (const row of targetRows()) entries.push({ row, col: columns[pos.col]!.key, text: grid[0]![0]! });
    } else {
      grid.forEach((cells, r) =>
        cells.forEach((value, c) => {
          const col = columns[pos.col + c];
          if (col) entries.push({ row: pos.row + r, col: col.key, text: value });
        }),
      );
    }
    const width = Math.min(grid[0]?.length ?? 0, columns.length - pos.col);
    onCommit(entries, entries.length > 1 ? `Pasted ${grid.length} row${grid.length === 1 ? "" : "s"} × ${width} column${width === 1 ? "" : "s"}` : undefined);
    setCopied(null);
  };

  const onCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const already = pos && pos.row === row && pos.col === col && !editing;
    setActive({ row, col });
    if (!editing) {
      e.preventDefault();
      focusGrid();
    }
    if (already) {
      setActive({ row, col });
      requestAnimationFrame(() => startEditAt(row, col));
    }
  };
  const startEditAt = (row: number, col: number) => {
    const r = rows[row];
    const c = columns[col];
    if (!r || !c) return;
    if (isLocked(r, c.key)) {
      toast.info(`${c.label} comes from the design ${cellText(r, "design", lk)}. Change the design to edit it.`);
      return;
    }
    setEditing({ seed: null });
  };

  const toggleRow = (index: number, shift: boolean) => {
    const id = rows[index]!.id;
    const next = new Set(selected);
    if (shift && lastClicked.current !== null) {
      const [a, b] = [Math.min(lastClicked.current, index), Math.max(lastClicked.current, index)];
      const turnOn = !selected.has(id);
      for (let i = a; i <= b; i++) {
        if (turnOn) next.add(rows[i]!.id);
        else next.delete(rows[i]!.id);
      }
    } else if (next.has(id)) next.delete(id);
    else next.add(id);
    lastClicked.current = index;
    onSelectedChange(next);
  };

  const rowHandlers = useStableHandlers({
    onCellMouseDown,
    onCellDoubleClick: (r: number, c: number) => {
      setActive({ row: r, col: c });
      startEditAt(r, c);
    },
    onToggle: toggleRow,
    onPhotoClick,
    onPhotoFiles,
    onDragStartRow: (id: string, e: React.DragEvent) => {
      const ids = selected.has(id) ? rows.filter((r) => selected.has(r.id)).map((r) => r.id) : [id];
      // Re-rendering during dragstart makes Chrome cancel the drag, so mark rows on the next tick.
      window.setTimeout(() => setDragIds(ids), 0);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/x-draft-rows", ids.join(","));
    },
    onDragOverRow: (id: string, after: boolean) => {
      if (dragIds) setDropTarget((t) => (t?.id === id && t.after === after ? t : { id, after }));
    },
    onDropRow: () => {
      if (dragIds && dropTarget) {
        const idx = rows.findIndex((r) => r.id === dropTarget.id);
        const beforeId = dropTarget.after ? (rows[idx + 1]?.id ?? null) : dropTarget.id;
        if (!dragIds.includes(beforeId ?? "")) onReorder(dragIds, beforeId);
      }
      setDragIds(null);
      setDropTarget(null);
    },
    onDragEndRow: () => {
      setDragIds(null);
      setDropTarget(null);
    },
  });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  const totalWidth = FIXED_LEFT.reduce((a, b) => a + b, 0) + columns.reduce((a, c) => a + c.width, 0) + FIXED_RIGHT.reduce((a, b) => a + b, 0);

  return (
    <div
      ref={container}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onCopy={onCopy}
      onPaste={onPaste}
      role="grid"
      aria-label="Bulk entry sheet"
      aria-rowcount={rows.length}
      className="relative max-h-[calc(100dvh-17rem)] min-h-72 overflow-auto rounded-xl border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <table className="table-fixed border-separate border-spacing-0 text-[13px]" style={{ width: totalWidth, minWidth: "100%" }}>
        <colgroup>
          {FIXED_LEFT.map((w, i) => <col key={`l${i}`} style={{ width: w }} />)}
          {columns.map((c) => <col key={c.key} style={{ width: c.width }} />)}
          {FIXED_RIGHT.map((w, i) => <col key={`r${i}`} style={{ width: w }} />)}
        </colgroup>
        <thead className="sticky top-0 z-20">
          <tr className="bg-muted text-left text-xs text-muted-foreground">
            <th className="border-b px-2.5 py-2">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={() => onSelectedChange(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                aria-label="Select all rows"
              />
            </th>
            <th className="border-b px-1 py-2 text-center font-medium">#</th>
            <th className="border-b px-2 py-2 font-medium">Photo</th>
            {columns.map((c, ci) => (
              <th key={c.key} className={cn("border-b border-l px-2 py-1.5 font-medium", c.align === "right" && "text-right")}>
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn("group inline-flex w-full items-center gap-1 rounded px-0.5 hover:text-foreground", c.align === "right" && "justify-end")}>
                    {c.label}
                    <ChevronDown className="size-3 opacity-40 group-hover:opacity-100" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60">
                    <DropdownMenuLabel>{c.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => fillDown(ci, pos && pos.col === ci ? pos.row : 0)}>
                      Fill down from row {(pos && pos.col === ci ? pos.row : 0) + 1}
                      <span className="ml-auto text-xs text-muted-foreground">Ctrl D</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => fillBlanks(ci)}>Fill empty cells from above</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => clearCells(ci, rows.flatMap((r, i) => ((selected.size ? selected.has(r.id) : true) && !isLocked(r, c.key) ? [i] : [])))}
                    >
                      Clear {selected.size ? `${selected.size} selected` : "whole column"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
            ))}
            <th className="border-b border-l px-2 py-2 font-medium">SKU</th>
            <th className="border-b px-1 py-2" aria-label="Row status" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <Row
              key={row.id}
              row={row}
              index={i}
              columns={columns}
              lk={lk}
              check={checks.get(row.id)}
              sku={skus?.get(row.id) ?? null}
              selected={selected.has(row.id)}
              activeCol={pos?.row === i ? pos.col : -1}
              copiedCol={copied?.row === i ? copied.col : -1}
              editor={
                pos?.row === i && editing
                  ? {
                      seed: editing.seed,
                      render: (anchor) => {
                        const col = columns[pos.col]!;
                        const current = cellText(row, col.key, lk);
                        return <CellEditor key={`${row.id}:${col.key}`} col={col} lk={lk} initial={editing.seed ?? current} seeded={editing.seed !== null} anchor={anchor} onDone={finishEdit} />;
                      },
                    }
                  : null
              }
              dragging={!!dragIds?.includes(row.id)}
              dropEdge={dropTarget?.id === row.id ? (dropTarget.after ? "after" : "before") : null}
              {...rowHandlers}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface RowProps {
  row: InventoryDraft;
  index: number;
  columns: ColDef[];
  lk: Lookups;
  check: RowCheck | undefined;
  sku: string | null;
  selected: boolean;
  activeCol: number;
  copiedCol: number;
  editor: { seed: string | null; render: (anchor: HTMLElement | null) => React.ReactNode } | null;
  dragging: boolean;
  dropEdge: "before" | "after" | null;
  onCellMouseDown: (row: number, col: number, e: React.MouseEvent) => void;
  onCellDoubleClick: (row: number, col: number) => void;
  onToggle: (index: number, shift: boolean) => void;
  onPhotoClick: (rowId: string) => void;
  onPhotoFiles: (rowId: string, files: File[]) => void;
  onDragStartRow: (id: string, e: React.DragEvent) => void;
  onDragOverRow: (id: string, after: boolean) => void;
  onDropRow: () => void;
  onDragEndRow: () => void;
}

const Row = memo(
  function Row(p: RowProps) {
    const { row, index, columns, lk, check } = p;
    const [photoOver, setPhotoOver] = useState(false);
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const status = !check ? "pending" : check.errors.length ? "error" : check.warnings.length ? "warning" : "ok";
    const design = row.designId ? lk.designById.get(row.designId) : undefined;
    const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

    return (
      <tr
        className={cn(
          "group/row",
          p.selected ? "bg-wine-50/70" : "bg-card hover:bg-muted/30",
          p.dragging && "opacity-40",
          p.dropEdge === "before" && "[&>td]:shadow-[inset_0_2px_0_var(--primary)]",
          p.dropEdge === "after" && "[&>td]:shadow-[inset_0_-2px_0_var(--primary)]",
        )}
        onDragOver={(e) => {
          if (isFileDrag(e)) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          p.onDragOverRow(row.id, e.clientY > rect.top + rect.height / 2);
        }}
        onDrop={(e) => {
          if (isFileDrag(e)) return;
          e.preventDefault();
          p.onDropRow();
        }}
      >
        <td className="border-b px-2.5 py-1.5 align-middle">
          <Checkbox
            checked={p.selected}
            onClick={(e) => {
              e.preventDefault();
              p.onToggle(index, e.shiftKey);
            }}
            aria-label={`Select row ${index + 1}`}
          />
        </td>
        <td className="border-b px-0 py-1.5 align-middle">
          <div
            draggable
            onDragStart={(e) => p.onDragStartRow(row.id, e)}
            onDragEnd={p.onDragEndRow}
            className="flex cursor-grab items-center justify-center gap-0.5 text-xs text-muted-foreground tabular active:cursor-grabbing"
            title="Drag to reorder"
          >
            <GripVertical className="size-3.5 opacity-30 group-hover/row:opacity-100" />
            <span className="w-5 text-left">{index + 1}</span>
          </div>
        </td>
        <td
          className={cn("border-b px-2 py-1 align-middle", photoOver && "bg-wine-50")}
          onDragOver={(e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            setPhotoOver(true);
          }}
          onDragLeave={() => setPhotoOver(false)}
          onDrop={(e) => {
            if (!isFileDrag(e)) return;
            e.preventDefault();
            e.stopPropagation();
            setPhotoOver(false);
            p.onPhotoFiles(row.id, [...e.dataTransfer.files]);
          }}
        >
          <button type="button" onClick={() => p.onPhotoClick(row.id)} className={cn("relative block w-10 rounded-md ring-offset-1 hover:ring-2 hover:ring-primary/40", photoOver && "ring-2 ring-primary")} aria-label={`Photos for row ${index + 1}`}>
            {row.imageIds.length ? (
              <MediaImage id={row.imageIds[0]} alt={`Row ${index + 1}`} thumb rounded="rounded-md" />
            ) : (
              <span className="flex aspect-[4/5] items-center justify-center rounded-md border border-dashed bg-muted/50 text-muted-foreground">
                <ImagePlus className="size-3.5" />
              </span>
            )}
            {row.imageIds.length > 1 && (
              <span className="absolute -right-1.5 -bottom-1 rounded-full bg-foreground px-1 text-[10px] font-medium text-background tabular">{row.imageIds.length}</span>
            )}
          </button>
        </td>
        {columns.map((c, ci) => {
          const active = ci === p.activeCol;
          const locked = isLocked(row, c.key);
          const error = cellHasError(row, c.key, lk);
          const editing = active && p.editor;
          return (
            <td
              key={c.key}
              ref={active ? setAnchor : undefined}
              data-cell={`${index}:${ci}`}
              onMouseDown={(e) => p.onCellMouseDown(index, ci, e)}
              onDoubleClick={() => p.onCellDoubleClick(index, ci)}
              className={cn(
                "relative h-12 cursor-cell border-b border-l px-2 align-middle select-none",
                c.align === "right" && "text-right tabular",
                locked && "bg-muted/40 text-muted-foreground",
                error && !locked && "bg-danger-soft/70",
                active && !editing && "z-[1] shadow-[inset_0_0_0_2px_var(--primary)]",
                ci === p.copiedCol && "outline-2 -outline-offset-4 outline-primary/60 outline-dashed",
              )}
            >
              {editing ? p.editor!.render(anchor) : <CellView row={row} col={c.key} lk={lk} locked={locked} newDesign={c.key === "design" && !design && !!row.designName} />}
            </td>
          );
        })}
        <td className="border-b border-l px-2 align-middle font-mono text-xs">
          {p.sku ? <span className="font-medium text-foreground">{p.sku}</span> : <span className="text-muted-foreground/60">{status === "error" ? "Needs data" : "Auto"}</span>}
        </td>
        <td className="border-b px-1 text-center align-middle">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex size-6 items-center justify-center" aria-label={status === "ok" ? "Ready" : "Issues"}>
                {status === "ok" && <CheckCircle2 className="size-4 text-success" />}
                {status === "warning" && <TriangleAlert className="size-4 text-warning" />}
                {status === "error" && <AlertCircle className="size-4 text-destructive" />}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-64">
              {status === "ok" && "Ready to save"}
              {check && check.errors.length + check.warnings.length > 0 && (
                <ul className="space-y-0.5">
                  {check.errors.map((m) => <li key={m}>• {m}</li>)}
                  {check.warnings.map((m) => <li key={m} className="opacity-80">• {m} (warning)</li>)}
                </ul>
              )}
            </TooltipContent>
          </Tooltip>
        </td>
      </tr>
    );
  },
  (a, b) =>
    a.row === b.row &&
    a.index === b.index &&
    a.columns === b.columns &&
    a.lk === b.lk &&
    a.check === b.check &&
    a.sku === b.sku &&
    a.selected === b.selected &&
    a.activeCol === b.activeCol &&
    a.copiedCol === b.copiedCol &&
    a.editor === b.editor &&
    a.dragging === b.dragging &&
    a.dropEdge === b.dropEdge &&
    !a.editor &&
    !b.editor,
);

function CellView({ row, col, lk, locked, newDesign }: { row: InventoryDraft; col: ColKey; lk: Lookups; locked: boolean; newDesign: boolean }) {
  const text = cellText(row, col, lk);
  if (col === "colour" && row.colourId) {
    const colour = lk.colourById.get(row.colourId);
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <ColourDot hex={colour?.hex ?? "#999"} className="size-3.5" />
        <span className="truncate">{text}</span>
        {row.colourAutoDetected && (
          <span title="Detected from photo">
            <Wand2 className="size-3 shrink-0 text-gold" />
          </span>
        )}
      </span>
    );
  }
  if ((col === "cost" || col === "mrp" || col === "price") && text) return <span>{formatINR(Number(text))}</span>;
  if (col === "location" && text) return <span className="font-mono text-xs">{text}</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{text}</span>
      {locked && text && <Lock className="size-3 shrink-0 opacity-50" />}
      {newDesign && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[oklch(0.96_0.04_85)] px-1.5 text-[10px] font-medium text-gold-foreground">
          <Sparkles className="size-2.5" /> New
        </span>
      )}
    </span>
  );
}
