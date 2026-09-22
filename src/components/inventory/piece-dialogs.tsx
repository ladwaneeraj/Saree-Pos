"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { formatINR } from "@/lib/format";
import { markDamaged, moveItems, restoreDamaged, type InventoryDetail } from "@/services/inventory";
import { setPiecePrice } from "@/services/pricing";

interface DialogProps {
  detail: InventoryDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const digits = (v: string) => v.replace(/\D/g, "");

export function PriceOverrideDialog({ detail, open, onOpenChange }: DialogProps) {
  const [value, setValue] = useState("");
  const { run, pending } = useAction(setPiecePrice, { success: "Price updated on every channel" });
  const price = Number(value);
  const invalid = !value || price <= 0 || price > detail.mrp;

  const submit = async (next: number | null) => {
    if ((await run([detail.item.id], next)) !== undefined) {
      setValue("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Individual price for {detail.item.sku}</DialogTitle>
          <DialogDescription>
            Overrides the design price ({formatINR(detail.design.price)}) for this saree only. POS, website and WhatsApp show it at once. SKU and barcode stay the same, so no reprinting.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="piece-price">Selling price (₹)</Label>
          <Input id="piece-price" autoFocus inputMode="numeric" placeholder={String(detail.price)} value={value} onChange={(e) => setValue(digits(e.target.value))} onKeyDown={(e) => e.key === "Enter" && !invalid && submit(price)} />
          <p className="text-xs text-muted-foreground">
            MRP {formatINR(detail.mrp)}
            {value && price > detail.mrp && <span className="text-destructive"> · price cannot be above MRP</span>}
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {detail.priceSource === "OVERRIDE" ? (
            <Button variant="ghost" disabled={pending} onClick={() => submit(null)}>
              Follow design price ({formatINR(detail.design.price)})
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={invalid || pending} onClick={() => submit(price)}>
              Set price
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RackDialog({ detail, open, onOpenChange, locations }: DialogProps & { locations: string[] }) {
  const [value, setValue] = useState("");
  const { run, pending } = useAction(moveItems, { success: "Rack updated" });
  const submit = async () => {
    if ((await run([detail.item.id], value)) !== undefined) {
      setValue("");
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Move to another rack</DialogTitle>
          <DialogDescription>Currently at rack {detail.item.location}. The move is recorded in the piece history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="rack">Rack / location</Label>
          <Input id="rack" autoFocus list="rack-options" placeholder="B-14" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && value.trim() && submit()} />
          <datalist id="rack-options">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!value.trim() || pending} onClick={submit}>
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DamageDialog({ detail, open, onOpenChange }: DialogProps) {
  const restoring = detail.item.status === "DAMAGED";
  const [note, setNote] = useState("");
  const damage = useAction(markDamaged, { success: `${detail.item.sku} marked damaged` });
  const restore = useAction(restoreDamaged, { success: `${detail.item.sku} is available again` });
  const submit = async () => {
    const ok = restoring ? await restore.run(detail.item.id, note) : await damage.run([detail.item.id], note);
    if (ok !== undefined) {
      setNote("");
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{restoring ? "Restore to stock" : "Mark as damaged"}</DialogTitle>
          <DialogDescription>
            {restoring ? "The saree becomes available on POS, website and WhatsApp again." : "Damaged pieces are hidden from every sales channel until restored."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="damage-note">{restoring ? "Note" : "What is wrong?"}</Label>
          <Textarea id="damage-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={restoring ? "Stain removed by dry cleaner" : "Pulled thread near the pallu"} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={restoring ? "default" : "destructive"} disabled={damage.pending || restore.pending} onClick={submit}>
            {restoring ? "Restore" : "Mark damaged"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
