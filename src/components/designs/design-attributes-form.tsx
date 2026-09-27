"use client";

import { Loader2 } from "lucide-react";
import { BorderSelect, CollectionPicker, PatternSelect } from "./design-pickers";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Design } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { updateDesign, type DesignEdit } from "@/services/catalog";

type Fields = Required<Pick<DesignEdit, "name" | "fabricId" | "categoryId" | "collectionIds" | "pattern" | "border" | "blouseIncluded" | "description">> & { lengthM: string };

const pick = (d: Design): Fields => ({
  name: d.name,
  fabricId: d.fabricId,
  categoryId: d.categoryId,
  collectionIds: d.collectionIds,
  pattern: d.pattern,
  border: d.border,
  lengthM: String(d.lengthM),
  blouseIncluded: d.blouseIncluded,
  description: d.description,
});

/** Editable design attributes. Remount with a new key to pick up outside changes. */
export function DesignAttributesForm({ design, canEdit }: { design: Design; canEdit: boolean }) {
  const catalog = useCatalog();
  const [v, setV] = useState<Fields>(() => pick(design));
  const { run, pending } = useAction(updateDesign, { success: "Design updated on every channel" });
  const initial = pick(design);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const length = Number(v.lengthM);
  const valid = v.name.trim() && length >= 4 && length <= 10;
  const set = <K extends keyof Fields>(k: K, value: Fields[K]) => setV((s) => ({ ...s, [k]: value }));

  const save = () => void run(design.id, { ...v, lengthM: length, name: v.name.trim() });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="da-name">Design name</Label>
          <Input id="da-name" value={v.name} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fabric</Label>
          <Select value={v.fabricId} onValueChange={(x) => set("fabricId", x)} disabled={!canEdit}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{catalog?.fabrics.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={v.categoryId} onValueChange={(x) => set("categoryId", x)} disabled={!canEdit}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{catalog?.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Collections</Label>
          <CollectionPicker value={v.collectionIds} onChange={(ids) => set("collectionIds", ids)} disabled={!canEdit} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="da-pattern">Pattern</Label>
          <PatternSelect id="da-pattern" value={v.pattern} disabled={!canEdit} onChange={(x) => set("pattern", x)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="da-border">Border</Label>
          <BorderSelect id="da-border" value={v.border} disabled={!canEdit} onChange={(x) => set("border", x)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="da-length">Saree length (m)</Label>
          <Input id="da-length" inputMode="decimal" value={v.lengthM} disabled={!canEdit} onChange={(e) => set("lengthM", e.target.value.replace(/[^\d.]/g, ""))} aria-invalid={!(length >= 4 && length <= 10) || undefined} />
        </div>
        <div className="space-y-1.5">
          <Label>Blouse piece</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <Switch checked={v.blouseIncluded} onCheckedChange={(c) => set("blouseIncluded", c)} disabled={!canEdit} />
            {v.blouseIncluded ? "Included" : "Not included"}
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="da-desc">Description</Label>
          <Textarea id="da-desc" rows={3} value={v.description} disabled={!canEdit} onChange={(e) => set("description", e.target.value)} />
          <p className="text-xs text-muted-foreground">Shown on the website product page and in WhatsApp shares.</p>
        </div>
      </div>
      {canEdit && (
        <div className="flex justify-end gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setV(initial)}>
              Discard
            </Button>
          )}
          <Button onClick={save} disabled={!dirty || !valid || pending}>
            {pending && <Loader2 className="animate-spin" />} Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
