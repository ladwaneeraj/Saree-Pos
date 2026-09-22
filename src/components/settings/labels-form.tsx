"use client";

import { ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Barcode } from "@/components/shared/barcode";
import { cn } from "@/lib/utils";
import { SaveFooter, SettingsCard, SwitchField, useSettingsForm } from "./settings-kit";

const schema = z.object({
  size: z.enum(["THERMAL_50x25", "A4_3x8"]),
  showDesignName: z.boolean(),
  showColour: z.boolean(),
});

const SIZES = [
  { value: "THERMAL_50x25", title: "Thermal roll, 50 × 25 mm", description: "For TSC, Zebra or TVS barcode printers. One label per piece." },
  { value: "A4_3x8", title: "A4 sheet, 24 labels", description: "3 × 8 sticker sheets on any office printer." },
] as const;

export function LabelsForm() {
  const { form, onSubmit, pending } = useSettingsForm("labels", schema);
  const [showDesign, showColour, size] = form.watch(["showDesignName", "showColour", "size"]);
  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        <SettingsCard title="Barcode labels" description="Printed when stock is received and from any piece or purchase." footer={<SaveFooter form={form} pending={pending} />}>
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-5">
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
              <SwitchField form={form} name="showDesignName" label="Show design name" description="Helps staff find the right rack" />
              <SwitchField form={form} name="showColour" label="Show colour" />
              <div className="flex gap-3 rounded-lg border border-success/25 bg-success-soft p-4 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                <p className="text-success">The price is never printed on labels. When a price changes, the SKU and barcode stay the same, so there is nothing to reprint.</p>
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs text-muted-foreground">Preview</div>
              <div className="flex items-center justify-center rounded-xl bg-muted p-6">
                <div className={cn("flex flex-col items-center justify-center gap-1 rounded-md bg-white px-3 py-2 text-black shadow-sm", size === "A4_3x8" ? "aspect-[70/37] w-60" : "aspect-[2/1] w-56")}>
                  <div className="text-[9px] font-semibold tracking-[0.2em]">DHANVI SILKS</div>
                  <Barcode value="SAR-00122" height={34} moduleWidth={1.3} />
                  <div className="font-mono text-xs font-semibold">SAR-00122</div>
                  {(showDesign || showColour) && (
                    <div className="max-w-full truncate text-[9px]">
                      {[showDesign && "Kanchipuram Bridal Zari Silk", showColour && "Wine"].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </SettingsCard>
      </form>
    </Form>
  );
}
