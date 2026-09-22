"use client";

import { MapPin, Store, Truck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Address, Customer } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useSettings } from "@/hooks/use-catalog";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HeldLine } from "@/services/reservations";
import { createWhatsAppOrder } from "@/services/whatsapp";

type AddressFields = Pick<Address, "line1" | "line2" | "city" | "state" | "pincode">;

export function CreateOrderDialog({
  open,
  onOpenChange,
  conversationId,
  defaultName,
  customer,
  held,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string;
  defaultName: string;
  customer: Customer | undefined;
  held: HeldLine[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <OrderForm key={conversationId} conversationId={conversationId} defaultName={defaultName} customer={customer} held={held} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function OrderForm({ conversationId, defaultName, customer, held, onDone }: { conversationId: string; defaultName: string; customer: Customer | undefined; held: HeldLine[]; onDone: () => void }) {
  const settings = useSettings();
  const saved = customer?.addresses[0];
  const [fulfilment, setFulfilment] = useState<"SHIPPING" | "IN_STORE">("SHIPPING");
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState<AddressFields>({
    line1: saved?.line1 ?? "",
    line2: saved?.line2 ?? "",
    city: saved?.city ?? "",
    state: saved?.state ?? "Karnataka",
    pincode: saved?.pincode ?? "",
  });
  const [discount, setDiscount] = useState("");
  const [touched, setTouched] = useState(false);
  const create = useAction(createWhatsAppOrder, { success: (o) => `Order #${o.number} created. Send the payment request next.` });

  const subtotal = held.reduce((s, l) => s + l.price, 0);
  const disc = Math.min(Number(discount) || 0, subtotal);
  const shipping = fulfilment === "SHIPPING" && settings && subtotal < settings.shipping.freeAbove ? settings.shipping.flatFee : 0;
  const total = subtotal - disc + shipping;

  const errors = {
    name: !name.trim() ? "Enter the customer's name" : null,
    line1: fulfilment === "SHIPPING" && !address.line1.trim() ? "Enter the house / street" : null,
    city: fulfilment === "SHIPPING" && !address.city.trim() ? "Enter the city" : null,
    pincode: fulfilment === "SHIPPING" && !/^\d{6}$/.test(address.pincode) ? "Pincode must be 6 digits" : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const set = (k: keyof AddressFields, v: string) => setAddress((a) => ({ ...a, [k]: v }));

  const submit = async () => {
    setTouched(true);
    if (!valid) return;
    const order = await create.run(conversationId, {
      fulfilment,
      name: name.trim(),
      discount: disc,
      address: fulfilment === "SHIPPING" ? { ...address, line1: address.line1.trim(), city: address.city.trim(), state: address.state.trim() } : null,
    });
    if (order) onDone();
  };

  const err = (k: keyof typeof errors) => touched && errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create WhatsApp order</DialogTitle>
        <DialogDescription>
          {held.length} held saree{held.length === 1 ? "" : "s"} become an order awaiting payment. Pieces stay reserved for {settings?.store.whatsappHoldHours ?? 24} hours.
        </DialogDescription>
      </DialogHeader>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-0.5">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Fulfilment">
          {([
            { v: "SHIPPING", icon: Truck, title: "Ship to address", text: settings ? `Free above ${formatINR(settings.shipping.freeAbove)}` : "" },
            { v: "IN_STORE", icon: Store, title: "Pickup at store", text: "Customer collects at the shop" },
          ] as const).map((o) => (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={fulfilment === o.v}
              onClick={() => setFulfilment(o.v)}
              className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors", fulfilment === o.v ? "border-primary bg-wine-50 ring-1 ring-primary" : "hover:bg-accent")}
            >
              <o.icon className={cn("mt-0.5 size-4", fulfilment === o.v ? "text-primary" : "text-muted-foreground")} />
              <span>
                <span className="block text-sm font-medium">{o.title}</span>
                <span className="block text-xs text-muted-foreground">{o.text}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-name">Customer name</Label>
          <Input id="wa-name" value={name} onChange={(e) => setName(e.target.value)} />
          {err("name")}
        </div>
        {fulfilment === "SHIPPING" && (
          <fieldset className="space-y-3 rounded-xl border p-3">
            <legend className="flex items-center gap-1.5 px-1 text-sm font-medium"><MapPin className="size-4 text-primary" /> Delivery address</legend>
            <div className="space-y-1.5">
              <Label htmlFor="wa-line1">House, street</Label>
              <Input id="wa-line1" value={address.line1} onChange={(e) => set("line1", e.target.value)} placeholder="No. 42, 3rd Cross, Vidyanagar" />
              {err("line1")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-line2">Area, landmark (optional)</Label>
              <Input id="wa-line2" value={address.line2} onChange={(e) => set("line2", e.target.value)} placeholder="Near Ganesha temple" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="wa-city">City</Label>
                <Input id="wa-city" value={address.city} onChange={(e) => set("city", e.target.value)} placeholder="Davanagere" />
                {err("city")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-state">State</Label>
                <Input id="wa-state" value={address.state} onChange={(e) => set("state", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-pin">Pincode</Label>
                <Input id="wa-pin" inputMode="numeric" maxLength={6} value={address.pincode} onChange={(e) => set("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="577002" aria-invalid={touched && !!errors.pincode} />
                {err("pincode")}
              </div>
            </div>
          </fieldset>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="wa-disc">Discount (₹)</Label>
          <Input id="wa-disc" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-40" />
        </div>
        <dl className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
          {held.map((l) => (
            <div key={l.item.id} className="flex justify-between gap-3">
              <dt className="truncate text-muted-foreground">{l.design.name} <span className="font-mono text-xs">{l.item.sku}</span></dt>
              <dd className="tabular">{formatINR(l.price)}</dd>
            </div>
          ))}
          {disc > 0 && <div className="flex justify-between text-success"><dt>Discount</dt><dd className="tabular">− {formatINR(disc)}</dd></div>}
          {fulfilment === "SHIPPING" && <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd className="tabular">{shipping ? formatINR(shipping) : "Free"}</dd></div>}
          <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Total</dt><dd className="tabular">{formatINR(total)}</dd></div>
        </dl>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button onClick={submit} disabled={create.pending || held.length === 0} data-testid="wa-create-order-submit">Create order · {formatINR(total)}</Button>
      </DialogFooter>
    </>
  );
}
