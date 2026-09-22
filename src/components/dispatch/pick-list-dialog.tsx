"use client";

import { MapPin, PackageCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { MediaImage } from "@/components/shared/media-image";
import { markReadyToDispatch } from "@/services/dispatch";
import { useOrderAction } from "@/components/orders/use-order-action";
import { cn } from "@/lib/utils";

export interface PickLine {
  id: string;
  sku: string;
  designName: string;
  colourName: string;
  imageId: string | null;
  location: string | null;
}

export interface PickTarget {
  id: string;
  number: number;
  customerName: string;
  lines: PickLine[];
}

/** Pick list with a checkbox per piece. Marking ready is enabled once every piece is ticked. */
export function PickListDialog({ target, open, onOpenChange }: { target: PickTarget | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{target && <PickList key={target.id} target={target} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function PickList({ target, onDone }: { target: PickTarget; onDone: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const { run, pending } = useOrderAction(markReadyToDispatch, `Order #${target.number} packed and ready`);
  const lines = [...target.lines].sort((a, b) => (a.location ?? "").localeCompare(b.location ?? ""));
  const done = picked.size === lines.length;

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Pick list · order #{target.number}</DialogTitle>
        <DialogDescription>
          {target.customerName}. Collect each saree from its rack, check the SKU tag and tick it off.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Progress value={(picked.size / Math.max(1, lines.length)) * 100} className="h-1.5" />
          <span className="shrink-0 tabular">
            {picked.size} / {lines.length} picked
          </span>
        </div>
        <ul className="divide-y rounded-lg border">
          {lines.map((l) => {
            const checked = picked.has(l.id);
            return (
              <li key={l.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent/50", checked && "bg-success-soft/60")}>
                  <Checkbox checked={checked} onCheckedChange={() => toggle(l.id)} aria-label={`Picked ${l.sku}`} />
                  <MediaImage id={l.imageId} alt={l.designName} thumb className="w-10 shrink-0" rounded="rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className={cn("font-mono text-sm font-medium", checked && "line-through opacity-60")}>{l.sku}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {l.designName} · {l.colourName}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-wine-50 px-2 py-1 font-mono text-xs font-semibold text-primary">
                    <MapPin className="size-3" />
                    {l.location || "No rack"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Continue later
        </Button>
        <Button
          disabled={!done || pending}
          onClick={async () => {
            if (await run(target.id)) onDone();
          }}
        >
          <PackageCheck /> Mark ready to dispatch
        </Button>
      </DialogFooter>
    </>
  );
}
