"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackageCheck, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm, useWatch, type Control, type UseFormGetValues, type UseFormSetValue } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ColourDot } from "@/components/shared/misc";
import { useAction } from "@/hooks/use-action";
import { useCatalog } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatINR, formatNumber } from "@/lib/format";
import { createPurchase, listDesignOptions, purchaseTotals, type DesignOption, type PurchaseInput } from "@/services/purchases";
import type { ScannedBill } from "@/services/bill-scan";
import { createSupplier, ensureColour, findSupplier } from "@/services/catalog";
import type { PaymentMethod } from "@/domain/types";
import { PAYMENT_METHOD_LABELS } from "@/services/orders";
import { useSettings } from "@/hooks/use-catalog";
import { toast } from "sonner";
import { DesignCombobox } from "./design-combobox";
import { ReceivedDialog, type ReceivedInfo } from "./received-dialog";
import { ScanBillButton } from "./scan-bill-button";
import { SupplierDialog } from "./supplier-dialog";

const amount = (label: string) => z.string().trim().regex(/^\d+$/, `Enter ${label}`);

const lineSchema = z
  .object({
    designId: z.string(),
    designName: z.string().trim().min(1, "Choose or type a design"),
    fabricId: z.string(),
    colourId: z.string().min(1, "Choose a colour"),
    quantity: z.string().regex(/^[1-9]\d*$/, "At least 1"),
    cost: amount("cost"),
    mrp: amount("MRP"),
    price: amount("price"),
    location: z.string().trim().toUpperCase(),
  })
  .superRefine((l, ctx) => {
    if (!l.designId && !l.fabricId) ctx.addIssue({ code: "custom", path: ["fabricId"], message: "Fabric is needed for a new design" });
    const [cost, mrp, price] = [Number(l.cost), Number(l.mrp), Number(l.price)];
    if (l.mrp && mrp <= 0) ctx.addIssue({ code: "custom", path: ["mrp"], message: "MRP must be above zero" });
    if (l.price && l.mrp && price > mrp) ctx.addIssue({ code: "custom", path: ["price"], message: "Above MRP" });
    if (l.cost && l.price && cost > price) ctx.addIssue({ code: "custom", path: ["cost"], message: "Above selling price" });
  });

const optionalAmount = z.string().trim().regex(/^-?\d*$/, "Whole rupees only");

const schema = z
  .object({
    supplierId: z.string().min(1, "Choose a supplier"),
    invoiceNumber: z.string().trim().min(1, "Enter the supplier invoice number"),
    date: z.string().min(1, "Choose the invoice date"),
    notes: z.string(),
    lines: z.array(lineSchema).min(1, "Add at least one line"),
    gstRate: z.string().trim().regex(/^\d+(\.\d+)?$/, "Enter the GST %"),
    /** Empty means "work it out from the rate". */
    gstAmount: optionalAmount,
    otherCharges: optionalAmount,
    dueDate: z.string(),
    paidAmount: z.string().trim().regex(/^\d*$/, "Whole rupees only"),
    paidMethod: z.enum(["CASH", "UPI", "CARD", "NETBANKING"]),
    paidReference: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const rate = Number(v.gstRate);
    if (!(rate >= 0 && rate <= 28)) ctx.addIssue({ code: "custom", path: ["gstRate"], message: "0 to 28%" });
    const totals = purchaseTotals(billTotalsInput(v));
    if (Number(v.paidAmount || 0) > totals.grandTotal) ctx.addIssue({ code: "custom", path: ["paidAmount"], message: `More than the bill total ${formatINR(totals.grandTotal)}` });
  });

type BillFields = { lines: { quantity: string; cost: string }[]; gstRate: string; gstAmount: string; otherCharges: string };

function billTotalsInput(v: BillFields) {
  return {
    lines: v.lines.map((l) => ({ quantity: Number(l.quantity || 0), cost: Number(l.cost || 0) })) as PurchaseInput["lines"],
    gstRate: Number(v.gstRate) || 0,
    gstAmount: v.gstAmount.trim() === "" ? null : Number(v.gstAmount),
    otherCharges: Number(v.otherCharges) || 0,
  };
}
type Values = z.infer<typeof schema>;
type Line = Values["lines"][number];

const emptyLine = (location = ""): Line => ({ designId: "", designName: "", fabricId: "", colourId: "", quantity: "1", cost: "", mrp: "", price: "", location });
const today = () => new Date().toISOString().slice(0, 10);
const digits = (v: string) => v.replace(/\D/g, "");

function toInput(v: Values): PurchaseInput {
  const paid = Number(v.paidAmount) || 0;
  return {
    supplierId: v.supplierId,
    invoiceNumber: v.invoiceNumber,
    date: new Date(`${v.date}T11:00:00`).getTime(),
    notes: v.notes.trim(),
    ...billTotalsInput(v),
    dueDate: v.dueDate ? new Date(`${v.dueDate}T18:00:00`).getTime() : null,
    paidNow: paid > 0 ? { amount: paid, method: v.paidMethod, reference: v.paidReference } : null,
    lines: v.lines.map((l) => ({
      design: l.designId ? { designId: l.designId } : { newDesign: { name: l.designName, fabricId: l.fabricId, collectionIds: [], mrp: Number(l.mrp), price: Number(l.price) } },
      colourId: l.colourId,
      quantity: Number(l.quantity),
      cost: Number(l.cost),
      mrp: Number(l.mrp),
      price: Number(l.price),
      location: l.location,
    })),
  };
}

export function PurchaseForm() {
  const router = useRouter();
  const catalog = useCatalog();
  const { data: designs } = useLive(listDesignOptions, []);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [received, setReceived] = useState<ReceivedInfo | null>(null);
  const [mode, setMode] = useState<"draft" | "receive" | null>(null);

  const settings = useSettings();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: "", invoiceNumber: "", date: today(), notes: "", lines: [emptyLine()], gstRate: String(settings?.tax.gstRate ?? 5), gstAmount: "", otherCharges: "", dueDate: "", paidAmount: "", paidMethod: "UPI", paidReference: "" },
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });
  const save = useAction(createPurchase);

  /** Fills the form from a scanned bill. Existing designs are matched by name; the rest become new designs. */
  const applyScan = async (bill: ScannedBill) => {
    let supplier = await findSupplier({ gstin: bill.supplier.gstin, name: bill.supplier.name });
    if (!supplier && bill.supplier.name) {
      supplier = await createSupplier({ name: bill.supplier.name, contactName: "", phone: bill.supplier.phone.replace(/\D/g, "").slice(-10), email: "", city: "", gstin: /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(bill.supplier.gstin) ? bill.supplier.gstin : "" });
      toast.info(`Added supplier ${supplier.name}`, { description: "Check the details under Purchases → suppliers." });
    }
    const scannedLines: Line[] = [];
    for (const l of bill.lines) {
      const existing = designs?.find((d) => d.name.toLowerCase() === l.description.toLowerCase());
      const colour = l.colour ? await ensureColour(l.colour).catch(() => null) : null;
      scannedLines.push({
        designId: existing?.id ?? "",
        designName: existing?.name ?? l.description,
        fabricId: existing?.fabricId ?? "",
        colourId: colour?.id ?? "",
        quantity: String(l.quantity),
        cost: String(l.rate || Math.round(l.amount / l.quantity) || ""),
        mrp: existing ? String(existing.mrp || "") : "",
        price: existing ? String(existing.price || "") : "",
        location: "",
      });
    }
    form.reset({
      ...form.getValues(),
      supplierId: supplier?.id ?? "",
      invoiceNumber: bill.invoiceNumber || form.getValues("invoiceNumber"),
      date: bill.date || form.getValues("date"),
      gstRate: String(bill.gstRate),
      gstAmount: bill.gstAmount ? String(bill.gstAmount) : "",
      otherCharges: bill.otherCharges ? String(bill.otherCharges) : "",
      paidAmount: bill.amountPaid ? String(bill.amountPaid) : "",
      notes: bill.notes ? `Scanned bill. ${bill.notes}` : form.getValues("notes"),
      lines: scannedLines.length ? scannedLines : form.getValues("lines"),
    });
  };

  const submit = (receiveNow: boolean) =>
    form.handleSubmit(async (values) => {
      setMode(receiveNow ? "receive" : "draft");
      const result = await save.run(toInput(values), receiveNow);
      setMode(null);
      if (!result) return;
      if (receiveNow) {
        setReceived({ purchaseId: result.purchase.id, number: result.purchase.number, pieces: result.items.length, totalCost: result.purchase.totalCost, firstSku: result.items[0]?.sku, lastSku: result.items.at(-1)?.sku });
      } else {
        router.push(`/purchases/view?id=${result.purchase.id}`);
      }
    })();

  return (
    <Form {...form}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(true); }} className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Supplier invoice</h2>
              <ScanBillButton onScanned={applyScan} disabled={save.pending} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <FormField
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Supplier</FormLabel>
                    <div className="flex gap-2">
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full min-w-0 bg-card">
                            <SelectValue placeholder="Choose supplier" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {catalog?.suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                              {s.city && <span className="text-muted-foreground"> · {s.city}</span>}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => setSupplierOpen(true)}>
                        <Plus /> Add
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice number</FormLabel>
                  <FormControl><Input placeholder="SLW/2026/418" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase date</FormLabel>
                  <FormControl><Input type="date" max={today()} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="sm:col-span-2 xl:col-span-4">
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Transport, payment terms, anything to remember" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sarees on this invoice</h2>
              <span className="text-xs text-muted-foreground">Each piece gets its own SKU when stock is received</span>
            </div>
            {lines.fields.map((f, index) => (
              <LineCard key={f.id} index={index} control={form.control} designs={designs} onRemove={lines.fields.length > 1 ? () => lines.remove(index) : undefined} setValue={form.setValue} getValues={form.getValues} />
            ))}
            <Button type="button" variant="outline" className="w-full border-dashed bg-card" onClick={() => lines.append(emptyLine(form.getValues(`lines.${lines.fields.length - 1}.location`)))}>
              <Plus /> Add another design
            </Button>
          </section>

          <BillSection control={form.control} />
        </div>

        <Summary control={form.control} pending={save.pending} mode={mode} onDraft={() => void submit(false)} />
      </form>
      <SupplierDialog open={supplierOpen} onOpenChange={setSupplierOpen} onCreated={(s) => form.setValue("supplierId", s.id, { shouldValidate: true })} />
      <ReceivedDialog info={received} canSeeCost onClose={() => router.push(received ? `/purchases/view?id=${received.purchaseId}` : "/purchases")} />
    </Form>
  );
}

function LineCard({ index, control, designs, onRemove, setValue, getValues }: {
  index: number;
  control: Control<Values>;
  designs: DesignOption[] | undefined;
  onRemove?: () => void;
  setValue: UseFormSetValue<Values>;
  getValues: UseFormGetValues<Values>;
}) {
  const catalog = useCatalog();
  const line = useWatch({ control, name: `lines.${index}` });
  const total = Number(line.quantity || 0) * Number(line.cost || 0);
  const isNew = !!line.designName && !line.designId;
  const p = `lines.${index}` as const;

  const numberField = (name: "quantity" | "cost" | "mrp" | "price", label: string, placeholder: string) => (
    <FormField
      control={control}
      name={`${p}.${name}`}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <div className="relative">
            {name !== "quantity" && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">₹</span>}
            <FormControl>
              <Input inputMode="numeric" placeholder={placeholder} {...field} onChange={(e) => field.onChange(digits(e.target.value))} className={name !== "quantity" ? "pl-6 tabular" : "tabular"} />
            </FormControl>
          </div>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );

  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular">{index + 1}</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Line total <span className="font-semibold text-foreground tabular">{formatINR(total)}</span></span>
          {onRemove && (
            <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove line">
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
        <FormField
          control={control}
          name={`${p}.designName`}
          render={({ fieldState }) => (
            <FormItem>
              <FormLabel className="text-xs">Design</FormLabel>
              <DesignCombobox
                options={designs}
                designId={line.designId}
                name={line.designName}
                invalid={!!fieldState.error}
                onPick={(v) => {
                  if ("design" in v) {
                    setValue(`${p}.designId`, v.design.id);
                    setValue(`${p}.designName`, v.design.name, { shouldValidate: true });
                    setValue(`${p}.fabricId`, v.design.fabricId);
                    if (!getValues(`${p}.mrp`)) setValue(`${p}.mrp`, String(v.design.mrp));
                    if (!getValues(`${p}.price`)) setValue(`${p}.price`, String(v.design.price));
                  } else {
                    setValue(`${p}.designId`, "");
                    setValue(`${p}.designName`, v.newName, { shouldValidate: true });
                  }
                }}
              />
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${p}.fabricId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Fabric</FormLabel>
              <Select value={field.value} onValueChange={field.onChange} disabled={!isNew}>
                <FormControl>
                  <SelectTrigger className="w-full bg-card"><SelectValue placeholder={isNew ? "Choose fabric" : "From design"} /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {catalog?.fabrics.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${p}.colourId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Colour</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full bg-card"><SelectValue placeholder="Choose colour" /></SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-72">
                  {catalog?.colours.map((c) => (
                    <SelectItem key={c.id} value={c.id}><ColourDot hex={c.hex} />{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {numberField("quantity", "Quantity", "1")}
        {numberField("cost", "Cost / piece", "9800")}
        {numberField("mrp", "MRP", "18999")}
        {numberField("price", "Selling price", "14999")}
        <FormField control={control} name={`${p}.location`} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Rack</FormLabel>
            <FormControl><Input placeholder="B-14" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} className="font-mono" /></FormControl>
          </FormItem>
        )} />
      </div>
    </div>
  );
}

/** GST and payment as printed on the supplier bill. Unpaid balance shows up under Payables. */
function BillSection({ control }: { control: Control<Values> }) {
  const v = useWatch({ control });
  const totals = purchaseTotals(billTotalsInput({ lines: (v.lines ?? []) as BillFields["lines"], gstRate: v.gstRate ?? "0", gstAmount: v.gstAmount ?? "", otherCharges: v.otherCharges ?? "" }));
  const paid = Number(v.paidAmount) || 0;
  const balance = Math.max(0, totals.grandTotal - paid);
  const field = (name: "gstRate" | "gstAmount" | "otherCharges" | "paidAmount" | "paidReference" | "dueDate", label: string, o: { placeholder?: string; type?: string; prefix?: string; suffix?: string; description?: string } = {}) => (
    <FormField
      control={control}
      name={name}
      render={({ field: f }) => (
        <FormItem>
          <FormLabel className="text-xs">{label}</FormLabel>
          <div className="relative">
            {o.prefix && <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">{o.prefix}</span>}
            <FormControl>
              <Input type={o.type} inputMode={o.type ? undefined : "numeric"} placeholder={o.placeholder} {...f} className={o.prefix ? "pl-6 tabular" : "tabular"} />
            </FormControl>
            {o.suffix && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">{o.suffix}</span>}
          </div>
          {o.description && <p className="text-[11px] text-muted-foreground">{o.description}</p>}
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <h2 className="mb-1 text-sm font-semibold">GST and payment</h2>
      <p className="mb-4 text-xs text-muted-foreground">As printed on the bill. Leave the GST amount empty to work it out from the rate.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {field("gstRate", "GST rate", { suffix: "%", placeholder: "5" })}
        {field("gstAmount", "GST amount (from bill)", { prefix: "₹", placeholder: String(totals.gstAmount) })}
        {field("otherCharges", "Other charges / round-off", { prefix: "₹", placeholder: "0", description: "Freight, packing. Negative for a discount." })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        {field("paidAmount", "Paid now", { prefix: "₹", placeholder: "0" })}
        <FormField
          control={control}
          name="paidMethod"
          render={({ field: f }) => (
            <FormItem>
              <FormLabel className="text-xs">Paid by</FormLabel>
              <Select value={f.value} onValueChange={f.onChange}>
                <FormControl><SelectTrigger className="w-full bg-card"><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  {(["UPI", "CASH", "CARD", "NETBANKING"] as PaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        {field("paidReference", "Reference", { type: "text", placeholder: "UTR / cheque no." })}
        {field("dueDate", "Balance due by", { type: "date" })}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t pt-3 text-sm sm:grid-cols-4">
        <div className="flex justify-between sm:block"><dt className="text-xs text-muted-foreground">Taxable</dt><dd className="tabular">{formatINR(totals.totalCost)}</dd></div>
        <div className="flex justify-between sm:block"><dt className="text-xs text-muted-foreground">GST</dt><dd className="tabular">{formatINR(totals.gstAmount)}</dd></div>
        <div className="flex justify-between sm:block"><dt className="text-xs text-muted-foreground">Bill total</dt><dd className="font-semibold tabular">{formatINR(totals.grandTotal)}</dd></div>
        <div className="flex justify-between sm:block"><dt className="text-xs text-muted-foreground">Balance payable</dt><dd className={`font-semibold tabular ${balance > 0 ? "text-destructive" : "text-success"}`}>{formatINR(balance)}</dd></div>
      </dl>
    </section>
  );
}

function Summary({ control, pending, mode, onDraft }: { control: Control<Values>; pending: boolean; mode: "draft" | "receive" | null; onDraft: () => void }) {
  const lines = useWatch({ control, name: "lines" });
  const pieces = lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const cost = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.cost || 0), 0);
  const retail = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.price || 0), 0);
  const designs = new Set(lines.map((l) => l.designName.trim().toLowerCase()).filter(Boolean)).size;
  const newDesigns = new Set(lines.filter((l) => l.designName && !l.designId).map((l) => l.designName.trim().toLowerCase())).size;
  return (
    <aside className="rounded-xl border bg-card p-5 shadow-xs lg:sticky lg:top-20">
      <h2 className="text-sm font-semibold">Summary</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Designs</dt><dd className="tabular">{designs}{newDesigns > 0 && <span className="text-muted-foreground"> ({newDesigns} new)</span>}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Pieces</dt><dd className="font-medium tabular">{formatNumber(pieces)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Retail value</dt><dd className="tabular">{formatINR(retail)}</dd></div>
        {retail > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Margin</dt><dd className="tabular">{Math.round((1 - cost / retail) * 100)}%</dd></div>}
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t pt-4">
        <span className="text-sm font-medium">Total cost</span>
        <span className="text-2xl font-semibold tracking-tight tabular">{formatINR(cost)}</span>
      </div>
      <div className="mt-5 space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          <PackageCheck /> {mode === "receive" ? "Receiving…" : `Save & receive ${pieces || ""} ${pieces === 1 ? "piece" : "pieces"}`}
        </Button>
        <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={onDraft}>
          <Save /> {mode === "draft" ? "Saving…" : "Save draft"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Receiving creates one SKU per piece, records stock movements and opens label printing. A draft can be received later.</p>
    </aside>
  );
}
