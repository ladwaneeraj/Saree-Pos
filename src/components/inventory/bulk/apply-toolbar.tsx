"use client";

import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ColourDot } from "@/components/shared/misc";
import type { ColDef, ColKey, Lookups } from "./sheet";

interface Props {
  count: number;
  columns: ColDef[];
  lk: Lookups;
  onApply: (col: ColKey, text: string) => void;
  onAdjust: (col: ColKey, percent: number) => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Floating bar shown when rows are checked: set any column for all of them at once. */
export function ApplyToolbar({ count, columns, lk, onApply, onAdjust, onDelete, onClear }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card p-1.5 pl-3 shadow-md">
      <span className="mr-1 text-sm font-medium tabular">{count} selected</span>
      <span className="mr-1 hidden text-xs text-muted-foreground sm:inline">Apply to selected:</span>
      {columns.map((c) => (
        <FieldPopover key={c.key} col={c} lk={lk} count={count} onApply={onApply} onAdjust={onAdjust} />
      ))}
      <div className="ml-auto flex gap-1">
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 /> Delete
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
          <X />
        </Button>
      </div>
    </div>
  );
}

function FieldPopover({ col, lk, count, onApply, onAdjust }: { col: ColDef; lk: Lookups; count: number; onApply: Props["onApply"]; onAdjust: Props["onAdjust"] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"set" | "adjust">("set");
  const close = () => {
    setOpen(false);
    setSearch("");
    setValue("");
  };
  const label = col.key === "price" ? "Selling price" : col.label;

  const options: { key: string; label: string; sub?: string; hex?: string }[] =
    col.key === "design"
      ? lk.designs.map((d) => ({ key: d.id, label: d.name, sub: d.code }))
      : col.key === "colour"
        ? lk.colours.map((c) => ({ key: c.id, label: c.name, hex: c.hex }))
        : col.key === "fabric"
          ? lk.fabrics.map((f) => ({ key: f.id, label: f.name }))
          : col.key === "collection"
            ? lk.collections.map((c) => ({ key: c.id, label: c.name }))
            : [];
  const exact = options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase());

  const submitNumber = () => {
    if (mode === "adjust") {
      const pct = Number(value);
      if (!Number.isFinite(pct) || pct === 0) return;
      onAdjust(col.key, pct);
    } else onApply(col.key, value);
    close();
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
          {label} <ChevronDown className="size-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={col.kind === "combo" ? "w-72 p-0" : "w-72"}>
        {col.kind === "combo" ? (
          <Command>
            <CommandInput placeholder={`Set ${label.toLowerCase()} for ${count} rows…`} value={search} onValueChange={setSearch} />
            <CommandList className="max-h-72">
              <CommandEmpty>Nothing found.</CommandEmpty>
              {search.trim() && !exact && (col.key === "design" || col.key === "colour") && (
                <CommandGroup>
                  <CommandItem value={`__new ${search}`} onSelect={() => { onApply(col.key, search.trim()); close(); }}>
                    <Plus className="text-primary" /> {col.key === "design" ? "New design" : "Add colour"} &ldquo;{search.trim()}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.key} value={`${o.label} ${o.sub ?? ""}`} onSelect={() => { onApply(col.key, o.label); close(); }}>
                    {o.hex && <ColourDot hex={o.hex} className="size-3.5" />}
                    <span className="truncate">{o.label}</span>
                    {o.sub && <span className="ml-auto text-xs text-muted-foreground">{o.sub}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitNumber();
            }}
          >
            {col.kind === "number" && (
              <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v) => v && setMode(v as "set" | "adjust")} className="w-full">
                <ToggleGroupItem value="set" className="flex-1">Set value</ToggleGroupItem>
                <ToggleGroupItem value="adjust" className="flex-1">Change by %</ToggleGroupItem>
              </ToggleGroup>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`apply-${col.key}`}>
                {mode === "adjust" && col.kind === "number" ? "Percent (use minus to reduce)" : col.kind === "number" ? `${label} (₹)` : "Rack / location"}
              </Label>
              <Input
                id={`apply-${col.key}`}
                autoFocus
                value={value}
                inputMode={col.kind === "number" ? (mode === "adjust" ? "decimal" : "numeric") : undefined}
                placeholder={col.kind === "number" ? (mode === "adjust" ? "10 or -5" : "4999") : "B-14"}
                onChange={(e) =>
                  setValue(col.kind === "number" ? (mode === "adjust" ? e.target.value.replace(/[^\d.-]/g, "") : e.target.value.replace(/\D/g, "")) : e.target.value.toUpperCase())
                }
              />
              {mode === "adjust" && col.kind === "number" && <p className="text-xs text-muted-foreground">Rounded to the nearest rupee. Empty cells stay empty.</p>}
            </div>
            <Button type="submit" size="sm" className="w-full" disabled={!value.trim()}>
              Apply to {count} row{count === 1 ? "" : "s"}
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
