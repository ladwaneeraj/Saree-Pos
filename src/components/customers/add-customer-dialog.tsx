"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SalesChannel } from "@/domain/types";
import { isValidIndianMobile } from "@/domain/rules/customers";
import { useAction } from "@/hooks/use-action";
import { createCustomer } from "@/services/customers";

const EMPTY = { name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "Karnataka", pincode: "", source: "SHOP" as SalesChannel };

export function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [f, setF] = useState(EMPTY);
  const [touched, setTouched] = useState(false);
  const { run, pending } = useAction(createCustomer, { success: (c) => `${c.name} added` });
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const phoneOk = isValidIndianMobile(f.phone);
  const hasAddress = !!f.line1.trim();
  const addressOk = !hasAddress || (!!f.city.trim() && /^\d{6}$/.test(f.pincode.trim()));
  const valid = !!f.name.trim() && phoneOk && addressOk;

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    const c = await run({
      name: f.name,
      phone: f.phone,
      email: f.email,
      source: f.source,
      address: hasAddress ? { name: f.name.trim(), phone: f.phone, line1: f.line1.trim(), line2: f.line2.trim(), city: f.city.trim(), state: f.state.trim(), pincode: f.pincode.trim() } : undefined,
    });
    if (c) {
      setF(EMPTY);
      setTouched(false);
      onOpenChange(false);
      router.push(`/customers/view?id=${c.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
          <DialogDescription>Customers are matched by mobile number across the shop, website and WhatsApp.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" className="sm:col-span-2" error={touched && !f.name.trim() ? "Name is required" : undefined}>
            <Input value={f.name} onChange={set("name")} placeholder="Lakshmi Prasad" autoFocus />
          </Field>
          <Field label="Mobile number" error={touched && !phoneOk ? "Enter a valid 10-digit mobile number" : undefined}>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-2.5 text-sm text-muted-foreground">+91</span>
              <Input value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} inputMode="numeric" placeholder="98450 12345" className="rounded-l-none" />
            </div>
          </Field>
          <Field label="Email (optional)">
            <Input type="email" value={f.email} onChange={set("email")} placeholder="name@example.com" />
          </Field>
          <Field label="Address (optional)" className="sm:col-span-2">
            <Input value={f.line1} onChange={set("line1")} placeholder="House no., street" />
          </Field>
          <Field label="Area / landmark" className="sm:col-span-2">
            <Input value={f.line2} onChange={set("line2")} placeholder="Near Gandhi Circle" />
          </Field>
          <Field label="City" error={touched && hasAddress && !f.city.trim() ? "City is required" : undefined}>
            <Input value={f.city} onChange={set("city")} placeholder="Davanagere" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <Input value={f.state} onChange={set("state")} />
            </Field>
            <Field label="PIN code" error={touched && hasAddress && !/^\d{6}$/.test(f.pincode.trim()) ? "6 digits" : undefined}>
              <Input value={f.pincode} onChange={(e) => setF((x) => ({ ...x, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} inputMode="numeric" placeholder="577001" />
            </Field>
          </div>
          <Field label="First contact via">
            <Select value={f.source} onValueChange={(v) => setF((x) => ({ ...x, source: v as SalesChannel }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SHOP">Shop visit</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="WEBSITE">Website</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            <UserPlus /> Add customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1.5">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
