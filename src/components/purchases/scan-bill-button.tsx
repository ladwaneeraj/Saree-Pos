"use client";

import { Loader2, ScanLine } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/domain/errors";
import { useSettings } from "@/hooks/use-catalog";
import { scanSupplierBill, type ScannedBill } from "@/services/bill-scan";

/** Picks a photo or PDF of the supplier bill and hands the extracted fields to the form. */
export function ScanBillButton({ onScanned, disabled }: { onScanned: (bill: ScannedBill) => void | Promise<void>; disabled?: boolean }) {
  const settings = useSettings();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const ready = !!settings?.ai.anthropicApiKey;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const bill = await scanSupplierBill(file);
      await onScanned(bill);
      toast.success(`Read ${bill.lines.length} line${bill.lines.length === 1 ? "" : "s"} from the bill`, {
        description: bill.notes ? `Check: ${bill.notes}` : "Check every field before saving. Colours and racks still need choosing.",
        duration: 8000,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <Button type="button" variant="outline" disabled={disabled || busy || !settings} onClick={() => (ready ? input.current?.click() : toast.error("Add your Claude API key first", { description: "Settings → AI. The key stays on this computer." }))}>
        {busy ? <Loader2 className="animate-spin" /> : <ScanLine />} {busy ? "Reading bill…" : "Scan bill"}
      </Button>
      {settings && !ready && (
        <Link href="/settings?tab=ai" className="text-xs text-primary hover:underline">Set up AI key</Link>
      )}
    </div>
  );
}
