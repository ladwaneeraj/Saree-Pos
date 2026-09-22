"use client";

import { Barcode as BarcodeIcon, PackageSearch, ScanLine, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { searchPosCatalog, type PosCatalogEntry } from "@/services/pos";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { PiecePickerDialog } from "./piece-picker-dialog";
import { ScanDialog } from "./scan-dialog";
import { useBarcodeScanner } from "./use-barcode-scanner";
import { usePosActions } from "./use-pos-actions";

const ANY = "__any";
const SKU_PATTERN = /^[A-Z]{2,6}-?\d{3,}$/i;

export function CatalogPanel({ className }: { className?: string }) {
  const catalog = useCatalog();
  const { addBySku, addItem, pending } = usePosActions();
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useDeferredValue(q);

  const { data } = useLive(() => searchPosCatalog({ q: query, categoryId, fabricId, limit: 80 }), [query, categoryId, fabricId]);
  const picker = data?.entries.find((e) => e.design.id === pickerId) ?? null;

  const scanned = async (code: string) => {
    const item = await addBySku(code);
    if (item) {
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
    }
    return item;
  };

  useBarcodeScanner((code) => void scanned(code));

  useEffect(() => {
    // Autofocus on desktop only; on phones it would pop the keyboard over the catalogue.
    if (window.matchMedia("(min-width: 1024px)").matches) inputRef.current?.focus();
  }, []);

  const onEnter = async () => {
    const value = q.trim();
    if (!value) return;
    if (data?.skuMatch || SKU_PATTERN.test(value)) {
      const item = await scanned(value);
      if (item) setQ("");
      return;
    }
    const sellable = data?.entries.filter((e) => e.available > 0) ?? [];
    if (sellable.length === 1) setPickerId(sellable[0]!.design.id);
  };

  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      <div className="space-y-3 border-b bg-background px-4 pt-4 pb-3 sm:px-5">
        <div className="flex gap-2">
          <div className={cn("relative flex-1 rounded-xl transition-shadow", flash && "shadow-[0_0_0_3px_var(--color-success)]")}>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void onEnter();
                } else if (e.key === "Escape") setQ("");
              }}
              placeholder="Scan barcode or search design, SKU, colour…"
              aria-label="Scan or search"
              className="h-12 rounded-xl bg-card pr-24 pl-11 text-base shadow-xs md:text-base"
            />
            <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
              {q ? (
                <Button variant="ghost" size="icon-sm" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Clear search"><X /></Button>
              ) : (
                <span className="hidden items-center gap-1 pr-1 text-xs text-muted-foreground sm:flex"><BarcodeIcon className="size-4" /> Ready</span>
              )}
            </div>
          </div>
          <Button variant="outline" className="h-12 rounded-xl bg-card px-3 sm:px-4" onClick={() => setScanOpen(true)}>
            <ScanLine /> <span className="hidden sm:inline">Simulate scan</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="scrollbar-none -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
            <Chip active={!categoryId} onClick={() => setCategoryId(null)}>All sarees</Chip>
            {catalog?.categories.map((c) => (
              <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}>{c.name}</Chip>
            ))}
          </div>
          <Select value={fabricId ?? ANY} onValueChange={(v) => setFabricId(v === ANY ? null : v)}>
            <SelectTrigger size="sm" className="w-36 shrink-0 bg-card sm:w-44">
              <SelectValue placeholder="Fabric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All fabrics</SelectItem>
              {catalog?.fabrics.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="@container min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {!data ? (
          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @2xl:grid-cols-4 @5xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="aspect-[4/6] rounded-xl" />)}
          </div>
        ) : data.entries.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No sarees match" description={q ? `Nothing found for "${q}". Try a design name, colour or the SKU on the tag.` : "Try another category or fabric."} />
        ) : (
          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3 @2xl:grid-cols-4 @5xl:grid-cols-5">
            {data.entries.map((e) => <DesignCard key={e.design.id} entry={e} onClick={() => setPickerId(e.design.id)} />)}
          </div>
        )}
      </div>

      <div className="hidden items-center gap-4 border-t bg-background px-5 py-2 text-xs text-muted-foreground lg:flex">
        <span className="inline-flex items-center gap-1.5"><Kbd>Enter</Kbd> add exact SKU</span>
        <span className="inline-flex items-center gap-1.5"><Kbd>Esc</Kbd> clear search</span>
        <span className="ml-auto">Scanner works anywhere on this screen</span>
      </div>

      <PiecePickerDialog
        entry={picker}
        onOpenChange={(o) => !o && setPickerId(null)}
        pending={pending}
        onAdd={async (id) => {
          if (await addItem(id)) setPickerId(null);
        }}
      />
      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} onScan={scanned} />
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground/80 hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DesignCard({ entry, onClick }: { entry: PosCatalogEntry; onClick: () => void }) {
  const soldOut = entry.available === 0;
  const colours = [...new Map(entry.pieces.map((p) => [p.colourName, p.colourHex])).entries()].slice(0, 5);
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="pos-design"
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        soldOut && "opacity-60",
      )}
    >
      <div className="relative">
        <MediaImage id={entry.imageId} alt={entry.design.name} thumb rounded="rounded-none" aspect="aspect-[4/5]" />
        <span
          className={cn(
            "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur",
            soldOut ? "bg-black/60 text-white" : entry.available <= 2 ? "bg-warning-soft/95 text-[oklch(0.45_0.12_65)]" : "bg-white/90 text-success",
          )}
        >
          {soldOut ? "Not available" : `${entry.available} available`}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="line-clamp-2 text-[13px] leading-snug font-medium">{entry.design.name}</div>
        <div className="truncate text-xs text-muted-foreground">{entry.fabricName}</div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <span className="text-sm font-semibold tabular">
            {entry.minPrice === entry.maxPrice ? formatINR(entry.minPrice) : `${formatINR(entry.minPrice)} – ${formatINR(entry.maxPrice)}`}
          </span>
          <span className="flex -space-x-1">
            {colours.map(([name, hex]) => <span key={name} title={name} className="size-3 rounded-full ring-2 ring-card" style={{ background: hex }} />)}
          </span>
        </div>
      </div>
    </button>
  );
}
