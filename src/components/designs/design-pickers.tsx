"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCatalog, useSettings } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

/** Chips for choosing any number of collections. */
export function CollectionPicker({ value, onChange, disabled }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const catalog = useCatalog();
  if (!catalog) return null;
  if (catalog.collections.length === 0) return <p className="text-xs text-muted-foreground">No collections yet. <Link href="/settings?tab=catalog" className="text-primary hover:underline">Add some in Settings</Link>.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {catalog.collections.map((c) => {
        const on = value.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-60",
              on ? "border-primary/30 bg-wine-50 text-primary" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {on && <Check className="size-3" />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

const NONE = "__none";

/** Dropdown over a list kept in Settings → Catalogue lists. A value not in the list (older data) is still shown. */
function ListSelect({ value, onChange, options, placeholder, disabled, id }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string; disabled?: boolean; id?: string }) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full bg-card"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {all.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <div className="border-t px-2 py-1.5 text-xs text-muted-foreground">
          Missing one? <Link href="/settings?tab=catalog" className="text-primary hover:underline">Add it in Settings</Link>
        </div>
      </SelectContent>
    </Select>
  );
}

export function PatternSelect(props: { value: string; onChange: (v: string) => void; disabled?: boolean; id?: string }) {
  const settings = useSettings();
  return <ListSelect {...props} options={settings?.catalog.patterns.map((p) => p.name) ?? []} placeholder="No pattern" />;
}

export function BorderSelect(props: { value: string; onChange: (v: string) => void; disabled?: boolean; id?: string }) {
  const settings = useSettings();
  return <ListSelect {...props} options={settings?.catalog.borders ?? []} placeholder="No border" />;
}
