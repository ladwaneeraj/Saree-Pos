"use client";

import { useEffect, useRef } from "react";

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * USB barcode scanners type the code very fast and press Enter. This listens globally so a scan
 * works even when no input has focus. Keystrokes typed into inputs are left to the input.
 */
export function useBarcodeScanner(onScan: (code: string) => void, { minLength = 5, maxGapMs = 60 } = {}) {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  });

  useEffect(() => {
    let buffer = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
      const t = performance.now();
      if (t - last > maxGapMs) buffer = "";
      last = t;
      if (e.key === "Enter") {
        if (buffer.length >= minLength) {
          e.preventDefault();
          handler.current(buffer);
        }
        buffer = "";
        return;
      }
      if (e.key.length === 1) {
        buffer += e.key;
        // Stop the admin's single-key shortcuts from firing mid-scan.
        if (buffer.length > 1) e.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [minLength, maxGapMs]);
}
