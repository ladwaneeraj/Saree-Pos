"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Catalog } from "@/services/catalog";
import { listStoreProducts, type StoreFilter, type StoreSort } from "@/services/storefront";
import { ProductGrid } from "./product-card";

const SORTS: { value: StoreSort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "bestselling", label: "Best selling" },
];

const PRICE_BANDS = [
  { key: "0-5000", label: `Under ${formatINR(5000)}`, min: null, max: 5000 },
  { key: "5000-15000", label: `${formatINR(5000)} to ${formatINR(15000)}`, min: 5000, max: 15000 },
  { key: "15000-30000", label: `${formatINR(15000)} to ${formatINR(30000)}`, min: 15000, max: 30000 },
  { key: "30000-", label: `Above ${formatINR(30000)}`, min: 30000, max: null },
] as const;

interface ListingState {
  q: string;
  fabrics: string[];
  collection: string | null;
  colours: string[];
  price: string | null;
  includeSoldOut: boolean;
  sort: StoreSort;
}

const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);

function readState(params: URLSearchParams): ListingState {
  const sort = params.get("sort") as StoreSort | null;
  return {
    q: params.get("q") ?? "",
    fabrics: list(params.get("fabric")),
    collection: params.get("collection"),
    colours: list(params.get("colour")),
    price: params.get("price"),
    includeSoldOut: params.get("stock") === "all",
    sort: sort && SORTS.some((s) => s.value === sort) ? sort : "featured",
  };
}

function toParams(s: ListingState): string {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.fabrics.length) p.set("fabric", s.fabrics.join(","));
  if (s.collection) p.set("collection", s.collection);
  if (s.colours.length) p.set("colour", s.colours.join(","));
  if (s.price) p.set("price", s.price);
  if (s.includeSoldOut) p.set("stock", "all");
  if (s.sort !== "featured") p.set("sort", s.sort);
  const str = p.toString();
  return str ? `?${str}` : "";
}

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Filterable saree grid. State lives in the URL so filtered views can be shared. */
export function ProductListing({ fixedCollection, title, description }: { fixedCollection?: string; title: string; description?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const catalog = useCatalog();
  const state = useMemo(() => readState(new URLSearchParams(params.toString())), [params]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const set = (patch: Partial<ListingState>) => router.replace(`${pathname}${toParams({ ...state, ...patch })}`, { scroll: false });

  const band = PRICE_BANDS.find((b) => b.key === state.price);
  const filter: StoreFilter = {
    q: state.q,
    fabricIds: state.fabrics,
    collectionSlug: fixedCollection ?? state.collection,
    colourIds: state.colours,
    minPrice: band?.min ?? null,
    maxPrice: band?.max ?? null,
    inStockOnly: !state.includeSoldOut,
    sort: state.sort,
  };
  const key = JSON.stringify(filter);
  const { data: products, loading } = useLive(() => listStoreProducts(filter), [key]);

  const activeCount = state.fabrics.length + state.colours.length + (state.price ? 1 : 0) + (state.includeSoldOut ? 1 : 0) + (!fixedCollection && state.collection ? 1 : 0);
  const clear = () => set({ fabrics: [], colours: [], price: null, includeSoldOut: false, collection: null });

  const chips: { label: string; onRemove: () => void }[] = catalog
    ? [
        ...(state.q ? [{ label: `"${state.q}"`, onRemove: () => set({ q: "" }) }] : []),
        ...state.fabrics.map((id) => ({ label: catalog.fabricById.get(id)?.name ?? id, onRemove: () => set({ fabrics: toggle(state.fabrics, id) }) })),
        ...state.colours.map((id) => ({ label: catalog.colourById.get(id)?.name ?? id, onRemove: () => set({ colours: toggle(state.colours, id) }) })),
        ...(band ? [{ label: band.label, onRemove: () => set({ price: null }) }] : []),
        ...(!fixedCollection && state.collection ? [{ label: catalog.collections.find((c) => c.slug === state.collection)?.name ?? state.collection, onRemove: () => set({ collection: null }) }] : []),
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl leading-none sm:text-6xl">{title}</h1>
        {description && <p className="mt-3 text-[15px] text-muted-foreground">{description}</p>}
      </div>

      <div className="mt-6 flex items-center gap-2 border-y py-3">
        <Button variant="outline" className="h-10 rounded-full lg:hidden" onClick={() => setSheetOpen(true)}>
          <SlidersHorizontal /> Filters {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{activeCount}</span>}
        </Button>
        <p className="hidden text-sm text-muted-foreground tabular lg:block" data-testid="result-count">
          {products ? `${products.length} ${products.length === 1 ? "saree" : "sarees"}` : "Loading sarees"}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">Sort by</span>
          <Select value={state.sort} onValueChange={(v) => set({ sort: v as StoreSort })}>
            <SelectTrigger className="h-10 w-[170px] rounded-full bg-card" aria-label="Sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 pb-8">
            {catalog && <FilterPanel catalog={catalog} state={state} set={set} fixedCollection={fixedCollection} />}
            {activeCount > 0 && (
              <Button variant="link" className="mt-4 px-0" onClick={clear}>Clear all filters</Button>
            )}
          </div>
        </aside>
        <div className="min-w-0">
          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={c.onRemove} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-wine-50 px-3 text-xs font-medium text-primary hover:bg-wine-100">
                  {c.label} <X className="size-3.5" />
                </button>
              ))}
            </div>
          )}
          <p className="mb-4 text-sm text-muted-foreground tabular lg:hidden">{products ? `${products.length} ${products.length === 1 ? "saree" : "sarees"}` : ""}</p>
          {products && products.length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No sarees match these filters"
              description="Try removing a filter or searching for something else. New pieces arrive every week."
              action={<Button variant="outline" onClick={() => set({ q: "", fabrics: [], colours: [], price: null, collection: null })}>Clear filters</Button>}
            />
          ) : (
            <ProductGrid products={products} loading={loading && !products} className="lg:grid-cols-3" />
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-2xl">
          <SheetHeader className="border-b pb-3">
            <SheetTitle className="font-display text-2xl font-normal">Filters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4">
            {catalog && <FilterPanel catalog={catalog} state={state} set={set} fixedCollection={fixedCollection} />}
          </div>
          <SheetFooter className="pb-safe grid grid-cols-2 gap-3 border-t">
            <Button variant="outline" className="h-12" onClick={clear}>Clear all</Button>
            <Button className="h-12" onClick={() => setSheetOpen(false)}>
              Show {products?.length ?? ""} sarees
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b py-5 first:pt-2 last:border-b-0">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function FilterPanel({ catalog, state, set, fixedCollection }: { catalog: Catalog; state: ListingState; set: (p: Partial<ListingState>) => void; fixedCollection?: string }) {
  return (
    <div>
      <FilterGroup title="Availability">
        <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm">
          In stock only
          <Switch checked={!state.includeSoldOut} onCheckedChange={(v) => set({ includeSoldOut: !v })} />
        </label>
      </FilterGroup>
      <FilterGroup title="Fabric">
        <div className="space-y-1">
          {catalog.fabrics.map((f) => (
            <label key={f.id} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={state.fabrics.includes(f.id)} onCheckedChange={() => set({ fabrics: toggle(state.fabrics, f.id) })} />
              {f.name}
            </label>
          ))}
        </div>
      </FilterGroup>
      {!fixedCollection && (
        <FilterGroup title="Collection">
          <div className="flex flex-wrap gap-2">
            {catalog.collections.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set({ collection: state.collection === c.slug ? null : c.slug })}
                className={cn("h-9 rounded-full border px-3.5 text-sm transition", state.collection === c.slug ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {c.name}
              </button>
            ))}
          </div>
        </FilterGroup>
      )}
      <FilterGroup title="Colour">
        <div className="grid grid-cols-6 gap-2.5 lg:grid-cols-5">
          {catalog.colours.map((c) => {
            const on = state.colours.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={on}
                onClick={() => set({ colours: toggle(state.colours, c.id) })}
                className={cn("size-9 rounded-full ring-1 ring-black/10 transition", on ? "ring-2 ring-primary ring-offset-2" : "hover:scale-110")}
                style={{ background: c.hex }}
              />
            );
          })}
        </div>
      </FilterGroup>
      <FilterGroup title="Price">
        <div className="space-y-1">
          {PRICE_BANDS.map((b) => (
            <label key={b.key} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={state.price === b.key} onCheckedChange={() => set({ price: state.price === b.key ? null : b.key })} className="rounded-full" />
              {b.label}
            </label>
          ))}
        </div>
      </FilterGroup>
    </div>
  );
}
