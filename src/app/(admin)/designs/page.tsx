"use client";

import { LayoutGrid, List, Palette, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { discountPercent } from "@/domain/rules/pricing";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateDesign } from "@/services/catalog";
import { listDesignSummaries, type DesignSummary } from "@/services/inventory";
import { useCan } from "@/stores/session";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { Pill } from "@/components/shared/status-badge";
import { NewDesignDialog } from "@/components/designs/new-design-dialog";

const ANY = "__any";
type View = "grid" | "list";

function readView(): View {
  try {
    return localStorage.getItem("dhanvi-designs-view") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export default function DesignsPage() {
  const router = useRouter();
  const catalog = useCatalog();
  const canEdit = useCan("designs:edit");
  const { data } = useLive(listDesignSummaries, []);
  const [view, setViewState] = useState<View>(readView);
  const [q, setQ] = useState("");
  const [fabricId, setFabricId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [status, setStatus] = useState<"all" | "published" | "hidden" | "in-stock">("all");
  const [creating, setCreating] = useState(false);
  const publish = useAction(updateDesign);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem("dhanvi-designs-view", v);
    } catch {}
  };

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (fabricId && s.design.fabricId !== fabricId) return false;
      if (collectionId && !s.design.collectionIds.includes(collectionId)) return false;
      if (status === "published" && !s.design.isPublished) return false;
      if (status === "hidden" && s.design.isPublished) return false;
      if (status === "in-stock" && s.stock.available === 0) return false;
      if (needle && !`${s.design.name} ${s.design.code} ${s.fabric?.name ?? ""} ${s.collectionNames.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, q, fabricId, collectionId, status]);

  const filtered = !!(q || fabricId || collectionId || status !== "all");
  const clear = () => {
    setQ("");
    setFabricId("");
    setCollectionId("");
    setStatus("all");
  };
  const totals = data ? { designs: data.length, published: data.filter((d) => d.design.isPublished).length, available: data.reduce((s, d) => s + d.stock.available, 0) } : null;
  const togglePublish = (s: DesignSummary, on: boolean) => void publish.run(s.design.id, { isPublished: on });

  const columns: Column<DesignSummary>[] = [
    { key: "image", header: "", className: "w-12", cell: (s) => <MediaImage id={s.imageId} alt={s.design.name} thumb className="w-10" rounded="rounded-md" /> },
    {
      key: "name",
      header: "Design",
      cell: (s) => (
        <div className="max-w-64">
          <div className="truncate font-medium">{s.design.name}</div>
          <div className="text-xs text-muted-foreground">{s.design.code}</div>
        </div>
      ),
    },
    { key: "fabric", header: "Fabric", cell: (s) => s.fabric?.name },
    { key: "collections", header: "Collections", cell: (s) => <span className="text-muted-foreground">{s.collectionNames.join(", ") || "None"}</span> },
    { key: "price", header: "Price", align: "right", cell: (s) => <span className="font-medium">{formatINR(s.design.price)}</span> },
    { key: "mrp", header: "MRP", align: "right", cell: (s) => <span className="text-muted-foreground">{formatINR(s.design.mrp)}</span> },
    { key: "available", header: "Available", align: "right", cell: (s) => <span className={cn("font-medium", s.stock.available === 0 && "text-destructive")}>{s.stock.available}</span> },
    { key: "reserved", header: "Reserved", align: "right", cell: (s) => s.stock.reserved },
    { key: "sold", header: "Sold", align: "right", cell: (s) => s.stock.sold },
    {
      key: "published",
      header: "Website",
      cell: (s) => (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
          <Switch checked={s.design.isPublished} disabled={!canEdit} onCheckedChange={(on) => togglePublish(s, on)} aria-label="Published on website" />
          <span className="text-xs text-muted-foreground">{s.design.isPublished ? "Live" : "Hidden"}</span>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Products / Designs"
        description={
          totals ? (
            <>
              {formatNumber(totals.designs)} designs · {formatNumber(totals.published)} live on the website · {formatNumber(totals.available)} pieces available
            </>
          ) : (
            "Loading designs…"
          )
        }
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> New design
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search design name, code, fabric…" className="lg:w-80" />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:max-w-2xl">
          <Select value={fabricId || ANY} onValueChange={(v) => setFabricId(v === ANY ? "" : v)}>
            <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All fabrics</SelectItem>
              {catalog?.fabrics.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={collectionId || ANY} onValueChange={(v) => setCollectionId(v === ANY ? "" : v)}>
            <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All collections</SelectItem>
              {catalog?.collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All designs</SelectItem>
              <SelectItem value="published">Live on website</SelectItem>
              <SelectItem value="hidden">Hidden from website</SelectItem>
              <SelectItem value="in-stock">In stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          {filtered && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <X /> Clear
            </Button>
          )}
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as View)} className="bg-card">
            <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid /></ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view"><List /></ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {data && rows.length === 0 ? (
        <EmptyState
          icon={Palette}
          title={filtered ? "No designs match these filters" : "No designs yet"}
          description={filtered ? "Try clearing a filter." : "Create a design, or add stock and designs are created for you."}
          action={filtered ? <Button variant="outline" onClick={clear}>Clear filters</Button> : undefined}
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 2xl:grid-cols-5">
          {data
            ? rows.map((s) => <DesignCard key={s.design.id} s={s} canEdit={canEdit} onOpen={() => router.push(`/designs/view?id=${s.design.id}`)} onPublish={(on) => togglePublish(s, on)} />)
            : Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[4/5] rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={data ? rows : undefined}
          rowKey={(s) => s.design.id}
          onRowClick={(s) => router.push(`/designs/view?id=${s.design.id}`)}
          mobileCard={(s) => (
            <div className="flex gap-3">
              <MediaImage id={s.imageId} alt={s.design.name} thumb className="w-14 shrink-0" rounded="rounded-md" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.design.name}</div>
                <div className="text-xs text-muted-foreground">{s.design.code} · {s.fabric?.name}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.stock.available} available · {s.stock.sold} sold</span>
                  <span className="font-medium">{formatINR(s.design.price)}</span>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <NewDesignDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function DesignCard({ s, canEdit, onOpen, onPublish }: { s: DesignSummary; canEdit: boolean; onOpen: () => void; onPublish: (on: boolean) => void }) {
  const off = discountPercent(s.design.mrp, s.design.price);
  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative">
          <MediaImage id={s.imageId} alt={s.design.name} rounded="rounded-none" className="transition-transform duration-500 group-hover:scale-[1.02]" />
          <div className="absolute top-2 left-2 flex gap-1">
            {s.stock.available === 0 ? <Pill tone="danger">Out of stock</Pill> : s.stock.available <= 2 ? <Pill tone="warning">Only {s.stock.available} left</Pill> : null}
          </div>
          {!s.design.isPublished && (
            <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">Hidden</span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <div className="truncate text-sm font-medium">{s.design.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {s.design.code} · {s.fabric?.name}
            {s.collectionNames.length > 0 && <> · {s.collectionNames.join(", ")}</>}
          </div>
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="font-semibold tabular">{formatINR(s.design.price)}</span>
            {off > 0 && <span className="text-xs text-muted-foreground line-through tabular">{formatINR(s.design.mrp)}</span>}
          </div>
          <div className="flex gap-3 pt-1 text-[11px] text-muted-foreground tabular">
            <span><span className="font-medium text-success">{s.stock.available}</span> avail</span>
            <span><span className="font-medium text-foreground">{s.stock.reserved}</span> reserved</span>
            <span><span className="font-medium text-foreground">{s.stock.sold}</span> sold</span>
          </div>
        </div>
      </button>
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
        <span className={s.design.isPublished ? "text-success" : "text-muted-foreground"}>{s.design.isPublished ? "Live on website" : "Hidden from website"}</span>
        <Switch size="sm" checked={s.design.isPublished} disabled={!canEdit} onCheckedChange={onPublish} aria-label="Published on website" />
      </div>
    </div>
  );
}
