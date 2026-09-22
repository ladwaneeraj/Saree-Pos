"use client";

import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Plus, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { ImportGrid } from "@/components/purchases/import-grid";
import { ReceivedDialog, type ReceivedInfo } from "@/components/purchases/received-dialog";
import { SupplierDialog } from "@/components/purchases/supplier-dialog";
import { errorMessage } from "@/domain/errors";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { downloadFile, parseCsv } from "@/lib/files";
import { formatINR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IMPORT_TEMPLATE_CSV, importPurchaseRows, mapImportTable, validateImportRows, type ImportColumn, type ImportIssue, type ImportIssueKind, type ImportRow } from "@/services/purchases";

const today = () => new Date().toISOString().slice(0, 10);

async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((row) => row.map((cell) => (cell == null ? "" : cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell))));
  }
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) return parseCsv(await file.text());
  throw new Error("Upload an .xlsx, .csv or .tsv file");
}

export default function ImportPurchasePage() {
  const router = useRouter();
  const catalog = useCatalog();
  const fileRef = useRef<HTMLInputElement>(null);
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(today);
  const [fileName, setFileName] = useState<string | null>(null);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [issues, setIssues] = useState<Map<string, ImportIssue[]>>(new Map());
  const [checking, setChecking] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [received, setReceived] = useState<ReceivedInfo | null>(null);
  const doImport = useAction(importPurchaseRows);

  // Re-validate live as cells change.
  useEffect(() => {
    if (rows.length === 0) return;
    let active = true;
    const id = setTimeout(() => {
      setChecking(true);
      validateImportRows(rows)
        .then((result) => active && setIssues(result))
        .finally(() => active && setChecking(false));
    }, 200);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [rows]);

  const load = async (file: File) => {
    try {
      const table = await readTable(file);
      const mapped = mapImportTable(table);
      if (mapped.rows.length === 0) throw new Error("No rows found. The first row must be the column headers.");
      setIssues(new Map());
      setRows(mapped.rows);
      setUnmapped(mapped.unmapped);
      setFileName(file.name);
      toast.success(`Read ${mapped.rows.length} rows from ${file.name}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const onCell = useCallback((id: string, column: ImportColumn, value: string) => setRows((rs) => rs.map((r) => (r._id === id ? { ...r, [column]: value } : r))), []);
  const onDelete = useCallback((id: string) => setRows((rs) => rs.filter((r) => r._id !== id)), []);

  const stats = useMemo(() => {
    const kinds = (kind: ImportIssueKind) => rows.filter((r) => issues.get(r._id)?.some((i) => i.kind === kind)).length;
    const validated = rows.filter((r) => issues.has(r._id));
    return {
      valid: validated.filter((r) => issues.get(r._id)!.length === 0).length,
      missing: kinds("MISSING"),
      duplicate: kinds("DUPLICATE_SKU"),
      price: kinds("INVALID_PRICE"),
      fabric: kinds("UNKNOWN_FABRIC"),
      pending: rows.length - validated.length,
      pieces: rows.reduce((s, r) => s + (r.sku ? 1 : Math.max(0, Number(r.quantity) || 0)), 0),
      cost: rows.reduce((s, r) => s + (r.sku ? 1 : Math.max(0, Number(r.quantity) || 0)) * (Number(r.cost.replace(/[₹,\s]/g, "")) || 0), 0),
    };
  }, [rows, issues]);
  const invalidCount = rows.length - stats.valid - stats.pending;
  const visibleRows = onlyProblems ? rows.filter((r) => (issues.get(r._id)?.length ?? 0) > 0) : rows;
  const canImport = rows.length > 0 && stats.pending === 0 && invalidCount === 0 && !checking && !!supplierId && !!invoice.trim();

  const submit = async () => {
    const result = await doImport.run({ supplierId, invoiceNumber: invoice, date: new Date(`${date}T11:00:00`).getTime(), rows });
    if (result) setReceived({ purchaseId: result.purchase.id, number: result.purchase.number, pieces: result.items.length, totalCost: result.purchase.totalCost, firstSku: result.items[0]?.sku, lastSku: result.items.at(-1)?.sku });
  };

  return (
    <>
      <PageHeader
        back={{ href: "/purchases", label: "Purchases" }}
        title="Import Excel / CSV"
        description="Bring a supplier's packing list in one go. Every row is checked before anything is saved."
        actions={
          <Button variant="outline" onClick={() => downloadFile("dhanvi-purchase-import-template.csv", IMPORT_TEMPLATE_CSV)}>
            <Download /> Download template
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <h2 className="mb-4 text-sm font-semibold"><span className="mr-2 text-muted-foreground">1</span>Supplier invoice</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Supplier</Label>
              <div className="flex gap-2">
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full min-w-0 bg-card"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
                  <SelectContent>
                    {catalog?.suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setSupplierOpen(true)}><Plus /> Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice">Invoice number</Label>
              <Input id="invoice" value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="KSC/2026/882" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Purchase date</Label>
              <Input id="date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
          <h2 className="mb-4 text-sm font-semibold"><span className="mr-2 text-muted-foreground">2</span>Upload file</h2>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) void load(file);
            }}
            className={cn("flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors hover:border-primary/40 hover:bg-wine-50/40", dragging && "border-primary bg-wine-50")}
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-wine-50 text-primary">
              {fileName ? <FileSpreadsheet className="size-5" /> : <Upload className="size-5" />}
            </span>
            {fileName ? (
              <>
                <span className="font-medium">{fileName}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(rows.length)} rows · click or drop to replace</span>
              </>
            ) : (
              <>
                <span className="font-medium">Drop an Excel or CSV file, or click to choose</span>
                <span className="text-xs text-muted-foreground">.xlsx, .csv or .tsv · columns: SKU, Design, Colour, Fabric, Collection, Quantity, Cost, MRP, Selling Price, Rack</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
          {unmapped.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Ignored columns: {unmapped.join(", ")}</p>}
        </section>
      </div>

      {rows.length > 0 && (
        <section className="mt-6">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-1 text-sm font-semibold"><span className="mr-2 text-muted-foreground">3</span>Check and fix</h2>
              <Chip tone="success" icon={<CheckCircle2 className="size-3.5" />}>{stats.valid} valid rows</Chip>
              <Chip tone={stats.missing ? "warning" : "muted"} icon={<AlertTriangle className="size-3.5" />}>{stats.missing} missing values</Chip>
              <Chip tone={stats.duplicate ? "warning" : "muted"} icon={<AlertTriangle className="size-3.5" />}>{stats.duplicate} duplicate SKUs</Chip>
              <Chip tone={stats.price ? "warning" : "muted"} icon={<AlertTriangle className="size-3.5" />}>{stats.price} invalid prices</Chip>
              {stats.fabric > 0 && <Chip tone="warning" icon={<AlertTriangle className="size-3.5" />}>{stats.fabric} unknown fabrics</Chip>}
              {checking && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><RefreshCw className="size-3 animate-spin" /> Checking</span>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={onlyProblems} onCheckedChange={setOnlyProblems} />
              Only rows with problems
            </label>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Click any cell to edit. Rows are re-checked as you type. Hover a red cell to see what is wrong.</p>
          {visibleRows.length ? (
            <ImportGrid rows={visibleRows} issues={issues} onChange={onCell} onDelete={onDelete} />
          ) : (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">No problems left. Every row is ready to import.</div>
          )}

          <div className="sticky bottom-20 z-10 mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
            <div className="text-sm">
              <span className="font-semibold tabular">{formatNumber(stats.pieces)} pieces</span>
              <span className="text-muted-foreground"> · {formatINR(stats.cost)} at cost · {rows.length} rows</span>
              {!canImport && (
                <div className="text-xs text-muted-foreground">
                  {invalidCount > 0 ? `Fix ${invalidCount} ${invalidCount === 1 ? "row" : "rows"} to continue` : !supplierId ? "Choose a supplier to continue" : !invoice.trim() ? "Enter the invoice number to continue" : "Checking rows…"}
                </div>
              )}
            </div>
            <Button size="lg" disabled={!canImport || doImport.pending} onClick={submit}>
              <Upload /> {doImport.pending ? "Importing…" : `Import ${formatNumber(stats.pieces)} pieces`}
            </Button>
          </div>
        </section>
      )}

      <SupplierDialog open={supplierOpen} onOpenChange={setSupplierOpen} onCreated={(s) => setSupplierId(s.id)} />
      <ReceivedDialog info={received} canSeeCost onClose={() => router.push(received ? `/purchases/${received.purchaseId}` : "/purchases")} />
    </>
  );
}

function Chip({ tone, icon, children }: { tone: "success" | "warning" | "muted"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset tabular",
        tone === "success" && "bg-success-soft text-success ring-success/20",
        tone === "warning" && "bg-warning-soft text-[oklch(0.5_0.12_65)] ring-warning/25",
        tone === "muted" && "bg-muted text-muted-foreground ring-border",
      )}
    >
      {icon}
      {children}
    </span>
  );
}
