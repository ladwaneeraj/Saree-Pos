"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColourDot } from "@/components/shared/misc";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { addMaster, deleteMaster, guessColourHex, renameMaster, updateSupplier, type MasterKind } from "@/services/catalog";
import { SaveFooter, SettingsCard, useSettingsForm } from "./settings-kit";

/* Patterns and borders live in settings ------------------------------ */

const catalogSchema = z.object({
  patterns: z.array(z.object({ name: z.string().trim().min(1, "Name"), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "1 to 6 letters") })),
  borders: z.array(z.string().trim().min(1)),
});

export function CatalogListsForm() {
  const { form, onSubmit, pending } = useSettingsForm("catalog", catalogSchema);
  const patterns = form.watch("patterns");
  const borders = form.watch("borders");
  const [newPattern, setNewPattern] = useState({ name: "", code: "" });
  const [newBorder, setNewBorder] = useState("");
  const setPatterns = (next: typeof patterns) => form.setValue("patterns", next, { shouldDirty: true, shouldValidate: true });
  const setBorders = (next: string[]) => form.setValue("borders", next, { shouldDirty: true, shouldValidate: true });
  const addPattern = () => {
    const name = newPattern.name.trim();
    const code = newPattern.code.trim().toUpperCase() || name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    if (!name || patterns.some((p) => p.name.toLowerCase() === name.toLowerCase())) return;
    setPatterns([...patterns, { name, code }]);
    setNewPattern({ name: "", code: "" });
  };
  const addBorder = () => {
    const name = newBorder.trim();
    if (!name || borders.some((b) => b.toLowerCase() === name.toLowerCase())) return;
    setBorders([...borders, name]);
    setNewBorder("");
  };
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="Patterns and borders" description="Dropdown choices on design forms. The pattern code feeds the {pattern} part of new SKUs." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Patterns</h3>
              <ul className="divide-y rounded-lg border">
                {patterns.map((p, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <Input value={p.name} onChange={(e) => setPatterns(patterns.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className="h-8 flex-1" aria-label="Pattern name" />
                    <Input value={p.code} onChange={(e) => setPatterns(patterns.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))} className="h-8 w-20 font-mono uppercase" aria-label="Pattern code" />
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove pattern" onClick={() => setPatterns(patterns.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </li>
                ))}
                <li className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                  <Input value={newPattern.name} placeholder="New pattern" onChange={(e) => setNewPattern((s) => ({ ...s, name: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPattern())} className="h-8 flex-1" />
                  <Input value={newPattern.code} placeholder="CODE" onChange={(e) => setNewPattern((s) => ({ ...s, code: e.target.value.toUpperCase() }))} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPattern())} className="h-8 w-20 font-mono uppercase" />
                  <Button type="button" size="icon-sm" variant="outline" aria-label="Add pattern" onClick={addPattern}><Plus /></Button>
                </li>
              </ul>
              {form.formState.errors.patterns && <p className="text-xs text-destructive">Every pattern needs a name and a 1 to 6 letter code.</p>}
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Borders</h3>
              <ul className="divide-y rounded-lg border">
                {borders.map((b, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-1.5">
                    <Input value={b} onChange={(e) => setBorders(borders.map((x, j) => (j === i ? e.target.value : x)))} className="h-8 flex-1" aria-label="Border name" />
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove border" onClick={() => setBorders(borders.filter((_, j) => j !== i))}><Trash2 /></Button>
                  </li>
                ))}
                <li className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                  <Input value={newBorder} placeholder="New border" onChange={(e) => setNewBorder(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBorder())} className="h-8 flex-1" />
                  <Button type="button" size="icon-sm" variant="outline" aria-label="Add border" onClick={addBorder}><Plus /></Button>
                </li>
              </ul>
            </div>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}

/* Fabrics, collections, categories, colours live in the database -------- */

const KINDS: { kind: MasterKind; title: string; hint: string }[] = [
  { kind: "fabrics", title: "Fabrics", hint: "Each fabric has a default category for new designs." },
  { kind: "collections", title: "Collections", hint: "A design can sit in several collections." },
  { kind: "categories", title: "Categories", hint: "Top-level grouping on the website." },
  { kind: "colours", title: "Colours", hint: "Swatch colour is guessed from the name; edit the hex if needed." },
];

export function MasterLists() {
  const catalog = useCatalog();
  if (!catalog) return null;
  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      {KINDS.map((k) => (
        <MasterList key={k.kind} kind={k.kind} title={k.title} hint={k.hint} />
      ))}
      <SupplierCodes />
    </div>
  );
}

type Row = { id: string; name: string; hex?: string; categoryId?: string };

function MasterList({ kind, title, hint }: { kind: MasterKind; title: string; hint: string }) {
  const catalog = useCatalog()!;
  const rows = catalog[kind] as Row[];
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; hex: string; categoryId: string } | null>(null);
  const { confirm, dialog } = useConfirm();
  const add = useAction(addMaster, { success: `${title.slice(0, -1)} added` });
  const rename = useAction(renameMaster, { success: "Saved" });
  const remove = useAction(deleteMaster, { success: "Removed" });
  const save = async () => {
    if (!editing) return;
    if ((await rename.run(kind, editing.id, { name: editing.name, hex: editing.hex || undefined, categoryId: editing.categoryId || undefined })) !== undefined) setEditing(null);
  };
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <header className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">· {rows.length}</span></h3>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      <ul className="max-h-80 divide-y overflow-y-auto">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-2 px-4 py-1.5 text-sm">
            {editing?.id === r.id ? (
              <>
                {kind === "colours" && <input type="color" value={editing.hex} onChange={(e) => setEditing({ ...editing, hex: e.target.value })} className="size-7 cursor-pointer rounded border bg-transparent" aria-label="Swatch" />}
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && void save()} className="h-8 flex-1" autoFocus />
                {kind === "fabrics" && (
                  <Select value={editing.categoryId} onValueChange={(v) => setEditing({ ...editing, categoryId: v })}>
                    <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>{catalog.categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Save" onClick={() => void save()} disabled={rename.pending}><Check /></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}><X /></Button>
              </>
            ) : (
              <>
                {kind === "colours" && <ColourDot hex={r.hex ?? "#999"} />}
                <span className="flex-1 truncate">{r.name}</span>
                {kind === "fabrics" && <span className="text-xs text-muted-foreground">{catalog.categoryById.get(r.categoryId ?? "")?.name}</span>}
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Edit" onClick={() => setEditing({ id: r.id, name: r.name, hex: r.hex ?? "", categoryId: r.categoryId ?? "" })}><Pencil /></Button>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Delete" disabled={remove.pending} onClick={async () => { if (await confirm({ title: `Remove ${r.name}?`, description: "Only possible when nothing uses it.", confirmLabel: "Remove", destructive: true })) await remove.run(kind, r.id); }}><Trash2 /></Button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2">
        {kind === "colours" && draft && <ColourDot hex={guessColourHex(draft)} />}
        <Input value={draft} placeholder={`New ${title.slice(0, -1).toLowerCase()}`} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void add.run(kind, { name: draft }).then((ok) => ok !== undefined && setDraft("")))} className="h-8 flex-1" />
        <Button type="button" size="sm" variant="outline" disabled={!draft.trim() || add.pending} onClick={() => void add.run(kind, { name: draft }).then((ok) => ok !== undefined && setDraft(""))}><Plus /> Add</Button>
      </div>
      {dialog}
    </section>
  );
}

/** Vendor codes for the {vendor} SKU token. */
function SupplierCodes() {
  const catalog = useCatalog()!;
  const update = useAction(updateSupplier, { success: "Supplier code saved" });
  const [codes, setCodes] = useState<Record<string, string>>({});
  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <header className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Supplier codes <span className="font-normal text-muted-foreground">· {catalog.suppliers.length}</span></h3>
        <p className="text-xs text-muted-foreground">Short code printed into SKUs as {"{vendor}"}. Add suppliers from the purchase form.</p>
      </header>
      <ul className="max-h-80 divide-y overflow-y-auto">
        {catalog.suppliers.map((s) => {
          const value = codes[s.id] ?? s.code;
          return (
            <li key={s.id} className="flex items-center gap-2 px-4 py-1.5 text-sm">
              <span className="flex-1 truncate">{s.name}</span>
              <Input value={value} onChange={(e) => setCodes((c) => ({ ...c, [s.id]: e.target.value.toUpperCase() }))} className="h-8 w-24 font-mono uppercase" aria-label={`Code for ${s.name}`} />
              <Button type="button" size="icon-sm" variant="ghost" aria-label="Save code" disabled={value === s.code || update.pending} onClick={() => void update.run(s.id, { code: value })}><Check /></Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
