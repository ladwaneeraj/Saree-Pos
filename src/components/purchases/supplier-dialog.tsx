"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { Supplier } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { createSupplier } from "@/services/catalog";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the supplier's business name"),
  contactName: z.string().trim(),
  phone: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{4}\s?\d{5}$|^$/, "Enter a 10 digit Indian mobile number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  city: z.string().trim(),
  gstin: z.string().trim().toUpperCase().regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, "GSTIN should look like 29ABCDE1234F1Z5"),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{0,6}$/, "Up to 6 letters or digits"),
});
type Values = z.infer<typeof schema>;

const FIELDS: { name: keyof Values; label: string; placeholder: string; span?: boolean }[] = [
  { name: "name", label: "Business name", placeholder: "Sri Lakshmi Silk Weavers", span: true },
  { name: "contactName", label: "Contact person", placeholder: "Venkatesh R" },
  { name: "phone", label: "Phone", placeholder: "98450 12345" },
  { name: "city", label: "City", placeholder: "Kanchipuram" },
  { name: "email", label: "Email", placeholder: "orders@example.in" },
  { name: "gstin", label: "GSTIN (optional)", placeholder: "33ABCDE1234F1Z5" },
  { name: "code", label: "Vendor code for SKUs", placeholder: "VS" },
];

export function SupplierDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (s: Supplier) => void }) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", contactName: "", phone: "", email: "", city: "", gstin: "", code: "" } });
  const { run, pending } = useAction(createSupplier, { success: (s) => `${s.name} added` });

  const submit = form.handleSubmit(async (values) => {
    const supplier = await run(values);
    if (supplier) {
      onCreated(supplier);
      form.reset();
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add supplier</DialogTitle>
          <DialogDescription>Weavers, wholesalers or agents you buy sarees from.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="supplier-form" onSubmit={(e) => { e.stopPropagation(); void submit(e); }} className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <FormField
                key={f.name}
                control={form.control}
                name={f.name}
                render={({ field }) => (
                  <FormItem className={f.span ? "sm:col-span-2" : undefined}>
                    <FormLabel>{f.label}</FormLabel>
                    <FormControl>
                      <Input placeholder={f.placeholder} autoFocus={f.name === "name"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </form>
        </Form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="supplier-form" disabled={pending}>Add supplier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
