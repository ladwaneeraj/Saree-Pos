"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Copy, Info, Loader2, Lock, Printer, ScanBarcode, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { Design, InventoryItem } from "@/domain/types";
import { errorMessage } from "@/domain/errors";
import { useCatalog } from "@/hooks/use-catalog";
import { usePrintLabels } from "@/hooks/use-labels";
import { useLive } from "@/hooks/use-live";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listDesigns } from "@/services/catalog";
import { createPieces, getInventoryDetail, listLocations, peekNextSkus, type NewPieceInput } from "@/services/inventory";
import { nearestColour } from "@/services/media";
import { ImageManager, PhotoDropzone, uploadPhotos } from "@/components/shared/image-manager";
import { PageHeader } from "@/components/shared/page-header";
import { ColourCombobox, DesignCombobox } from "./pickers";
import { Panel } from "./panel";

const amount = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(/[₹,\s]/g, "")));
const NONE = "__none";

const schema = z
  .object({
    imageIds: z.array(z.string()),
    designId: z.string(),
    designName: z.string(),
    colourId: z.string().min(1, "Choose a colour"),
    fabricId: z.string(),
    collectionId: z.string(),
    pattern: z.string(),
    border: z.string(),
    lengthM: z.string(),
    blouseIncluded: z.boolean(),
    quantity: z.string(),
    cost: z.string(),
    mrp: z.string(),
    price: z.string(),
    location: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!v.designId && !v.designName.trim()) issue("designName", "Choose a design or type a new name");
    if (!v.designId && !v.fabricId) issue("fabricId", "Choose a fabric for the new design");
    const len = Number(v.lengthM);
    if (!(len >= 4 && len <= 10)) issue("lengthM", "Enter a length between 4 and 10 m");
    const qty = Number(v.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) issue("quantity", "1 to 50 pieces");
    const cost = amount(v.cost);
    const mrp = amount(v.mrp);
    const price = amount(v.price);
    if (!(cost >= 0)) issue("cost", "Enter the purchase cost");
    if (!(mrp > 0)) issue("mrp", "Enter the MRP");
    if (!(price > 0)) issue("price", "Enter the selling price");
    else if (mrp > 0 && price > mrp) issue("price", "Selling price cannot be above MRP");
  });

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  imageIds: [],
  designId: "",
  designName: "",
  colourId: "",
  fabricId: "",
  collectionId: "",
  pattern: "",
  border: "",
  lengthM: "6.3",
  blouseIncluded: true,
  quantity: "1",
  cost: "",
  mrp: "",
  price: "",
  location: "",
};

function designFields(d: Design): Partial<Values> {
  return {
    designId: d.id,
    designName: d.name,
    fabricId: d.fabricId,
    collectionId: d.collectionIds[0] ?? "",
    pattern: d.pattern,
    border: d.border,
    lengthM: String(d.lengthM),
    blouseIncluded: d.blouseIncluded,
    mrp: String(d.mrp),
    price: String(d.price),
  };
}

interface Added {
  at: number;
  items: InventoryItem[];
  label: string;
}

export function QuickAddForm() {
  const params = useSearchParams();
  const fromId = params.get("from");
  const designParam = params.get("design");
  const router = useRouter();
  const printLabels = usePrintLabels();
  const catalog = useCatalog();
  const { data: designs } = useLive(listDesigns, []);
  const { data: locations } = useLive(listLocations, []);
  const colourRef = useRef<HTMLButtonElement>(null);
  const [uploading, setUploading] = useState(false);
  const [autoColour, setAutoColour] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [added, setAdded] = useState<Added[]>([]);
  const [saving, setSaving] = useState<null | "save" | "another">(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY, mode: "onTouched" });
  const v = useWatch({ control: form.control }) as Values;
  const existing = designs?.find((d) => d.id === v.designId);
  const qty = Math.min(50, Math.max(1, Number(v.quantity) || 1));
  const { data: nextSkus } = useLive(() => peekNextSkus(qty), [qty]);

  // Duplicate & change: prefill from an existing piece, leaving colour and photos for the new saree.
  useEffect(() => {
    if (!fromId) return;
    let active = true;
    getInventoryDetail(fromId).then((d) => {
      if (!active || !d) return;
      form.reset({
        ...EMPTY,
        ...designFields(d.design),
        mrp: String(d.mrp),
        price: String(d.price),
        cost: String(d.item.cost),
        location: d.item.location,
      });
      setDuplicating(d.item.sku);
      setTimeout(() => colourRef.current?.focus(), 50);
    });
    return () => {
      active = false;
    };
  }, [fromId, form]);

  // "Add pieces" from a design page: start with that design chosen.
  const prefilledDesign = useRef<string | null>(null);
  useEffect(() => {
    if (fromId || !designParam || prefilledDesign.current === designParam) return;
    const d = designs?.find((x) => x.id === designParam);
    if (!d) return;
    prefilledDesign.current = designParam;
    form.reset({ ...EMPTY, ...designFields(d) });
    setTimeout(() => colourRef.current?.focus(), 50);
  }, [designParam, designs, fromId, form]);

  const onPhotos = async (files: File[]) => {
    setUploading(true);
    try {
      const processed = await uploadPhotos(files);
      const ids = processed.map((p) => p.media.id);
      form.setValue("imageIds", [...form.getValues("imageIds"), ...ids]);
      const first = processed[0];
      if (first && catalog && (!form.getValues("colourId") || autoColour)) {
        const match = nearestColour(first.dominantHex, catalog.colours);
        if (match) {
          form.setValue("colourId", match.id, { shouldValidate: true });
          setAutoColour(true);
        }
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const pickDesign = (d: Design) => {
    const current = form.getValues();
    form.reset({ ...current, ...designFields(d), cost: current.cost }, { keepTouched: true });
  };
  const pickNewDesign = (name: string) => {
    form.setValue("designId", "");
    form.setValue("designName", name, { shouldValidate: true });
  };

  const submit = (mode: "save" | "another") =>
    form.handleSubmit(async (values) => {
      setSaving(mode);
      const cost = amount(values.cost);
      const mrp = amount(values.mrp);
      const price = amount(values.price);
      const input: NewPieceInput = {
        design: values.designId
          ? { designId: values.designId }
          : {
              newDesign: {
                name: values.designName.trim(),
                fabricId: values.fabricId,
                collectionIds: values.collectionId ? [values.collectionId] : [],
                pattern: values.pattern,
                border: values.border,
                lengthM: Number(values.lengthM),
                blouseIncluded: values.blouseIncluded,
                mrp,
                price,
                imageIds: values.imageIds.slice(0, 1),
              },
            },
        colourId: values.colourId,
        cost,
        mrp,
        price,
        location: values.location.trim().toUpperCase(),
        imageIds: values.imageIds,
        quantity: Number(values.quantity),
      };
      try {
        const items = await createPieces([input], { source: fromId ? "DUPLICATE" : "QUICK_ADD" });
        const skus = items.map((i) => i.sku);
        const range = skus.length === 1 ? skus[0]! : `${skus[0]} – ${skus.at(-1)}`;
        const colour = catalog?.colourById.get(values.colourId)?.name ?? "";
        setAdded((a) => [{ at: Date.now(), items, label: `${values.designName} · ${colour}` }, ...a].slice(0, 8));
        toast.success(`${skus.length === 1 ? "Saree" : `${skus.length} sarees`} added · ${range}`, {
          description: "Live on POS, website and WhatsApp.",
          action: { label: skus.length === 1 ? "Print label" : "Print labels", onClick: () => printLabels({ skus }) },
        });
        if (mode === "another") {
          form.reset({ ...values, designId: items[0]!.designId, imageIds: [], colourId: "", quantity: "1" });
          setAutoColour(false);
          setTimeout(() => colourRef.current?.focus(), 50);
        } else {
          form.reset(EMPTY);
          setAutoColour(false);
          setDuplicating(null);
          if (fromId) router.replace("/inventory/new");
        }
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setSaving(null);
      }
    })();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void submit(e.shiftKey ? "save" : "another");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!catalog || !designs) return <FormSkeleton />;

  const locked = !!existing;
  const cost = amount(v.cost);
  const price = amount(v.price);
  const mrp = amount(v.mrp);
  const costWarn = cost > 0 && price > 0 && cost > price;
  const overrides = existing && ((price > 0 && price !== existing.price) || (mrp > 0 && mrp !== existing.mrp));

  return (
    <>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title={duplicating ? "Duplicate & change" : "Quick add"}
        description="Enter a saree once. It becomes inventory, a POS product, a website product and a WhatsApp product."
        actions={
          <Button asChild variant="outline">
            <Link href="/inventory/bulk">
              <Sparkles /> Adding many? Try bulk photo entry
            </Link>
          </Button>
        }
      />

      {duplicating && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/15 bg-wine-50 p-3.5 text-sm">
          <Copy className="size-4 shrink-0 text-primary" />
          <span className="flex-1">
            <span className="font-medium">Duplicating {duplicating}</span>, change colour and photo. Design, prices and rack are copied. The new saree gets its own SKU.
          </span>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={(e) => { e.preventDefault(); void submit("save"); }} className="grid grid-cols-1 gap-6 pb-24 lg:grid-cols-12 [&>*]:min-w-0">
          <div className="space-y-6 lg:col-span-8">
            <Panel title="Photos" action={autoColour && <span className="inline-flex items-center gap-1 text-xs text-gold-foreground"><Wand2 className="size-3.5" /> Colour detected from photo</span>}>
              {v.imageIds.length === 0 ? (
                <PhotoDropzone busy={uploading} onFiles={onPhotos} label="Drop photos of this saree" />
              ) : (
                <ImageManager imageIds={v.imageIds} onChange={(ids) => form.setValue("imageIds", ids)} />
              )}
            </Panel>

            <Panel title="Design and colour">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="designName"
                  render={({ fieldState }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Design</FormLabel>
                      <DesignCombobox
                        designs={designs}
                        value={{ designId: v.designId, designName: v.designName }}
                        onPickExisting={pickDesign}
                        onPickNew={pickNewDesign}
                        invalid={!!fieldState.error}
                        fabricName={(id) => catalog.fabricById.get(id)?.name ?? ""}
                      />
                      <FormDescription>
                        {existing ? (
                          <>
                            Existing design {existing.code}: fabric, collection and details come from the design.{" "}
                            <Link href={`/designs/view?id=${existing.id}`} className="text-primary hover:underline">Edit design</Link>
                          </>
                        ) : v.designName ? (
                          "A new design will be created with the details below."
                        ) : (
                          "Pick an existing design to fill everything in, or type a new name."
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="colourId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Colour</FormLabel>
                      <ColourCombobox
                        ref={colourRef}
                        colours={catalog.colours}
                        value={field.value}
                        onChange={(id) => {
                          field.onChange(id);
                          setAutoColour(false);
                        }}
                        invalid={!!fieldState.error}
                        hint={autoColour ? <span className="ml-1 rounded-full bg-[oklch(0.96_0.04_85)] px-1.5 text-[10px] font-medium text-gold-foreground">Auto</span> : null}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fabricId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="gap-1.5">Fabric {locked && <Lock className="size-3 text-muted-foreground" />}</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange} disabled={locked}>
                        <FormControl>
                          <SelectTrigger className="w-full bg-card">
                            <SelectValue placeholder="Choose fabric" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {catalog.fabrics.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="collectionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="gap-1.5">Collection {locked && <Lock className="size-3 text-muted-foreground" />}</FormLabel>
                      <Select value={field.value || NONE} onValueChange={(x) => field.onChange(x === NONE ? "" : x)} disabled={locked}>
                        <FormControl>
                          <SelectTrigger className="w-full bg-card">
                            <SelectValue placeholder="No collection" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NONE}>No collection</SelectItem>
                          {catalog.collections.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <TextField form={form} name="pattern" label="Pattern" placeholder="Zari buttas" disabled={locked} />
                <TextField form={form} name="border" label="Border" placeholder="Temple border" disabled={locked} />
                <div className="grid grid-cols-[1fr_auto] items-start gap-3">
                  <TextField form={form} name="lengthM" label="Saree length (m)" placeholder="6.3" disabled={locked} inputMode="decimal" />
                  <FormField
                    control={form.control}
                    name="blouseIncluded"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="gap-1.5">Blouse piece {locked && <Lock className="size-3 text-muted-foreground" />}</FormLabel>
                        <div className="flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={locked} />
                          </FormControl>
                          <span className="w-14 text-muted-foreground">{field.value ? "Included" : "No"}</span>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="Price and stock">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField form={form} name="cost" label="Purchase cost (₹)" placeholder="4200" inputMode="numeric" />
                <TextField form={form} name="mrp" label="MRP (₹)" placeholder="8999" inputMode="numeric" />
                <TextField form={form} name="price" label="Selling price (₹)" placeholder="6499" inputMode="numeric" />
                <TextField form={form} name="quantity" label="Quantity" placeholder="1" inputMode="numeric" description="Identical pieces, each gets its own SKU" />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Rack / location</FormLabel>
                      <FormControl>
                        <Input {...field} list="quick-racks" placeholder="B-14" className="bg-card font-mono uppercase" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
                      </FormControl>
                      <datalist id="quick-racks">
                        {(locations ?? []).map((l) => <option key={l} value={l} />)}
                      </datalist>
                      <FormDescription>Leave empty to shelve as Unassigned.</FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              {(costWarn || overrides) && (
                <div className="mt-4 space-y-1.5 text-xs">
                  {costWarn && (
                    <p className="flex items-center gap-1.5 text-[oklch(0.5_0.12_65)]">
                      <Info className="size-3.5" /> Purchase cost is above the selling price. You will sell at a loss.
                    </p>
                  )}
                  {overrides && (
                    <p className="flex items-center gap-1.5 text-gold-foreground">
                      <Info className="size-3.5" /> Differs from the design ({formatINR(existing.price)} / MRP {formatINR(existing.mrp)}). This piece keeps its own price.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <div className="space-y-4 lg:sticky lg:top-20">
              <Panel>
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-wine-50 text-primary">
                    <ScanBarcode className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Next SKU</div>
                    {nextSkus ? (
                      <div className="font-mono text-lg font-semibold tabular">
                        {nextSkus.length === 1 ? nextSkus[0] : `${nextSkus[0]} – ${nextSkus.at(-1)}`}
                      </div>
                    ) : (
                      <Skeleton className="mt-1 h-6 w-28" />
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  SKUs are assigned on save. The barcode label carries the SKU only, so price changes never need reprinting.
                </p>
              </Panel>

              {added.length > 0 && (
                <Panel title={`Added this session`} action={<span className="text-xs text-muted-foreground tabular">{added.reduce((s, a) => s + a.items.length, 0)} pieces</span>} bodyClassName="p-0 sm:p-0">
                  <ul className="divide-y">
                    {added.map((a) => (
                      <li key={a.at} className="flex items-center gap-3 px-4 py-2.5">
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/inventory/item?sku=${a.items[0]!.sku}`} className="font-mono text-sm font-medium hover:underline">
                            {a.items.length === 1 ? a.items[0]!.sku : `${a.items[0]!.sku} – ${a.items.at(-1)!.sku}`}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">{a.label}</div>
                        </div>
                        <Button type="button" size="icon-sm" variant="ghost" aria-label="Print labels" onClick={() => printLabels({ skus: a.items.map((i) => i.sku) })}>
                          <Printer />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t p-3">
                    <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => printLabels({ skus: added.flatMap((a) => a.items.map((i) => i.sku)) })}>
                      <Printer /> Print all labels
                    </Button>
                  </div>
                </Panel>
              )}
            </div>
          </aside>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/90 backdrop-blur max-lg:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] lg:left-60">
            <div className="flex items-center justify-end gap-2 px-4 py-3 sm:px-6">
              <span className="mr-auto hidden text-xs text-muted-foreground md:inline">
                <Kbd>Ctrl</Kbd> <Kbd>Enter</Kbd> save & add another
              </span>
              <Button type="submit" variant="outline" disabled={!!saving}>
                {saving === "save" && <Loader2 className="animate-spin" />}
                Save
              </Button>
              <Button type="button" disabled={!!saving} onClick={() => void submit("another")}>
                {saving === "another" ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                Save & add another
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

function TextField({
  form,
  name,
  label,
  placeholder,
  disabled,
  inputMode,
  description,
}: {
  form: ReturnType<typeof useForm<Values>>;
  name: "pattern" | "border" | "lengthM" | "cost" | "mrp" | "price" | "quantity";
  label: string;
  placeholder: string;
  disabled?: boolean;
  inputMode?: "numeric" | "decimal";
  description?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="gap-1.5">
            {label} {disabled && <Lock className="size-3 text-muted-foreground" />}
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              disabled={disabled}
              placeholder={placeholder}
              inputMode={inputMode}
              className={cn("bg-card", inputMode && "tabular")}
              onChange={(e) => field.onChange(inputMode === "numeric" ? e.target.value.replace(/[^\d]/g, "") : inputMode === "decimal" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
        <div className="space-y-6 lg:col-span-8">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl lg:col-span-4" />
      </div>
    </div>
  );
}
