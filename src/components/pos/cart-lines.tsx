"use client";

import { Clock, Minus, Plus, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatCountdown, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HeldLine } from "@/services/reservations";
import { MediaImage } from "@/components/shared/media-image";
import { ColourDot } from "@/components/shared/misc";
import { usePosDraft } from "./pos-store";
import { usePosActions } from "./use-pos-actions";

interface LineGroup {
  key: string;
  lines: HeldLine[];
}

function groupLines(lines: HeldLine[]): LineGroup[] {
  const groups = new Map<string, HeldLine[]>();
  for (const l of lines) {
    const key = `${l.design.id}:${l.item.colourId}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.entries()].map(([key, lines]) => ({ key, lines }));
}

export function CartLines({ lines }: { lines: HeldLine[] }) {
  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-wine-50 text-primary"><ScanLine className="size-7" /></div>
        <div className="space-y-1">
          <p className="font-medium">Scan a saree to start the bill</p>
          <p className="text-sm text-muted-foreground">Or pick one from the catalogue. Pieces in this bill are held so the website cannot sell them.</p>
        </div>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      <style>{`@keyframes pos-flash{0%{background:var(--success-soft)}100%{background:transparent}}`}</style>
      {groupLines(lines).map((g) => <GroupRow key={g.key} group={g} />)}
    </ul>
  );
}

function GroupRow({ group }: { group: LineGroup }) {
  const first = group.lines[0]!;
  const { addAnother, remove, pending } = usePosActions();
  const lastAddedId = usePosDraft((s) => s.lastAddedId);
  const highlight = group.lines.some((l) => l.item.id === lastAddedId);

  const newest = [...group.lines].sort((a, b) => (b.item.reservation?.reservedAt ?? 0) - (a.item.reservation?.reservedAt ?? 0))[0]!;

  return (
    <li className="relative isolate px-4 py-3 sm:px-5" data-testid="pos-line">
      {highlight && <span key={lastAddedId} aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ animation: "pos-flash 1.4s ease-out forwards" }} />}
      <div className="flex gap-3">
        <MediaImage id={first.imageId} alt={first.design.name} thumb className="w-12 shrink-0" rounded="rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{first.design.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ColourDot hex={first.colour?.hex ?? "#999"} className="size-2.5" />
            <span className="truncate">{first.colour?.name} · {first.fabricName}</span>
          </div>
        </div>
        <div className="flex h-8 items-center rounded-lg border bg-card">
          <Button variant="ghost" size="icon-sm" className="size-7" disabled={pending} onClick={() => remove(newest.item.id)} aria-label="Remove one">
            <Minus />
          </Button>
          <span className="w-6 text-center text-sm font-semibold tabular" data-testid="pos-qty">{group.lines.length}</span>
          <Button variant="ghost" size="icon-sm" className="size-7" disabled={pending} onClick={() => addAnother(first.design.id, first.item.colourId)} aria-label="Add another piece of this design and colour">
            <Plus />
          </Button>
        </div>
      </div>
      <ul className="mt-2 ml-6 space-y-1.5 border-l pl-3">
        {group.lines.map((l) => <PieceRow key={l.item.id} line={l} onRemove={() => remove(l.item.id)} />)}
      </ul>
    </li>
  );
}

function PieceRow({ line, onRemove }: { line: HeldLine; onRemove: () => void }) {
  const discount = usePosDraft((s) => s.lineDiscounts[line.item.id] ?? 0);
  const setLineDiscount = usePosDraft((s) => s.setLineDiscount);
  const net = Math.max(0, line.price - discount);
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="font-mono text-[12px] font-medium whitespace-nowrap text-foreground">{line.item.sku}</span>
      <HoldTimer expiresAt={line.expiresAt} />
      <label className="ml-auto flex h-7 items-center gap-0.5 rounded-md border bg-card px-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30" title="Discount on this piece">
        <span className="whitespace-nowrap text-muted-foreground">−₹</span>
        <input
          inputMode="numeric"
          value={discount || ""}
          placeholder="0"
          onChange={(e) => setLineDiscount(line.item.id, Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, line.price))}
          className="w-11 bg-transparent text-right tabular outline-none"
          aria-label={`Discount on ${line.item.sku}`}
        />
      </label>
      <div className="w-16 text-right leading-tight">
        <div className="text-[13px] font-semibold text-foreground tabular">{formatINR(net)}</div>
        {discount > 0 && <div className="text-[11px] text-muted-foreground line-through tabular">{formatINR(line.price)}</div>}
      </div>
      <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Remove ${line.item.sku}`}>
        <Trash2 />
      </Button>
    </li>
  );
}

function HoldTimer({ expiresAt }: { expiresAt: number | null }) {
  const now = useNow(1000);
  if (!expiresAt) return null;
  const left = expiresAt - now;
  const low = left < 5 * 60_000;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1 whitespace-nowrap tabular", low ? "bg-warning-soft text-[oklch(0.5_0.12_65)]" : "text-muted-foreground")} title="Counter hold. The piece returns to stock if the bill is not completed in time.">
      <Clock className="size-3" />
      {left > 0 ? formatCountdown(left) : "expired"}
    </span>
  );
}
