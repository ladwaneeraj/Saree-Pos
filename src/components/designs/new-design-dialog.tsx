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

const NONE = "__none";
const EMPTY = { name: "", fabricId: "", collectionId: "", pattern: "", border: "", mrp: "", price: "" };

export function NewDesignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const catalog = useCatalog();
  const [v, setV] = useState(EMPTY);
  const { run, pending } = useAction(createDesign, { success: (d) => `${d.name} created as ${d.code}` });
  const set = (k: keyof typeof EMPTY, value: string) => setV((s) => ({ ...s, [k]: value }));
  const price = Number(v.price);
  const mrp = Number(v.mrp);
  const priceError = v.price && v.mrp && price > mrp ? "Selling price cannot be above MRP" : "";
  const valid = v.name.trim() && v.fabricId && price > 0 && mrp > 0 && !priceError;

  const submit = async () => {
    const design = await run({
      name: v.name,
      fabricId: v.fabricId,
      collectionIds: v.collectionId ? [v.collectionId] : [],
      pattern: v.pattern,
      border: v.border,
      mrp,
      price,
    });
    if (design) {
      setV(EMPTY);
      onOpenChange(false);
      router.push(`/designs/${design.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New design</DialogTitle>
          <DialogDescription>A design is the product customers see. Add pieces (each with its own SKU and colour) after creating it.</DialogDescription>
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
            <Label>Collection</Label>
            <Select value={v.collectionId || NONE} onValueChange={(x) => set("collectionId", x === NONE ? "" : x)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No collection</SelectItem>
                {catalog?.collections.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-pattern">Pattern</Label>
            <Input id="nd-pattern" value={v.pattern} onChange={(e) => set("pattern", e.target.value)} placeholder="Zari buttas" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-border">Border</Label>
            <Input id="nd-border" value={v.border} onChange={(e) => set("border", e.target.value)} placeholder="Temple border" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-mrp">MRP (₹)</Label>
            <Input id="nd-mrp" inputMode="numeric" value={v.mrp} onChange={(e) => set("mrp", e.target.value.replace(/\D/g, ""))} placeholder="12999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nd-price">Selling price (₹)</Label>
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
