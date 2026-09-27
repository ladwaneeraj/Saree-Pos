"use client";

import { Info, Plus, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveFooter, SettingsCard, SwitchField, TextField, useSettingsForm } from "./settings-kit";

const num = (min: number, max: number, label: string) => z.number({ error: `Enter ${label}` }).int(`Enter a whole number`).min(min, `At least ${min}`).max(max, `At most ${max}`);

/* Business profile ------------------------------------------------- */

const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter the shop name"),
  legalName: z.string().trim().min(2, "Enter the legal name"),
  tagline: z.string().trim(),
  gstin: z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "GSTIN should look like 29ABCDE1234F1Z5"),
  phone: z.string().trim().min(10, "Enter a phone number"),
  whatsapp: z.string().trim().min(10, "Enter the WhatsApp number"),
  email: z.string().trim().email("Enter a valid email"),
  address: z.string().trim().min(5, "Enter the address"),
  city: z.string().trim().min(2, "Enter the city"),
  state: z.string().trim().min(2, "Enter the state"),
  pincode: z.string().trim().regex(/^\d{6}$/, "6 digit PIN code"),
  website: z.string().trim(),
  shopCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "1 to 6 letters or digits"),
  upiId: z.string().trim().regex(/^$|^[\w.-]{2,}@[a-zA-Z]{2,}$/, "Looks like name@bank"),
  invoiceTerms: z.string().trim(),
});

export function BusinessForm() {
  const { form, onSubmit, pending } = useSettingsForm("business", businessSchema);
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="Business profile" description="Shown on invoices, the website footer, tracking pages and customer messages." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} name="name" label="Shop name" placeholder="Dhanvi Silks" />
            <TextField form={form} name="legalName" label="Legal name" placeholder="Dhanvi Silks & Textiles" />
            <TextField form={form} name="tagline" label="Tagline" className="sm:col-span-2" placeholder="Handpicked silks and handlooms" />
            <TextField form={form} name="gstin" label="GSTIN" upper placeholder="29ABCPA1234K1Z5" />
            <TextField form={form} name="email" label="Email" type="email" />
            <TextField form={form} name="phone" label="Phone" type="tel" />
            <TextField form={form} name="whatsapp" label="WhatsApp number" type="tel" description="Customers reply to this number" />
            <TextField form={form} name="website" label="Website" placeholder="www.dhanvisilks.com" />
            <TextField form={form} name="shopCode" label="Shop code" upper placeholder="DS" description="Used in SKUs ({shop}) and invoice numbers, e.g. DS/26-27/Aug470" />
            <TextField form={form} name="upiId" label="UPI ID for payments" placeholder="shop@okhdfc" description="Unpaid invoices get a QR that opens this payee with the balance filled in" className="sm:col-span-2" />
            <TextField form={form} name="address" label="Address" className="sm:col-span-2" />
            <TextField form={form} name="city" label="City" />
            <div className="grid grid-cols-2 gap-4">
              <TextField form={form} name="state" label="State" />
              <TextField form={form} name="pincode" label="PIN code" />
            </div>
            <FormField
              control={form.control}
              name="invoiceTerms"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Invoice terms & conditions</FormLabel>
                  <FormControl><Textarea rows={4} {...field} /></FormControl>
                  <FormDescription className="text-xs">Printed at the bottom of every invoice and PDF.</FormDescription>
                </FormItem>
              )}
            />
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}

/* Store settings --------------------------------------------------- */

const storeSchema = z.object({
  cartReservationMinutes: num(5, 120, "minutes"),
  posHoldMinutes: num(5, 240, "minutes"),
  whatsappHoldHours: num(1, 72, "hours"),
  lowStockThreshold: num(0, 50, "a threshold"),
  scarcityThreshold: num(0, 10, "a threshold"),
  autoPublishNewDesigns: z.boolean(),
  returnWindowDays: num(0, 30, "days"),
  highValueThreshold: num(1000, 10_00_000, "an amount"),
  inactiveAfterDays: num(30, 730, "days"),
});

export function StoreForm() {
  const { form, onSubmit, pending } = useSettingsForm("store", storeSchema);
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="Store settings" description="How long pieces are held on each channel, stock alerts and customer rules." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="space-y-6">
            <Group title="Reservations" description="A reserved piece cannot be sold anywhere else until the hold ends.">
              <TextField form={form} name="cartReservationMinutes" type="number" label="Website cart hold" suffix="minutes" />
              <TextField form={form} name="posHoldMinutes" type="number" label="POS counter hold" suffix="minutes" />
              <TextField form={form} name="whatsappHoldHours" type="number" label="WhatsApp hold" suffix="hours" description="Until payment is received" />
            </Group>
            <Group title="Stock">
              <TextField form={form} name="lowStockThreshold" type="number" label="Low stock alert at" suffix="pieces" />
              <TextField form={form} name="scarcityThreshold" type="number" label="Show 'Only X left' at" suffix="pieces" description="On the website product page" />
            </Group>
            <SwitchField form={form} name="autoPublishNewDesigns" label="Publish new designs automatically" description="New designs appear on the website as soon as stock is received. Turn off to review photos first." />
            <Group title="Customers">
              <TextField form={form} name="returnWindowDays" type="number" label="Return window" suffix="days" />
              <TextField form={form} name="highValueThreshold" type="number" label="High value customer" prefix="₹" description="Lifetime spend" />
              <TextField form={form} name="inactiveAfterDays" type="number" label="Inactive after" suffix="days" description="Without an order" />
            </Group>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3 grid gap-4 sm:grid-cols-3">{children}</div>
    </div>
  );
}

/* Tax -------------------------------------------------------------- */

const taxSchema = z.object({
  gstRate: z.number({ error: "Enter the GST rate" }).min(0, "At least 0").max(28, "At most 28"),
  pricesIncludeTax: z.boolean(),
  hsnCode: z.string().trim().regex(/^\d{4,8}$/, "HSN is 4 to 8 digits"),
});

export function TaxForm() {
  const { form, onSubmit, pending } = useSettingsForm("tax", taxSchema);
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="Tax / GST" description="Used for the tax split on bills and invoices." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField form={form} name="gstRate" type="number" label="GST rate" suffix="%" />
              <TextField form={form} name="hsnCode" label="Default HSN code" description="5007 is woven silk fabric" />
            </div>
            <SwitchField form={form} name="pricesIncludeTax" label="Selling prices include GST" description="Recommended for retail. The bill shows the GST portion inside the price." />
            <div className="flex gap-3 rounded-lg border border-gold/40 bg-[oklch(0.97_0.03_85)] p-4 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-gold-foreground" />
              <p className="text-gold-foreground">GST on sarees depends on the fabric and the sale value, and rates change. Please confirm the correct rate and HSN codes with your CA before using this for real billing.</p>
            </div>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}

/* Shipping --------------------------------------------------------- */

const shippingSchema = z
  .object({
    flatFee: num(0, 2000, "a fee"),
    freeAbove: num(0, 10_00_000, "an amount"),
    couriers: z.array(z.string().trim().min(1)).min(1, "Add at least one courier"),
    defaultCourier: z.string().min(1, "Choose a default courier"),
    defaultTransitDays: num(1, 20, "days"),
  })
  .refine((v) => v.couriers.includes(v.defaultCourier), { path: ["defaultCourier"], message: "Pick one of your couriers" });

export function ShippingForm() {
  const { form, onSubmit, pending } = useSettingsForm("shipping", shippingSchema);
  const [draft, setDraft] = useState("");
  const couriers = form.watch("couriers") ?? [];
  const add = () => {
    const name = draft.trim();
    if (!name || couriers.some((c: string) => c.toLowerCase() === name.toLowerCase())) return;
    form.setValue("couriers", [...couriers, name], { shouldDirty: true, shouldValidate: true });
    setDraft("");
  };
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="Shipping" description="Charges shown at website checkout and couriers used by the dispatch team." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField form={form} name="flatFee" type="number" label="Flat shipping fee" prefix="₹" />
              <TextField form={form} name="freeAbove" type="number" label="Free shipping above" prefix="₹" />
              <TextField form={form} name="defaultTransitDays" type="number" label="Expected transit" suffix="days" />
            </div>
            <FormField
              control={form.control}
              name="couriers"
              render={() => (
                <FormItem>
                  <FormLabel>Couriers</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {couriers.map((c: string) => (
                      <span key={c} className="inline-flex h-8 items-center gap-1 rounded-full border bg-muted/50 pr-1 pl-3 text-sm">
                        {c}
                        <button
                          type="button"
                          aria-label={`Remove ${c}`}
                          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          onClick={() => form.setValue("couriers", couriers.filter((x: string) => x !== c), { shouldDirty: true, shouldValidate: true })}
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex max-w-sm gap-2">
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add courier, e.g. Shiprocket" />
                    <Button type="button" variant="outline" onClick={add}><Plus /> Add</Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultCourier"
              render={({ field }) => (
                <FormItem className="max-w-sm">
                  <FormLabel>Default courier</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Choose courier" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {couriers.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}
