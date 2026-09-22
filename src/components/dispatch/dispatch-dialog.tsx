"use client";

import { RefreshCw, Truck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Order } from "@/domain/types";
import { useSettings } from "@/hooks/use-catalog";
import { dispatchOrder, suggestAwb } from "@/services/dispatch";
import { useOrderAction } from "@/components/orders/use-order-action";

type DispatchTarget = Pick<Order, "id" | "number" | "customer" | "shippingAddress">;

function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Date input value to a timestamp: now for today, otherwise mid-day of the chosen date. */
function dispatchTimestamp(value: string): number {
  if (value === todayInput()) return Date.now();
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0).getTime();
}

export function DispatchDialog({ order, open, onOpenChange }: { order: DispatchTarget | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">{order && <DispatchForm key={order.id} order={order} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function DispatchForm({ order, onDone }: { order: DispatchTarget; onDone: () => void }) {
  const settings = useSettings();
  const couriers = settings?.shipping.couriers ?? ["DTDC"];
  const [courier, setCourier] = useState<string | null>(null);
  const activeCourier = courier ?? settings?.shipping.defaultCourier ?? "DTDC";
  const [awb, setAwb] = useState("");
  const [date, setDate] = useState(todayInput);
  const { run, pending } = useOrderAction(dispatchOrder, `Order #${order.number} dispatched`);

  const submit = async () => {
    if (await run(order.id, { courier: activeCourier, awb, dispatchedAt: dispatchTimestamp(date) })) onDone();
  };

  const address = order.shippingAddress;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Dispatch order #{order.number}</DialogTitle>
        <DialogDescription>
          {order.customer.name}
          {address && ` · ${address.city}, ${address.state} ${address.pincode}`}. The customer gets the tracking link on WhatsApp.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Courier</Label>
          <Select value={activeCourier} onValueChange={setCourier}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {couriers.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="awb">AWB / tracking number</Label>
          <div className="flex gap-2">
            <Input id="awb" value={awb} onChange={(e) => setAwb(e.target.value.toUpperCase())} placeholder="Scan or type the airway bill number" className="font-mono" autoFocus />
            <Button type="button" variant="outline" onClick={() => setAwb(suggestAwb(activeCourier))}>
              <RefreshCw /> Generate
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dispatch-date">Dispatch date</Label>
          <Input id="dispatch-date" type="date" value={date} max={todayInput()} onChange={(e) => setDate(e.target.value || todayInput())} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || awb.trim().length < 6}>
          <Truck /> Dispatch
        </Button>
      </DialogFooter>
    </>
  );
}
