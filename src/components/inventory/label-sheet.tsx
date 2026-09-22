import type { LabelData } from "@/services/inventory";
import type { LabelSettings } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Barcode } from "@/components/shared/barcode";

export type LabelSize = LabelSettings["size"];

export const LABEL_SIZES: Record<LabelSize, { name: string; hint: string; width: string; height: string }> = {
  THERMAL_50x25: { name: "Thermal 50 × 25 mm", hint: "One label per sticker on a roll printer", width: "50mm", height: "25mm" },
  A4_3x8: { name: "A4 sheet, 3 × 8", hint: "24 labels per A4 sticker sheet", width: "70mm", height: "37.125mm" },
};

export interface LabelOptions {
  size: LabelSize;
  showDesignName: boolean;
  showColour: boolean;
}

/** One sticker. Carries the SKU barcode only, never a price. */
export function Label({ label, options }: { label: LabelData; options: LabelOptions }) {
  const dims = LABEL_SIZES[options.size];
  const a4 = options.size === "A4_3x8";
  return (
    <div
      className={cn("flex flex-col items-center justify-center overflow-hidden bg-white text-black", a4 ? "gap-[1mm] px-[4mm] py-[2.5mm]" : "gap-[0.5mm] px-[2.5mm] py-[1.2mm]")}
      style={{ width: dims.width, height: dims.height }}
    >
      <div className={cn("flex w-full items-baseline justify-between gap-[1mm] leading-none", a4 ? "text-[7.5pt]" : "text-[6pt]")}>
        <span className="shrink-0 font-semibold tracking-[0.08em]">DHANVI SILKS</span>
        {options.showColour && label.colourName && <span className="truncate">{label.colourName}</span>}
      </div>
      {options.showDesignName && label.designName && (
        <div className={cn("w-full truncate text-center leading-tight", a4 ? "text-[8pt]" : "text-[6.5pt]")}>{label.designName}</div>
      )}
      <Barcode value={label.sku} height={a4 ? 58 : 50} moduleWidth={1.6} className={cn("h-auto w-full", a4 ? "max-h-[15mm]" : "max-h-[10.5mm]")} />
      <div className={cn("font-mono leading-none font-bold tracking-[0.12em]", a4 ? "text-[11pt]" : "text-[9pt]")}>{label.sku}</div>
    </div>
  );
}

/** All labels laid out for printing: one per page on thermal, 24 per A4 page on sheets. */
export function LabelPages({ labels, options }: { labels: LabelData[]; options: LabelOptions }) {
  if (options.size === "THERMAL_50x25") {
    return (
      <>
        {labels.map((l, i) => (
          <div key={`${l.itemId}-${i}`} className="label-page">
            <Label label={l} options={options} />
          </div>
        ))}
      </>
    );
  }
  const pages: LabelData[][] = [];
  for (let i = 0; i < labels.length; i += 24) pages.push(labels.slice(i, i + 24));
  return (
    <>
      {pages.map((page, p) => (
        <div key={p} className="label-page grid grid-cols-3 content-start bg-white" style={{ width: "210mm", height: "297mm", gridAutoRows: "37.125mm" }}>
          {page.map((l, i) => (
            <Label key={`${l.itemId}-${i}`} label={l} options={options} />
          ))}
        </div>
      ))}
    </>
  );
}
