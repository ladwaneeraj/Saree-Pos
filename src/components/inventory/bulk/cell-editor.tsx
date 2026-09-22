"use client";

import { Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ColourDot } from "@/components/shared/misc";
import type { ColDef, Lookups } from "./sheet";

export type EditorExit = "down" | "up" | "right" | "left" | "stay" | "cancel";

interface Option {
  label: string;
  sub?: string;
  hex?: string;
}

function optionsFor(col: ColDef, lk: Lookups): Option[] {
  switch (col.key) {
    case "design":
      return lk.designs.map((d) => ({ label: d.name, sub: d.code }));
    case "colour":
      return lk.colours.map((c) => ({ label: c.name, hex: c.hex }));
    case "fabric":
      return lk.fabrics.map((f) => ({ label: f.name }));
    case "collection":
      return lk.collections.map((c) => ({ label: c.name }));
    default:
      return [];
  }
}

const CREATE_LABEL: Partial<Record<ColDef["key"], string>> = { design: "New design", colour: "Add colour", fabric: "Add fabric", collection: "Add collection" };

/** In-cell editor. Combo columns get an autocomplete list rendered in a portal so it is never clipped. */
export function CellEditor({
  col,
  lk,
  initial,
  seeded,
  anchor,
  onDone,
}: {
  col: ColDef;
  lk: Lookups;
  initial: string;
  /** True when editing started by typing a character, which replaces the value. */
  seeded: boolean;
  anchor: HTMLElement | null;
  onDone: (value: string | null, exit: EditorExit) => void;
}) {
  const [text, setText] = useState(initial);
  const [highlight, setHighlight] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const all = useMemo(() => optionsFor(col, lk), [col, lk]);
  const isCombo = col.kind === "combo";

  const q = text.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!isCombo) return [];
    if (!q) return all.slice(0, 50);
    const starts = all.filter((o) => o.label.toLowerCase().startsWith(q) || o.sub?.toLowerCase().startsWith(q));
    const contains = all.filter((o) => !starts.includes(o) && o.label.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 50);
  }, [all, q, isCombo]);
  const exact = matches.some((o) => o.label.toLowerCase() === q);

  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    if (seeded) el.setSelectionRange(el.value.length, el.value.length);
    else el.select();
  }, [seeded]);

  useLayoutEffect(() => {
    if (!isCombo || !anchor) return;
    const update = () => setRect(anchor.getBoundingClientRect());
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchor, isCombo]);

  const finish = (value: string | null, exit: EditorExit) => {
    if (done.current) return;
    done.current = true;
    onDone(value, exit);
  };
  const chosen = () => (highlight >= 0 && matches[highlight] ? matches[highlight]!.label : text);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCombo && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, Math.min(matches.length - 1, h + (e.key === "ArrowDown" ? 1 : -1))));
      return;
    }
    if (!isCombo && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      finish(text, e.key === "ArrowDown" ? "down" : "up");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      finish(chosen(), e.shiftKey ? "up" : "down");
    } else if (e.key === "Tab") {
      e.preventDefault();
      finish(chosen(), e.shiftKey ? "left" : "right");
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(null, "cancel");
    }
    e.stopPropagation();
  };

  return (
    <>
      <input
        ref={input}
        value={text}
        inputMode={col.kind === "number" ? "numeric" : undefined}
        onChange={(e) => {
          const v = col.kind === "number" ? e.target.value.replace(/[^\d]/g, "") : col.key === "location" ? e.target.value.toUpperCase() : e.target.value;
          setText(v);
          if (isCombo) {
            const lower = v.trim().toLowerCase();
            const idx = lower ? all.filter((o) => o.label.toLowerCase().startsWith(lower) || o.sub?.toLowerCase().startsWith(lower)).length : 0;
            setHighlight(lower && idx > 0 ? 0 : -1);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => finish(text === initial ? null : text, "stay")}
        className={cn("absolute inset-0 z-10 h-full w-full bg-card px-2 text-[13px] outline-none ring-2 ring-primary ring-inset", col.align === "right" && "text-right tabular")}
        aria-label={`Edit ${col.label}`}
      />
      {isCombo &&
        rect &&
        createPortal(
          <div
            className="fixed z-50 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 text-sm shadow-lg"
            style={{ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {q && !exact && (
              <button
                type="button"
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", highlight === -1 && "bg-accent")}
                onClick={() => finish(text, "down")}
              >
                <Plus className="size-3.5 text-primary" />
                <span className="text-muted-foreground">{CREATE_LABEL[col.key]}</span>
                <span className="truncate font-medium">&ldquo;{text.trim()}&rdquo;</span>
              </button>
            )}
            {matches.map((o, i) => (
              <button
                key={o.label}
                type="button"
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left", i === highlight ? "bg-accent" : "hover:bg-accent/60")}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => finish(o.label, "down")}
              >
                {o.hex && <ColourDot hex={o.hex} className="size-3.5" />}
                <span className="truncate">{o.label}</span>
                {o.sub && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.sub}</span>}
              </button>
            ))}
            {matches.length === 0 && !q && <p className="px-2 py-1.5 text-muted-foreground">Nothing to choose yet</p>}
          </div>,
          document.body,
        )}
    </>
  );
}
