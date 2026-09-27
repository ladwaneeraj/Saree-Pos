"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { createDesign } from "@/services/catalog";
import { BorderSelect, CollectionPicker, PatternSelect } from "./design-pickers";

const EMPTY = { name: "", fabricId: "", collectionIds: [] as string[], pattern: "", border: "", mrp: "", price: "" };

export function NewDesignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const catalog = useCatalog();
  const [v, setV] = useState(EMPTY);
  const { run, pending } = useAction(createDesign, { success: (d) => `${d.name} created as ${d.code}` });
  const set = <K extends keyof typeof EMPTY>(k: K, value: (typeof EMPTY)[K]) => setV((s) => ({ ...s, [k]: value }));
  const price = Number(v.price) || 0;
  const mrp = Number(v.mrp) || 0;
  const priceError = price && mrp && price > mrp ? "Selling price cannot be above MRP" : "";
  const valid = v.name.trim() && v.fabricId && !priceError;

  const submit = async () => {
    const design = await run({
      name: v.name,
      fabricId: v.fabricId,
      collectionIds: v.collectionIds,
      pattern: v.pattern,
      border: v.border,
      mrp,
      price,
    });
    if (design) {
      setV(EMPTY);
      onOpenChange(false);
      router.push(`/designs/view?id=${design.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New design</DialogTitle>
          <DialogDescription>A design is the product customers see. Prices are optional here; each piece can carry its own price when stock is added.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nd-name">Design name</Label>
            <Input id="nd-name" autoFocus value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Kanchipuram Temple Border" />
          </div>
          <div className="space-y-1.5">
            <Label>Fabric</Label>
            <Select value={v.fabricId || undefined} onValueChange={(x) => set("fabricId", x)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose fabric" /></SelectTrigger>
              <SelectContent>
                {catalog?.fabrics.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-pattern">Pattern</Label>
            <PatternSelect id="nd-pattern" value={v.pattern} onChange={(x) => set("pattern", x)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Collections</Label>
            <CollectionPicker value={v.collectionIds} onChange={(ids) => set("collectionIds", ids)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-border">Border</Label>
            <BorderSelect id="nd-border" value={v.border} onChange={(x) => set("border", x)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-mrp">MRP (₹, optional)</Label>
            <Input id="nd-mrp" inputMode="numeric" value={v.mrp} onChange={(e) => set("mrp", e.target.value.replace(/\D/g, ""))} placeholder="12999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-price">Selling price (₹, optional)</Label>
            <Input id="nd-price" inputMode="numeric" value={v.price} aria-invalid={!!priceError || undefined} onChange={(e) => set("price", e.target.value.replace(/\D/g, ""))} placeholder="9999" />
            {priceError && <p className="text-xs text-destructive">{priceError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || pending}>Create design</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
