"use client";

import { Check, ChevronsUpDown, Plus, Sparkles } from "lucide-react";
import { forwardRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Colour, Design } from "@/domain/types";
import { errorMessage } from "@/domain/errors";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ensureColour } from "@/services/catalog";
import { ColourDot } from "@/components/shared/misc";
import { MediaImage } from "@/components/shared/media-image";

const TriggerButton = forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button> & { invalid?: boolean }>(function TriggerButton({ className, invalid, children, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="outline"
      role="combobox"
      aria-invalid={invalid || undefined}
      className={cn("h-9 w-full justify-between bg-card px-3 font-normal", className)}
      {...props}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">{children}</span>
      <ChevronsUpDown className="opacity-50" />
    </Button>
  );
});

export interface DesignPick {
  designId: string;
  designName: string;
}

/** Pick an existing design, or type a name to create a new one on save. */
export function DesignCombobox({
  designs,
  value,
  onPickExisting,
  onPickNew,
  invalid,
  fabricName,
}: {
  designs: Design[];
  value: DesignPick;
  onPickExisting: (design: Design) => void;
  onPickNew: (name: string) => void;
  invalid?: boolean;
  fabricName?: (fabricId: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = designs.find((d) => d.id === value.designId);
  const exact = designs.some((d) => d.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <TriggerButton invalid={invalid}>
          {selected ? (
            <>
              <span className="truncate">{selected.name}</span>
              <span className="text-xs text-muted-foreground">{selected.code}</span>
            </>
          ) : value.designName ? (
            <>
              <Sparkles className="size-3.5 text-gold" />
              <span className="truncate">{value.designName}</span>
              <span className="text-xs text-gold-foreground">New design</span>
            </>
          ) : (
            <span className="text-muted-foreground">Search or type a new design name</span>
          )}
        </TriggerButton>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search designs or type a new name…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-80">
            <CommandEmpty>No design found.</CommandEmpty>
            {search.trim() && !exact && (
              <CommandGroup>
                <CommandItem
                  value={`__new ${search}`}
                  onSelect={() => {
                    onPickNew(search.trim().replace(/\s+/g, " "));
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Plus className="text-primary" />
                  Create new design <span className="font-medium">&ldquo;{search.trim()}&rdquo;</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Existing designs">
              {designs.map((d) => (
                <CommandItem
                  key={d.id}
                  value={`${d.name} ${d.code}`}
                  onSelect={() => {
                    onPickExisting(d);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <MediaImage id={d.imageIds[0]} alt={d.name} thumb className="w-7 shrink-0" rounded="rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{d.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.code}
                      {fabricName && <> · {fabricName(d.fabricId)}</>} · {formatINR(d.price)}
                    </div>
                  </div>
                  {d.id === value.designId && <Check className="text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Colour picker with swatches. Typing an unknown name adds it to the colour list. */
export const ColourCombobox = forwardRef<HTMLButtonElement, { colours: Colour[]; value: string; onChange: (colourId: string) => void; invalid?: boolean; hint?: React.ReactNode }>(
  function ColourCombobox({ colours, value, onChange, invalid, hint }, ref) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const selected = colours.find((c) => c.id === value);
    const exact = colours.some((c) => c.name.toLowerCase() === search.trim().toLowerCase());

    const create = async () => {
      try {
        const colour = await ensureColour(search);
        onChange(colour.id);
        toast.success(`Colour "${colour.name}" added`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
      setOpen(false);
      setSearch("");
    };

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <TriggerButton ref={ref} invalid={invalid}>
            {selected ? (
              <>
                <ColourDot hex={selected.hex} className="size-3.5" />
                <span className="truncate">{selected.name}</span>
                {hint}
              </>
            ) : (
              <span className="text-muted-foreground">Choose colour</span>
            )}
          </TriggerButton>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search or add a colour…" value={search} onValueChange={setSearch} />
            <CommandList className="max-h-72">
              <CommandEmpty>No colour found.</CommandEmpty>
              {search.trim() && !exact && (
                <CommandGroup>
                  <CommandItem value={`__new ${search}`} onSelect={create}>
                    <Plus className="text-primary" /> Add colour <span className="font-medium">&ldquo;{search.trim()}&rdquo;</span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {colours.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <ColourDot hex={c.hex} className="size-3.5" />
                    {c.name}
                    {c.id === value && <Check className="ml-auto text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  },
);
