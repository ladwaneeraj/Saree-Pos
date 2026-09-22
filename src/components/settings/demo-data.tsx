"use client";

import { Download, RotateCcw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { errorMessage } from "@/domain/errors";
import { useLive } from "@/hooks/use-live";
import { downloadFile } from "@/lib/files";
import { formatDateTime } from "@/lib/format";
import { exportDemoData, getSeededAt, importDemoData, resetDemoData } from "@/services/demo";
import { SettingsCard } from "./settings-kit";

export function DemoData() {
  const { data: seededAt } = useLive(getSeededAt, []);
  const { confirm, dialog } = useConfirm();
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (first: string, work: (onProgress: (s: string) => void) => Promise<void>) => {
    setProgress(first);
    try {
      await work(setProgress);
      setProgress("Done. Reloading");
      setTimeout(() => window.location.reload(), 400);
    } catch (e) {
      setProgress(null);
      toast.error(errorMessage(e));
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Reset demo data?",
      description: "Everything in this browser is cleared: orders, stock changes, customers, settings and photos you added. A fresh demo shop is created with dates relative to today.",
      confirmLabel: "Reset demo data",
      destructive: true,
    });
    if (ok) await run("Clearing this browser's data", (p) => resetDemoData(p));
  };

  const exportJson = async () => {
    try {
      const json = await exportDemoData();
      downloadFile(`dhanvi-silks-demo-${new Date().toISOString().slice(0, 10)}.json`, json, "application/json");
      toast.success("Demo data exported");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const importFile = async (file: File) => {
    const ok = await confirm({ title: `Import ${file.name}?`, description: "This replaces all data in this browser with the contents of the file.", confirmLabel: "Replace and import", destructive: true });
    if (!ok) return;
    await run("Reading file", async (p) => {
      const text = await file.text();
      p("Importing demo data");
      await importDemoData(text);
    });
  };

  return (
    <div className="space-y-5">
      <SettingsCard title="Demo data" description={<>Everything lives in this browser (IndexedDB). {seededAt ? <>Current demo created {formatDateTime(seededAt)}.</> : null}</>}>
        <div className="divide-y">
          <Row title="Reset demo data" description="Start over with a fresh shop: over 50 designs, thousands of pieces, months of orders and customers, dated relative to today." action={<Button variant="destructive" onClick={reset}><RotateCcw /> Reset demo data</Button>} />
          <Row title="Export demo data" description="Download everything as a JSON file to keep a prepared demo or move it to another laptop." action={<Button variant="outline" onClick={exportJson}><Download /> Export JSON</Button>} />
          <Row
            title="Import demo data"
            description="Load a JSON file exported from this demo. It replaces the current data."
            action={
              <>
                <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Import JSON</Button>
                <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void importFile(f); }} />
              </>
            }
          />
        </div>
      </SettingsCard>
      {dialog}
      <Dialog open={!!progress}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader className="items-center text-center sm:text-center">
            <Spinner className="mb-2 size-7 text-primary" />
            <DialogTitle>Preparing your demo shop</DialogTitle>
            <DialogDescription>{progress}…</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-lg">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
