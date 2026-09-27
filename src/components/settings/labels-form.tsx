"use client";

import { Info } from "lucide-react";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/inventory/label-sheet";
import { skuFromTemplate, validatePriceCipher, validateSkuTemplate } from "@/domain/rules/labels";
import { useSettings } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";
import { SaveFooter, SettingsCard, SwitchField, TextField, useSettingsForm } from "./settings-kit";

const schema = z.object({
  size: z.enum(["THERMAL_50x25", "A4_3x8"]),
  skuTemplate: z.string().trim().superRefine((t, ctx) => { const m = validateSkuTemplate(t); if (m) ctx.addIssue({ code: "custom", message: m }); }),
  defaultVendorCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{0,6}$/, "Up to 6 letters or digits"),
  headerText: z.string().trim(),
  showDesignName: z.boolean(),
  showColour: z.boolean(),
  showFabric: z.boolean(),
  showPattern: z.boolean(),
  showPrice: z.boolean(),
  priceMode: z.enum(["PLAIN", "CODED"]),
  priceCipher: z.string().trim().toUpperCase().superRefine((c, ctx) => { const m = validatePriceCipher(c); if (m) ctx.addIssue({ code: "custom", message: m }); }),
});

const SIZES = [
  { value: "THERMAL_50x25", title: "Thermal roll, 50 × 25 mm", description: "For TSC, Zebra or TVS barcode printers. One label per piece." },
  { value: "A4_3x8", title: "A4 sheet, 24 labels", description: "3 × 8 sticker sheets on any office printer." },
] as const;

const TOKENS: { token: string; meaning: string }[] = [
  { token: "{shop}", meaning: "Shop code from Business profile" },
  { token: "{vendor}", meaning: "Supplier code (set on each supplier)" },
  { token: "{pattern}", meaning: "Pattern code from Catalogue lists" },
  { token: "{fabric}", meaning: "First 3 letters of the fabric" },
  { token: "{seq:4}", meaning: "Running number, 4 digits (required)" },
];

export function LabelsForm() {
  const { form, onSubmit, pending } = useSettingsForm("labels", schema);
  const settings = useSettings();
  const v = form.watch();
  const example = skuFromTemplate(v.skuTemplate || "", { shopCode: settings?.business.shopCode || "DS", vendorCode: "VS", patternCode: "CHC", fabricName: "Kanchipuram", seq: 470 });
  const preview = { itemId: "x", sku: example || "SKU", designName: "Kanchipuram Bridal Zari Silk", fabricName: "Kanchipuram", colourName: "Wine", pattern: "Checks", price: 9900 };
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="SKU format and labels" description="How new pieces are numbered and what the sticker shows. Existing SKUs never change." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <div className="space-y-6">
              <div className="space-y-3">
                <TextField form={form} name="skuTemplate" label="SKU format for new pieces" placeholder="{shop}{vendor}{pattern}{seq:4}" description={<>Example with today&apos;s settings: <span className="font-mono font-medium text-foreground">{example || "…"}</span></>} />
                <div className="grid gap-1 rounded-lg border bg-muted/40 p-3 text-xs sm:grid-cols-2">
                  {TOKENS.map((t) => (
                    <div key={t.token}><span className="font-mono font-medium">{t.token}</span> <span className="text-muted-foreground">{t.meaning}</span></div>
                  ))}
                  <div className="text-muted-foreground sm:col-span-2">Anything else, like a dash, is printed as typed. Only new pieces get the new format.</div>
                </div>
                <TextField form={form} name="defaultVendorCode" label="Vendor code when no supplier is chosen" upper placeholder="XX" />
              </div>

              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label size</FormLabel>
                    <FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2">
                        {SIZES.map((s) => (
                          <label key={s.value} className={cn("flex cursor-pointer gap-3 rounded-lg border p-4", field.value === s.value && "border-primary/40 bg-wine-50/50 ring-1 ring-primary/20")}>
                            <RadioGroupItem value={s.value} className="mt-0.5" />
                            <div>
                              <div className="text-sm font-medium">{s.title}</div>
                              <div className="text-xs text-muted-foreground">{s.description}</div>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <TextField form={form} name="headerText" label="Label heading" placeholder={settings?.business.name ?? "Shop name"} description="Leave empty to print the shop name" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SwitchField form={form} name="showDesignName" label="Design name" />
                  <SwitchField form={form} name="showColour" label="Colour" />
                  <SwitchField form={form} name="showFabric" label="Fabric" />
                  <SwitchField form={form} name="showPattern" label="Pattern" />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <SwitchField form={form} name="showPrice" label="Print shop price" description="Off keeps labels price-free, so price changes never need reprinting." />
                {v.showPrice && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="priceMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price style</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="PLAIN">Plain rupees (Rs. 9,900)</SelectItem>
                              <SelectItem value="CODED">Coded letters (staff only)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {v.priceMode === "CODED" && (
                      <TextField form={form} name="priceCipher" label="Price code letters" upper placeholder="SILKWEAVER" description="10 different letters for digits 0 to 9. S=0, I=1, L=2 …" />
                    )}
                  </div>
                )}
                <p className="flex gap-2 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> The barcode always encodes only the SKU. Billing looks the price up, so a label with an old price still scans correctly.</p>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-muted-foreground">Preview</div>
              <div className="flex items-center justify-center rounded-xl bg-muted p-6">
                <div className="[zoom:1.5] rounded-sm shadow-sm ring-1 ring-black/10">
                  <Label label={preview} options={{ ...v, headerText: v.headerText || settings?.business.name || "" }} />
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}
