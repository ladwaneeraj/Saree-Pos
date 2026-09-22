"use client";

import { Boxes, Palette, ReceiptText, Truck, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { hasPermission } from "@/domain/permissions";
import { globalSearch, type SearchKind, type SearchResult } from "@/services/search";
import { useRole } from "@/stores/session";
import { MediaImage } from "@/components/shared/media-image";
import { ALL_NAV_ITEMS } from "./nav";

const GROUPS: { kind: SearchKind; label: string; icon: typeof Boxes }[] = [
  { kind: "INVENTORY", label: "Inventory", icon: Boxes },
  { kind: "DESIGN", label: "Designs", icon: Palette },
  { kind: "ORDER", label: "Orders", icon: ReceiptText },
  { kind: "CUSTOMER", label: "Customers", icon: User },
  { kind: "SUPPLIER", label: "Suppliers", icon: Truck },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const role = useRole();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      globalSearch(query).then((r) => active && setResults(r));
    }, 120);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const pages = ALL_NAV_ITEMS.filter((i) => hasPermission(role, i.permission) && i.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">Search SKUs, designs, orders, customers, phone numbers and suppliers</DialogDescription>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-item]]:py-2">
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search SKU, design, colour, order #, customer, phone, supplier…" className="h-12" />
          <CommandList className="max-h-[60vh]">
            {query.trim().length >= 2 && results.length === 0 && <CommandEmpty>No matches for “{query}”.</CommandEmpty>}
            {GROUPS.map(({ kind, label, icon: Icon }) => {
              const hits = results.filter((r) => r.kind === kind);
              if (hits.length === 0) return null;
              return (
                <CommandGroup key={kind} heading={label}>
                  {hits.map((r) => (
                    <CommandItem key={`${kind}-${r.id}`} value={`${kind}-${r.id}`} onSelect={() => go(r.href)} className="gap-3">
                      {r.imageId ? <MediaImage id={r.imageId} alt="" thumb className="w-8 shrink-0" rounded="rounded-md" /> : <Icon className="size-4 text-muted-foreground" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{r.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
            {pages.length > 0 && (
              <CommandGroup heading="Go to">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)} className="gap-3">
                    <p.icon className="size-4 text-muted-foreground" />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
