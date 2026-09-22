"use client";

import { Boxes, ChevronDown, Columns3, Copy, Download, Eye, FileSpreadsheet, ImagePlus, MoreHorizontal, Plus, Printer, Share2, Tag, Warehouse, X, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryStatus } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { usePrintLabels } from "@/hooks/use-labels";
import { useLive } from "@/hooks/use-live";
import { downloadFile, toCsv } from "@/lib/files";
import { formatDate, formatINR, formatNumber, formatRelative } from "@/lib/format";
import { searchInventory, markDamaged, moveItems, type InventoryQuery, type InventoryRow } from "@/services/inventory";
import { setPiecePrice } from "@/services/pricing";
import { useCan } from "@/stores/session";
import { DataTable, Pagination, type Column, type SortState } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot, SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryStatusBadge, inventoryStatusLabel } from "@/components/shared/status-badge";
import { ShareProductDialog, type ShareProduct } from "@/components/shared/share-product-dialog";

const STATUS_TABS: { value: InventoryQuery["status"]; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "RESERVED", label: "Reserved" },
  { value: "SOLD", label: "Sold" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "RETURNED", label: "Returned" },
];

const ANY = "__any";
const ALL_LABELS: Record<string, string> = { Category: "All categories", Fabric: "All fabrics", Colour: "All colours", Collection: "All collections", Location: "All locations", "Date added": "Any date" };
const PAGE_SIZE = 25;

type BulkDialog = null | "move" | "price" | "damaged";

export default function InventoryPage() {
  const router = useRouter();
  const catalog = useCatalog();
  const canEdit = useCan("inventory:edit");
  const canSeeCost = useCan("cost:view");
  const canPrice = useCan("pricing:edit");
  const printLabels = usePrintLabels();

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<InventoryQuery["status"]>("ALL");
  const [filters, setFilters] = useState({ categoryId: "", fabricId: "", colourId: "", collectionId: "", location: "", minPrice: "", maxPrice: "", addedWithinDays: "" });
  const [sort, setSort] = useState<SortState>({ key: "sku", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set(["collection"]));
  const [bulk, setBulk] = useState<BulkDialog>(null);
  const [share, setShare] = useState<ShareProduct | null>(null);

  const query: InventoryQuery = {
    q,
    status,
    categoryId: filters.categoryId || undefined,
    fabricId: filters.fabricId || undefined,
    colourId: filters.colourId || undefined,
    collectionId: filters.collectionId || undefined,
    location: filters.location || undefined,
    minPrice: filters.minPrice ? Number(filters.minPrice) : null,
    maxPrice: filters.maxPrice ? Number(filters.maxPrice) : null,
    addedWithinDays: filters.addedWithinDays ? Number(filters.addedWithinDays) : null,
    sortKey: sort.key as InventoryQuery["sortKey"],
    sortDir: sort.dir,
    page,
    pageSize: PAGE_SIZE,
  };
  const { data } = useLive(() => searchInventory(query), [JSON.stringify(query)]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value === ANY ? "" : value }));
    setPage(1);
  };
  const activeFilters = Object.values(filters).filter(Boolean).length + (q ? 1 : 0);
  const selectedRows = useMemo(() => data?.rows.filter((r) => selected.has(r.item.id)) ?? [], [data, selected]);

  const exportCsv = async () => {
    const all = await searchInventory({ ...query, page: 1, pageSize: Number.POSITIVE_INFINITY });
    const header = ["SKU", "Design", "Design code", "Colour", "Fabric", "Category", "Collections", ...(canSeeCost ? ["Purchase price"] : []), "MRP", "Selling price", "Price source", "Status", "Location", "Received", "Age (days)"];
    const rows = all.rows.map((r) => [
      r.item.sku,
      r.design.name,
      r.design.code,
      r.colour?.name ?? "",
      r.fabric?.name ?? "",
      r.category?.name ?? "",
      r.collectionNames.join("; "),
      ...(canSeeCost ? [r.item.cost] : []),
      r.mrp,
      r.price,
      r.priceSource === "OVERRIDE" ? "Individual" : "Design",
      inventoryStatusLabel(r.item.status),
      r.item.location,
      formatDate(r.item.receivedAt),
      r.ageDays,
    ]);
    downloadFile(`dhanvi-inventory-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...rows]));
  };

  const columns: Column<InventoryRow>[] = [
    {
      key: "image",
      header: "",
      className: "w-12",
      cell: (r) => <MediaImage id={r.imageId} alt={r.design.name} thumb className="w-10" rounded="rounded-md" />,
    },
    { key: "sku", header: "SKU", sortKey: "sku", cell: (r) => <span className="font-mono text-[13px] font-medium">{r.item.sku}</span> },
    {
      key: "design",
      header: "Design",
      sortKey: "design",
      cell: (r) => (
        <div className="max-w-56">
          <div className="truncate font-medium">{r.design.name}</div>
          <div className="text-xs text-muted-foreground">{r.design.code}</div>
        </div>
      ),
    },
    {
      key: "colour",
      header: "Colour",
      sortKey: "colour",
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <ColourDot hex={r.colour?.hex ?? "#999"} />
          {r.colour?.name}
        </span>
      ),
    },
    { key: "fabric", header: "Fabric", cell: (r) => r.fabric?.name },
    { key: "collection", header: "Collection", hidden: hidden.has("collection"), cell: (r) => <span className="text-muted-foreground">{r.collectionNames.join(", ")}</span> },
    ...(canSeeCost ? [{ key: "cost", header: "Purchase", sortKey: "cost", align: "right" as const, hidden: hidden.has("cost"), cell: (r: InventoryRow) => formatINR(r.item.cost) }] : []),
    {
      key: "price",
      header: "Selling",
      sortKey: "price",
      align: "right",
      cell: (r) => (
        <div>
          <div className="font-medium">{formatINR(r.price)}</div>
          {r.priceSource === "OVERRIDE" && <div className="text-[11px] text-gold-foreground">Individual price</div>}
        </div>
      ),
    },
    { key: "status", header: "Status", sortKey: "status", cell: (r) => <InventoryStatusBadge status={r.item.status} /> },
    { key: "location", header: "Location", sortKey: "location", hidden: hidden.has("location"), cell: (r) => <span className="font-mono text-xs">{r.item.location}</span> },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hidden: hidden.has("updated"), cell: (r) => <span className="text-muted-foreground">{formatRelative(r.item.updatedAt)}</span> },
    {
      key: "actions",
      header: "",
      className: "w-10",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/inventory/${r.item.sku}`)}>
                <Eye /> View details
              </DropdownMenuItem>
              {canEdit && (
                <DropdownMenuItem onSelect={() => router.push(`/inventory/new?from=${r.item.id}`)}>
                  <Copy /> Duplicate & change
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => printLabels({ skus: [r.item.sku] })}>
                <Printer /> Print barcode
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShare({ name: r.design.name, slug: r.design.slug, price: r.price, description: r.design.description, available: 1, imageId: r.imageId })}
              >
                <Share2 /> Share product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const hideable = [
    { key: "collection", label: "Collection" },
    ...(canSeeCost ? [{ key: "cost", label: "Purchase price" }] : []),
    { key: "location", label: "Location" },
    { key: "updated", label: "Updated" },
  ];

  const counts = data?.statusCounts;
  const inStock = counts ? counts.AVAILABLE + counts.RESERVED : 0;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          counts ? (
            <>
              {formatNumber(inStock)} pieces in stock · {formatNumber(counts.AVAILABLE)} available · every piece has its own SKU
            </>
          ) : (
            "Loading stock…"
          )
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export CSV
            </Button>
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus /> Add stock <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem asChild>
                    <Link href="/inventory/new" className="items-start">
                      <Plus className="mt-0.5" />
                      <div>
                        <div className="font-medium">Quick add</div>
                        <div className="text-xs text-muted-foreground">One saree at a time, keeps your last values</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/inventory/bulk" className="items-start">
                      <ImagePlus className="mt-0.5" />
                      <div>
                        <div className="font-medium">Bulk photo entry</div>
                        <div className="text-xs text-muted-foreground">Upload many photos, fill a sheet, save all</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/purchases/import" className="items-start">
                      <FileSpreadsheet className="mt-0.5" />
                      <div>
                        <div className="font-medium">Import Excel / CSV</div>
                        <div className="text-xs text-muted-foreground">Validate rows before importing</div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      <Tabs value={status} onValueChange={(v) => { setStatus(v as InventoryQuery["status"]); setPage(1); setSelected(new Set()); }} className="mb-4">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value!} className="gap-1.5">
              {t.label}
              {counts && (
                <span className="text-xs text-muted-foreground tabular">
                  {formatNumber(t.value === "ALL" ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[t.value as InventoryStatus])}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-4 space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search SKU, design, colour, rack…" className="lg:w-80" />
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <FilterSelect placeholder="Category" value={filters.categoryId} onChange={(v) => setFilter("categoryId", v)} options={catalog?.categories.map((c) => ({ value: c.id, label: c.name })) ?? []} />
            <FilterSelect placeholder="Fabric" value={filters.fabricId} onChange={(v) => setFilter("fabricId", v)} options={catalog?.fabrics.map((c) => ({ value: c.id, label: c.name })) ?? []} />
            <FilterSelect placeholder="Colour" value={filters.colourId} onChange={(v) => setFilter("colourId", v)} options={catalog?.colours.map((c) => ({ value: c.id, label: c.name, hex: c.hex })) ?? []} />
            <FilterSelect placeholder="Collection" value={filters.collectionId} onChange={(v) => setFilter("collectionId", v)} options={catalog?.collections.map((c) => ({ value: c.id, label: c.name })) ?? []} />
            <FilterSelect placeholder="Location" value={filters.location} onChange={(v) => setFilter("location", v)} options={data?.locations.map((l) => ({ value: l, label: `Rack ${l}` })) ?? []} />
            <FilterSelect
              placeholder="Date added"
              value={filters.addedWithinDays}
              onChange={(v) => setFilter("addedWithinDays", v)}
              options={[
                { value: "1", label: "Today" },
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Input inputMode="numeric" placeholder="Min ₹" value={filters.minPrice} onChange={(e) => setFilter("minPrice", e.target.value.replace(/\D/g, ""))} className="h-8 w-24 bg-card" />
            <span className="text-muted-foreground">–</span>
            <Input inputMode="numeric" placeholder="Max ₹" value={filters.maxPrice} onChange={(e) => setFilter("maxPrice", e.target.value.replace(/\D/g, ""))} className="h-8 w-24 bg-card" />
          </div>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setFilters({ categoryId: "", fabricId: "", colourId: "", collectionId: "", location: "", minPrice: "", maxPrice: "", addedWithinDays: "" }); setPage(1); }}>
              <X /> Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </Button>
          )}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-card">
                  <Columns3 /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideable.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.key}
                    checked={!hidden.has(c.key)}
                    onCheckedChange={(on) =>
                      setHidden((h) => {
                        const next = new Set(h);
                        if (on) next.delete(c.key);
                        else next.add(c.key);
                        return next;
                      })
                    }
                  >
                    {c.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-md">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={() => printLabels({ skus: selectedRows.map((r) => r.item.sku) })}>
              <Printer /> Print labels
            </Button>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setBulk("move")}>
                <Warehouse /> Move rack
              </Button>
            )}
            {canPrice && (
              <Button size="sm" variant="outline" onClick={() => setBulk("price")}>
                <Tag /> Set price
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setBulk("damaged")}>
                <AlertTriangle /> Mark damaged
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X /> Clear
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.rows}
        rowKey={(r) => r.item.id}
        onRowClick={(r) => router.push(`/inventory/${r.item.sku}`)}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        mobileCard={(r) => (
          <div className="flex gap-3">
            <MediaImage id={r.imageId} alt={r.design.name} thumb className="w-14 shrink-0" rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-medium">{r.item.sku}</span>
                <InventoryStatusBadge status={r.item.status} />
              </div>
              <div className="truncate text-sm">{r.design.name}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><ColourDot hex={r.colour?.hex ?? "#999"} />{r.colour?.name} · Rack {r.item.location}</span>
                <span className="font-medium text-foreground">{formatINR(r.price)}</span>
              </div>
            </div>
          </div>
        )}
        empty={
          <EmptyState
            icon={Boxes}
            title="No pieces match these filters"
            description="Try clearing a filter or searching by SKU."
            action={activeFilters > 0 ? <Button variant="outline" onClick={() => { setQ(""); setFilters({ categoryId: "", fabricId: "", colourId: "", collectionId: "", location: "", minPrice: "", maxPrice: "", addedWithinDays: "" }); }}>Clear filters</Button> : undefined}
          />
        }
      />
      {data && data.total > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}

      <BulkDialogs kind={bulk} onClose={() => setBulk(null)} rows={selectedRows} onDone={() => setSelected(new Set())} />
      <ShareProductDialog product={share} open={!!share} onOpenChange={(o) => !o && setShare(null)} />
    </>
  );
}

function FilterSelect({ placeholder, value, onChange, options }: { placeholder: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; hex?: string }[] }) {
  const allLabel = ALL_LABELS[placeholder] ?? `Any ${placeholder.toLowerCase()}`;
  return (
    <Select value={value || ANY} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full bg-card">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.hex && <ColourDot hex={o.hex} />}
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BulkDialogs({ kind, onClose, rows, onDone }: { kind: BulkDialog; onClose: () => void; rows: InventoryRow[]; onDone: () => void }) {
  const [value, setValue] = useState("");
  const ids = rows.map((r) => r.item.id);
  const move = useAction(moveItems, { success: `Moved ${ids.length} pieces` });
  const price = useAction(setPiecePrice, { success: `Updated price for ${ids.length} pieces` });
  const damage = useAction(markDamaged, { success: `Marked ${ids.length} pieces damaged` });
  const pending = move.pending || price.pending || damage.pending;

  const submit = async () => {
    let ok: unknown;
    if (kind === "move") ok = await move.run(ids, value);
    if (kind === "price") ok = await price.run(ids, value ? Number(value) : null);
    if (kind === "damaged") ok = await damage.run(ids, value);
    if (ok !== undefined) {
      setValue("");
      onDone();
      onClose();
    }
  };

  const titles: Record<Exclude<BulkDialog, null>, { title: string; description: string; label: string; placeholder: string }> = {
    move: { title: "Move to rack", description: "Every piece gets a location movement in its history.", label: "Rack / location", placeholder: "B-14" },
    price: { title: "Set individual price", description: "Overrides the design price for these pieces only. Leave empty to follow the design price again. SKUs and barcodes do not change.", label: "Selling price (₹)", placeholder: "3499" },
    damaged: { title: "Mark as damaged", description: "Damaged pieces cannot be sold on any channel until restored.", label: "Reason", placeholder: "Stain on pallu" },
  };
  const meta = kind ? titles[kind] : null;

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {meta && (
          <>
            <DialogHeader>
              <DialogTitle>{meta.title}</DialogTitle>
              <DialogDescription>
                {rows.length} piece{rows.length === 1 ? "" : "s"} selected. {meta.description}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="bulk-value">{meta.label}</Label>
              {kind === "damaged" ? (
                <Textarea id="bulk-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={meta.placeholder} />
              ) : (
                <Input id="bulk-value" value={value} inputMode={kind === "price" ? "numeric" : undefined} onChange={(e) => setValue(kind === "price" ? e.target.value.replace(/\D/g, "") : e.target.value.toUpperCase())} placeholder={meta.placeholder} autoFocus />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={submit} disabled={pending || (kind === "move" && !value.trim())} variant={kind === "damaged" ? "destructive" : "default"}>
                Apply to {rows.length}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
