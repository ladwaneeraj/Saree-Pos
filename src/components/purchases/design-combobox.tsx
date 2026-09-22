"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MediaImage } from "@/components/shared/media-image";
import type { DesignOption } from "@/services/purchases";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Pick an existing design or type a new name. */
export function DesignCombobox({ options, designId, name, onPick, invalid }: {
  options: DesignOption[] | undefined;
  designId: string;
  name: string;
  onPick: (value: { design: DesignOption } | { newName: string }) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trimmed = search.trim();
  const exact = options?.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid} className={cn("w-full justify-between bg-card font-normal", !name && "text-muted-foreground", invalid && "border-destructive")}>
          <span className="truncate">
            {name || "Choose or type a design"}
            {name && !designId && <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-medium text-gold-foreground">NEW</span>}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search designs or type a new name…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-muted-foreground">{trimmed ? "No existing design with that name." : "No designs yet."}</CommandEmpty>
            {trimmed && !exact && (
              <CommandGroup>
                <CommandItem
                  value={`__new ${trimmed}`}
                  onSelect={() => {
                    onPick({ newName: trimmed });
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus /> Create new design &ldquo;{trimmed}&rdquo;
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Existing designs">
              {options?.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`${o.name} ${o.code}`}
                  onSelect={() => {
                    onPick({ design: o });
                    setOpen(false);
                    setSearch("");
                  }}
                  className="gap-2.5"
                >
                  <MediaImage id={o.imageId} alt={o.name} thumb className="w-7 shrink-0" rounded="rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{o.name}</div>
                    <div className="text-xs text-muted-foreground">{o.code} · {formatINR(o.price)}</div>
                  </div>
                  <Check className={cn("size-4", designId === o.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
