"use client";

import { Check, CheckCircle2, CloudCheck, ExternalLink, ImagePlus, Keyboard, Loader2, Plus, Printer, Rows3, ScanBarcode, Sparkles, Store, TriangleAlert, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import type { InventoryDraft, InventoryItem } from "@/domain/types";
import { errorMessage } from "@/domain/errors";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ensureCollection, ensureColour, ensureFabric, listDesigns } from "@/services/catalog";
import { addDrafts, commitDrafts, deleteDrafts, listDrafts, reorderDrafts, saveDrafts, type NewDraft } from "@/services/drafts";
import { peekNextSkus } from "@/services/inventory";
import { nearestColour } from "@/services/media";
import { useCan } from "@/stores/session";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ImageManager, PhotoDropzone, uploadPhotos } from "@/components/shared/image-manager";
import { MediaImage } from "@/components/shared/media-image";
import { PageHeader } from "@/components/shared/page-header";
import { ApplyToolbar } from "./apply-toolbar";
import { BulkGrid, type CellEntry } from "./bulk-grid";
import { adjustByPercent, ALL_COLUMNS, buildLookups, checkRow, textPatch, toPieceInput, unknownName, type ColKey, type Lookups, type RowCheck } from "./sheet";

const AUTOSAVE_MS = 600;

// Row checks are cached per row object so unchanged rows keep the same check and skip re-rendering.
const checkCache = new WeakMap<InventoryDraft, { lk: Lookups; needCost: boolean; check: RowCheck }>();
function cachedCheck(row: InventoryDraft, lk: Lookups, needCost: boolean): RowCheck {
  const hit = checkCache.get(row);
  if (hit && hit.lk === lk && hit.needCost === needCost) return hit.check;
  const check = checkRow(row, lk, needCost);
  checkCache.set(row, { lk, needCost, check });
  return check;
}
const UPLOAD_BATCH = 4;

export function BulkEntry() {
  const canEdit = useCan("inventory:edit");
  if (!canEdit) {
    return <EmptyState icon={ImagePlus} title="Bulk entry needs inventory edit access" description="Switch to the Owner or Manager role to add stock." />;
  }
  return <BulkEntrySheet />;
}

function BulkEntrySheet() {
  const router = useRouter();
  const catalog = useCatalog();
  const { data: designs } = useLive(listDesigns, []);
  const canSeeCost = useCan("cost:view");
  const { confirm, dialog } = useConfirm();

  const [rows, setRowsState] = useState<InventoryDraft[] | null>(null);
  const rowsRef = useRef<InventoryDraft[]>([]);
  const dirty = useRef(new Set<string>());
  const timer = useRef<number | undefined>(undefined);
  const flushing = useRef<Promise<void>>(Promise.resolve());
  const [saveState, setSaveState] = useState<"saved" | "pending" | "saving">("saved");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSkus, setShowSkus] = useState(false);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [photoRow, setPhotoRow] = useState<string | null>(null);
  const [fileDrag, setFileDrag] = useState<number | null>(null);
  const [result, setResult] = useState<{ items: InventoryItem[]; newDesigns: number; imageIds: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  /* ---------------- persistence ---------------- */

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const ids = [...dirty.current];
    dirty.current.clear();
    if (ids.length === 0) return;
    setSaveState("saving");
    const byId = new Map(rowsRef.current.map((r) => [r.id, r]));
    const work = flushing.current.then(() => saveDrafts(ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))));
    flushing.current = work.catch(() => undefined);
    try {
      await work;
    } catch (e) {
      toast.error(`Could not save draft rows: ${errorMessage(e)}`);
    }
    setSaveState(dirty.current.size ? "pending" : "saved");
  }, []);

  const setRows = useCallback(
    (next: InventoryDraft[], changed: Iterable<string> = []) => {
      rowsRef.current = next;
      setRowsState(next);
      let any = false;
      for (const id of changed) {
        dirty.current.add(id);
        any = true;
      }
      if (any) {
        setSaveState("pending");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush(), AUTOSAVE_MS);
      }
    },
    [flush],
  );

  useEffect(() => {
    let active = true;
    listDrafts().then((d) => {
      if (!active) return;
      rowsRef.current = d;
      setRowsState(d);
    });
    const onUnload = () => void flush();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      active = false;
      window.removeEventListener("beforeunload", onUnload);
      void flush();
    };
  }, [flush]);

  /* ---------------- derived ---------------- */

  const lk = useMemo(() => (catalog && designs ? buildLookups(designs, catalog.colours, catalog.fabrics, catalog.collections) : null), [catalog, designs]);
  const columns = useMemo(() => ALL_COLUMNS.filter((c) => canSeeCost || c.key !== "cost"), [canSeeCost]);
  const checks = useMemo(() => {
    const map = new Map<string, RowCheck>();
    if (!lk || !rows) return map;
    for (const r of rows) map.set(r.id, cachedCheck(r, lk, canSeeCost));
    return map;
  }, [rows, lk, canSeeCost]);

  const readyRows = useMemo(() => (rows ?? []).filter((r) => checks.get(r.id)?.errors.length === 0), [rows, checks]);
  const attention = (rows?.length ?? 0) - readyRows.length;
  const warnings = readyRows.filter((r) => (checks.get(r.id)?.warnings.length ?? 0) > 0).length;
  const { data: skuList } = useLive(() => (showSkus && readyRows.length ? peekNextSkus(readyRows.length) : Promise.resolve(null)), [showSkus, readyRows.length]);
  const readyKey = readyRows.map((r) => r.id).join(",");
  const skus = useMemo(() => (skuList ? new Map(readyRows.map((r, i) => [r.id, skuList[i] ?? ""])) : null), [skuList, readyKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------------- editing ---------------- */

  const commitCells = useCallback(
    async (entries: CellEntry[], label?: string) => {
      if (!lk || entries.length === 0) return;
      try {
        const maxRow = Math.max(...entries.map((e) => e.row));
        if (maxRow >= rowsRef.current.length) {
          const extra = maxRow - rowsRef.current.length + 1;
          const created = await addDrafts(Array.from({ length: extra }, () => ({ imageIds: [] })));
          setRows([...rowsRef.current, ...created]);
        }
        let lookups: Lookups = lk;
        const unknown = new Map<string, { col: ColKey; name: string }>();
        for (const e of entries) {
          const name = unknownName(e.col, e.text, lk);
          if (name) unknown.set(`${e.col}:${name.toLowerCase()}`, { col: e.col, name });
        }
        if (unknown.size) {
          const colours = [...lk.colours];
          const fabrics = [...lk.fabrics];
          const collections = [...lk.collections];
          for (const { col, name } of unknown.values()) {
            if (col === "colour") colours.push(await ensureColour(name));
            if (col === "fabric") fabrics.push(await ensureFabric(name));
            if (col === "collection") collections.push(await ensureCollection(name));
          }
          lookups = buildLookups(lk.designs, colours, fabrics, collections);
          toast.info(`Added ${[...unknown.values()].map((u) => `${u.col} "${u.name}"`).join(", ")} to your lists`);
        }
        const next = [...rowsRef.current];
        const changed = new Set<string>();
        let skipped = 0;
        for (const e of entries) {
          const row = next[e.row];
          if (!row) continue;
          const patch = textPatch(row, e.col, e.text, lookups);
          if (!patch) {
            skipped++;
            continue;
          }
          next[e.row] = { ...row, ...patch };
          changed.add(row.id);
        }
        setRows(next, changed);
        if (label && changed.size) toast.success(label);
        if (skipped) toast.warning(`${skipped} cell${skipped === 1 ? " was" : "s were"} skipped`, { description: "Fabric and collection come from the chosen design, and prices must be numbers." });
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [lk, setRows],
  );

  const patchRows = (ids: Set<string>, fn: (r: InventoryDraft) => InventoryDraft) => {
    setRows(rowsRef.current.map((r) => (ids.has(r.id) ? fn(r) : r)), ids);
  };

  const indexesOf = (ids: Set<string>) => rowsRef.current.flatMap((r, i) => (ids.has(r.id) ? [i] : []));

  /* ---------------- photos ---------------- */

  const addPhotoRows = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Drop JPG, PNG or WebP photos");
      return;
    }
    const colours = catalog?.colours ?? [];
    setUpload({ done: 0, total: images.length });
    try {
      for (let i = 0; i < images.length; i += UPLOAD_BATCH) {
        const processed = await uploadPhotos(images.slice(i, i + UPLOAD_BATCH));
        const entries: NewDraft[] = processed.map((p) => {
          const colour = nearestColour(p.dominantHex, colours);
          return { imageIds: [p.media.id], colourId: colour?.id ?? null, colourAutoDetected: !!colour };
        });
        const created = await addDrafts(entries);
        setRows([...rowsRef.current, ...created]);
        setUpload({ done: Math.min(i + UPLOAD_BATCH, images.length), total: images.length });
      }
      toast.success(`${images.length} photo${images.length === 1 ? "" : "s"} added as new rows`, { description: "Colours were detected from each photo. Check them as you go." });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUpload(null);
    }
  };
  const addPhotoRowsRef = useRef(addPhotoRows);
  useLayoutEffect(() => {
    addPhotoRowsRef.current = addPhotoRows;
  });

  const addPhotosToRow = async (rowId: string, files: File[]) => {
    try {
      const processed = await uploadPhotos(files);
      if (processed.length === 0) return;
      const row = rowsRef.current.find((r) => r.id === rowId);
      if (!row) return;
      const detect = !row.colourId && row.imageIds.length === 0 ? nearestColour(processed[0]!.dominantHex, catalog?.colours ?? []) : undefined;
      patchRows(new Set([rowId]), (r) => ({
        ...r,
        imageIds: [...r.imageIds, ...processed.map((p) => p.media.id)],
        ...(detect ? { colourId: detect.id, colourAutoDetected: true } : {}),
      }));
      toast.success(`${processed.length} photo${processed.length === 1 ? "" : "s"} added to row ${rowsRef.current.findIndex((r) => r.id === rowId) + 1}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  // Photos can be dropped anywhere on the page.
  useEffect(() => {
    let hide: number | undefined;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setFileDrag(e.dataTransfer?.items.length ?? 0);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setFileDrag(null), 150);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setFileDrag(null);
      if (e.defaultPrevented && e.target instanceof Element && e.target.closest("[data-dropzone]")) return;
      void addPhotoRowsRef.current([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
      window.clearTimeout(hide);
    };
  }, []);

  /* ---------------- rows ---------------- */

  const addEmptyRows = async (count: number, values?: NewDraft[]) => {
    const created = await addDrafts(values ?? Array.from({ length: count }, () => ({ imageIds: [] })));
    setRows([...rowsRef.current, ...created]);
  };

  const addSampleRows = async () => {
    const withPhotos = (designs ?? []).filter((d) => d.imageIds.length > 0).slice(0, 12);
    await addEmptyRows(withPhotos.length, withPhotos.map((d) => ({ imageIds: [d.imageIds[0]!] })));
    toast.success(`${withPhotos.length} sample rows added`, { description: "Photos come from existing designs. Fill in the rest to try the sheet." });
  };

  const reorder = (movedIds: string[], beforeId: string | null) => {
    const moving = new Set(movedIds);
    const moved = rowsRef.current.filter((r) => moving.has(r.id));
    const rest = rowsRef.current.filter((r) => !moving.has(r.id));
    const at = beforeId ? rest.findIndex((r) => r.id === beforeId) : rest.length;
    const next = [...rest.slice(0, at), ...moved, ...rest.slice(at)].map((r, i) => (r.position === i + 1 ? r : { ...r, position: i + 1 }));
    setRows(next);
    void reorderDrafts(next.map((r) => r.id)).catch((e) => toast.error(errorMessage(e)));
  };

  const removeRows = async (ids: Set<string>) => {
    const ok = await confirm({
      title: `Delete ${ids.size} draft row${ids.size === 1 ? "" : "s"}?`,
      description: "The rows and their photo links are removed from this sheet. Nothing has been added to inventory yet, so stock is not affected.",
      confirmLabel: "Delete rows",
      destructive: true,
    });
    if (!ok) return;
    await flushing.current;
    for (const id of ids) dirty.current.delete(id);
    setRows(rowsRef.current.filter((r) => !ids.has(r.id)));
    setSelected(new Set());
    try {
      await deleteDrafts([...ids]);
      toast.success(`Deleted ${ids.size} row${ids.size === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  /* ---------------- save ---------------- */

  const saveAll = async () => {
    if (readyRows.length === 0) return;
    setSaving(true);
    await flush();
    await flushing.current;
    const saved = readyRows;
    try {
      const items = await commitDrafts(saved.map((r) => r.id), saved.map(toPieceInput));
      const savedIds = new Set(saved.map((r) => r.id));
      for (const id of savedIds) dirty.current.delete(id);
      setRows(rowsRef.current.filter((r) => !savedIds.has(r.id)));
      setSelected(new Set());
      setShowSkus(false);
      const newDesigns = new Set(saved.filter((r) => !r.designId).map((r) => r.designName.trim().toLowerCase())).size;
      setResult({ items, newDesigns, imageIds: saved.flatMap((r) => r.imageIds.slice(0, 1)).slice(0, 8) });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- render ---------------- */

  if (!rows || !lk) return <SheetSkeleton />;
  const photoDraft = photoRow ? rows.find((r) => r.id === photoRow) : undefined;

  return (
    <>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title="Bulk photo entry"
        description="Drop saree photos, fill the sheet like Excel, save everything in one go."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (files.length) void addPhotoRows(files);
              }}
            />
            <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={!!upload}>
              <Upload /> Add photos
            </Button>
            {rows.length > 0 && (
              <Toggle variant="outline" pressed={showSkus} onPressedChange={setShowSkus} className="bg-background data-[state=on]:bg-wine-50 data-[state=on]:text-primary">
                <ScanBarcode /> {showSkus ? "SKUs previewed" : "Generate SKUs"}
              </Toggle>
            )}
            <Button onClick={saveAll} disabled={readyRows.length === 0 || saving || !!upload}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Save {formatNumber(readyRows.length)} piece{readyRows.length === 1 ? "" : "s"} to inventory
            </Button>
          </>
        }
      />

      {upload && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border bg-card p-3 pl-4 shadow-xs">
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
          <div className="flex-1 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Processing photos and detecting colours</span>
              <span className="text-muted-foreground tabular">
                {upload.done} of {upload.total}
              </span>
            </div>
            <Progress value={(upload.done / upload.total) * 100} className="h-1.5" />
          </div>
        </div>
      )}

      {rows.length === 0 && !upload ? (
        <EmptySheet onFiles={addPhotoRows} onEmptyRows={() => addEmptyRows(5)} onSample={addSampleRows} canSample={!!designs?.some((d) => d.imageIds.length)} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Rows3 className="size-4 text-muted-foreground" />
                {formatNumber(rows.length)} row{rows.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 font-medium text-success">
                <CheckCircle2 className="size-3.5" />
                {formatNumber(readyRows.length)} ready
              </span>
              {attention > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set(rows.filter((r) => (checks.get(r.id)?.errors.length ?? 0) > 0).map((r) => r.id)))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-0.5 font-medium text-destructive hover:ring-1 hover:ring-destructive/30"
                  title="Select the rows that need attention"
                >
                  <TriangleAlert className="size-3.5" />
                  {formatNumber(attention)} need attention
                </button>
              )}
              {warnings > 0 && <span className="hidden text-xs text-muted-foreground sm:inline">{warnings} with warnings</span>}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                {saveState === "saved" ? <CloudCheck className="size-3.5 text-success" /> : <Loader2 className="size-3.5 animate-spin" />}
                {saveState === "saved" ? "Drafts saved in this browser" : "Saving drafts…"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => addEmptyRows(1)}>
                <Plus /> Add row
              </Button>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="sticky top-16 z-30 mb-3">
              <ApplyToolbar
                count={selected.size}
                columns={columns}
                lk={lk}
                onApply={(col, text) => {
                  const label = ALL_COLUMNS.find((c) => c.key === col)!.label.toLowerCase();
                  void commitCells(indexesOf(selected).map((row) => ({ row, col, text })), `Set ${label} to "${text}" for ${selected.size} row${selected.size === 1 ? "" : "s"}`);
                }}
                onAdjust={(col, pct) => {
                  if (col !== "cost" && col !== "mrp" && col !== "price") return;
                  patchRows(new Set(selected), (r) => ({ ...r, [col]: adjustByPercent(r[col], pct) }));
                  toast.success(`${col === "price" ? "Selling price" : col === "mrp" ? "MRP" : "Cost"} ${pct > 0 ? "raised" : "reduced"} by ${Math.abs(pct)}% for ${selected.size} rows`);
                }}
                onDelete={() => void removeRows(new Set(selected))}
                onClear={() => setSelected(new Set())}
              />
            </div>
          )}

          <BulkGrid
            rows={rows}
            columns={columns}
            lk={lk}
            checks={checks}
            skus={skus}
            selected={selected}
            onSelectedChange={setSelected}
            onCommit={(entries, label) => void commitCells(entries, label)}
            onReorder={reorder}
            onPhotoClick={setPhotoRow}
            onPhotoFiles={(id, files) => void addPhotosToRow(id, files)}
          />

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Keyboard className="size-3.5" /> Works like a spreadsheet
            </span>
            <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> <Kbd>←</Kbd> <Kbd>→</Kbd> move</span>
            <span><Kbd>Enter</Kbd> or type to edit</span>
            <span><Kbd>Tab</Kbd> next cell</span>
            <span><Kbd>Ctrl</Kbd> <Kbd>C</Kbd> / <Kbd>V</Kbd> copy, paste from Excel</span>
            <span><Kbd>Ctrl</Kbd> <Kbd>D</Kbd> fill down</span>
            <span><Kbd>Shift</Kbd> click to select a range</span>
            <span>Drop photos on a row to add more angles</span>
          </div>
        </>
      )}

      {fileDrag !== null && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/5 ring-4 ring-primary/40 ring-inset backdrop-blur-[1px]">
          <div className="flex items-center gap-3 rounded-2xl border bg-card px-6 py-4 shadow-xl">
            <ImagePlus className="size-6 text-primary" />
            <div>
              <p className="font-medium">
                Drop {fileDrag > 0 ? `${fileDrag} photo${fileDrag === 1 ? "" : "s"}` : "photos"} to add {fileDrag > 1 ? `${fileDrag} rows` : "rows"}
              </p>
              <p className="text-sm text-muted-foreground">Or drop onto a row&apos;s photo cell to add another angle</p>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!photoDraft} onOpenChange={(o) => !o && setPhotoRow(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Photos for row {photoDraft ? rows.indexOf(photoDraft) + 1 : ""}</DialogTitle>
            <DialogDescription>Add front, pallu and border shots. The first photo is shown on the website, POS and WhatsApp.</DialogDescription>
          </DialogHeader>
          {photoDraft && (
            <ImageManager imageIds={photoDraft.imageIds} onChange={(ids) => patchRows(new Set([photoDraft.id]), (r) => ({ ...r, imageIds: ids }))} emptyHint="No photos yet. The design photos will be used." />
          )}
        </DialogContent>
      </Dialog>

      <SuccessDialog
        result={result}
        onClose={() => setResult(null)}
        onPrint={(skus) => router.push(`/labels?skus=${skus.join(",")}`)}
        onInventory={() => router.push("/inventory")}
      />
      {dialog}
    </>
  );
}

function EmptySheet({ onFiles, onEmptyRows, onSample, canSample }: { onFiles: (files: File[]) => void; onEmptyRows: () => void; onSample: () => void; canSample: boolean }) {
  const steps = [
    { icon: ImagePlus, title: "Drop photos", body: "Drop 50 photos at once. Each becomes a draft row with its colour detected." },
    { icon: Rows3, title: "Fill the sheet", body: "Pick designs, paste from Excel, fill down and set prices for many rows at once." },
    { icon: Printer, title: "Save and print", body: "Every saree gets its own SKU. Print barcode labels in one click." },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div data-dropzone className="lg:col-span-3">
        <PhotoDropzone onFiles={onFiles} label="Drop saree photos here, as many as you like" className="h-full min-h-72 py-16" />
      </div>
      <div className="space-y-3 lg:col-span-2">
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-3 rounded-xl border bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-wine-50 text-primary">
              <s.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">
                {i + 1}. {s.title}
              </p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onEmptyRows}>
            <Plus /> Start with 5 empty rows
          </Button>
          {canSample && (
            <Button variant="ghost" size="sm" onClick={onSample}>
              <Sparkles /> No photos handy? Add sample rows
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessDialog({
  result,
  onClose,
  onPrint,
  onInventory,
}: {
  result: { items: InventoryItem[]; newDesigns: number; imageIds: string[] } | null;
  onClose: () => void;
  onPrint: (skus: string[]) => void;
  onInventory: () => void;
}) {
  const items = result?.items ?? [];
  const skus = items.map((i) => i.sku);
  const range = skus.length === 1 ? skus[0] : `${skus[0]} – ${skus.at(-1)}`;
  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="items-center text-center sm:text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 className="size-6 text-success" />
          </span>
          <DialogTitle className="font-display text-3xl">
            {formatNumber(items.length)} saree{items.length === 1 ? "" : "s"} added
          </DialogTitle>
          <DialogDescription className="font-mono text-sm text-foreground">{range}</DialogDescription>
        </DialogHeader>
        {result && result.imageIds.length > 0 && (
          <div className="flex justify-center -space-x-3">
            {result.imageIds.map((id, i) => (
              <MediaImage key={`${id}-${i}`} id={id} alt="" thumb className="w-12 ring-2 ring-card" rounded="rounded-md" />
            ))}
          </div>
        )}
        <ul className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> Live now on POS, the website and WhatsApp</li>
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> Each saree has its own SKU and movement history</li>
          {result && result.newDesigns > 0 && (
            <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> {result.newDesigns} new design{result.newDesigns === 1 ? "" : "s"} created in Products</li>
          )}
          <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" /> Labels carry the SKU only, so price changes never need reprinting</li>
        </ul>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button size="lg" className="w-full" onClick={() => onPrint(skus)}>
            <Printer /> Print {formatNumber(items.length)} label{items.length === 1 ? "" : "s"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onInventory}>
              View in inventory
            </Button>
            <Button variant="outline" asChild>
              <Link href="/store" target="_blank" rel="noreferrer">
                <Store /> View on website <ExternalLink className="opacity-60" />
              </Link>
            </Button>
          </div>
          <Button variant="ghost" onClick={onClose} className={cn("w-full")}>
            Keep adding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SheetSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-80" />
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
