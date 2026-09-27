"use client";

import { Info, Minus, Plus, Printer, SearchX, Tag } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label as FieldLabel } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatNumber } from "@/lib/format";
import { getLabelsFor } from "@/services/inventory";
import { DEFAULT_SETTINGS } from "@/services/settings-defaults";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { LABEL_SIZES, LabelPages, Label, type LabelOptions, type LabelSize } from "./label-sheet";

export function LabelsView() {
  const params = useSearchParams();
  const router = useRouter();
  const skuParam = params.get("skus") ?? "";
  const purchaseId = params.get("purchase") ?? "";
  const skus = skuParam.split(",").map((s) => s.trim()).filter(Boolean);
  const settings = useSettings();
  const { data: labels } = useLive(() => getLabelsFor({ skus, purchaseId: purchaseId || undefined }), [skuParam, purchaseId]);
  const [override, setOverride] = useState<Partial<LabelOptions>>({});
  const [copies, setCopies] = useState(1);
  const [addSku, setAddSku] = useState("");

  const options: LabelOptions = {
    ...DEFAULT_SETTINGS.labels,
    ...settings?.labels,
    ...override,
    headerText: override.headerText ?? (settings?.labels.headerText || settings?.business.name || ""),
  };
  const printable = (labels ?? []).flatMap((l) => Array.from({ length: copies }, () => l));
  const missing = labels ? skus.filter((s) => !labels.some((l) => l.sku === s.toUpperCase())) : [];
  const dims = LABEL_SIZES[options.size];
  const pageCss =
    options.size === "THERMAL_50x25"
      ? "@page { size: 50mm 25mm; margin: 0; }"
      : "@page { size: A4; margin: 0; }";

  const addSkus = () => {
    const extra = addSku.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (!extra.length) return;
    const next = [...new Set([...(labels ?? []).map((l) => l.sku), ...extra])];
    setAddSku("");
    router.replace(`/labels?skus=${next.join(",")}`);
  };

  return (
    <>
      <style>{`
        .label-print-root { display: none; }
        @media print {
          ${pageCss}
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body > *:not(.label-print-root) { display: none !important; }
          .label-print-root { display: block !important; }
          .label-page { break-after: page; page-break-after: always; overflow: hidden; }
          .label-page:last-child { break-after: auto; page-break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Print labels"
          description={
            labels ? (
              <>
                {formatNumber(printable.length)} label{printable.length === 1 ? "" : "s"} · {dims.name}
                {purchaseId && " · from purchase batch"}
              </>
            ) : (
              "Loading labels…"
            )
          }
          actions={
            <Button size="lg" onClick={() => window.print()} disabled={!printable.length}>
              <Printer /> Print {printable.length ? formatNumber(printable.length) : ""} label{printable.length === 1 ? "" : "s"}
            </Button>
          }
        />

        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/15 bg-wine-50 p-3.5 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-medium">The barcode carries the SKU only.</span> Prices are looked up at billing, so a label still scans after a price change. Change what is printed under Settings → Labels.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
          <aside className="space-y-5 lg:col-span-4 xl:col-span-3">
            <div className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
              <div className="space-y-2">
                <FieldLabel>Label size</FieldLabel>
                <ToggleGroup type="single" variant="outline" value={options.size} onValueChange={(v) => v && setOverride((o) => ({ ...o, size: v as LabelSize }))} className="grid w-full grid-cols-2">
                  <ToggleGroupItem value="THERMAL_50x25">Thermal</ToggleGroupItem>
                  <ToggleGroupItem value="A4_3x8">A4 sheet</ToggleGroupItem>
                </ToggleGroup>
                <p className="text-xs text-muted-foreground">{dims.hint}</p>
              </div>
              <div className="space-y-2">
                <FieldLabel>Copies of each label</FieldLabel>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon-sm" onClick={() => setCopies((c) => Math.max(1, c - 1))} aria-label="Fewer copies">
                    <Minus />
                  </Button>
                  <span className="w-8 text-center font-medium tabular">{copies}</span>
                  <Button variant="outline" size="icon-sm" onClick={() => setCopies((c) => Math.min(10, c + 1))} aria-label="More copies">
                    <Plus />
                  </Button>
                </div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <label className="flex items-center justify-between gap-3 text-sm">
                  Show design name
                  <Switch checked={options.showDesignName} onCheckedChange={(v) => setOverride((o) => ({ ...o, showDesignName: v }))} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Show colour
                  <Switch checked={options.showColour} onCheckedChange={(v) => setOverride((o) => ({ ...o, showColour: v }))} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Show price
                  <Switch checked={options.showPrice} onCheckedChange={(v) => setOverride((o) => ({ ...o, showPrice: v }))} />
                </label>
              </div>
              <div className="space-y-2 border-t pt-4">
                <FieldLabel htmlFor="add-sku">Reprint another SKU</FieldLabel>
                <div className="flex gap-2">
                  <Input id="add-sku" value={addSku} onChange={(e) => setAddSku(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && addSkus()} placeholder="SAR-00184" className="font-mono" />
                  <Button variant="outline" onClick={addSkus}>
                    Add
                  </Button>
                </div>
              </div>
            </div>
            {missing.length > 0 && (
              <p className="rounded-lg bg-warning-soft p-3 text-xs">
                Not found: <span className="font-mono">{missing.join(", ")}</span>
              </p>
            )}
          </aside>

          <section className="lg:col-span-8 xl:col-span-9">
            {!labels ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
            ) : labels.length === 0 ? (
              <EmptyState icon={skus.length || purchaseId ? SearchX : Tag} title={skus.length || purchaseId ? "No pieces found for these labels" : "No labels selected"} description="Select pieces in Inventory and choose Print labels, or type a SKU on the left." />
            ) : options.size === "THERMAL_50x25" ? (
              <div className="rounded-xl border bg-muted/40 p-4 sm:p-6">
                <div className="flex flex-wrap gap-3 [zoom:1.35]">
                  {printable.map((l, i) => (
                    <div key={`${l.itemId}-${i}`} className="rounded-sm shadow-sm ring-1 ring-black/10">
                      <Label label={l} options={options} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border bg-muted/40 p-4 sm:p-6">
                <div className="mx-auto w-fit space-y-6 [&_.label-page]:shadow-md [&_.label-page]:ring-1 [&_.label-page]:ring-black/5 [&_.label-page>div]:outline [&_.label-page>div]:outline-1 [&_.label-page>div]:-outline-offset-1 [&_.label-page>div]:outline-dashed [&_.label-page>div]:outline-black/10">
                  <LabelPages labels={printable} options={options} />
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* The data provider renders pages on the client only, so document is always available here. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="label-print-root">
            <LabelPages labels={printable} options={options} />
          </div>,
          document.body,
        )}
    </>
  );
}
