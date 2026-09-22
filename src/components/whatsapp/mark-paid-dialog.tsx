"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Order } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { markWhatsAppPaid } from "@/services/whatsapp";
import { withOk } from "./with-ok";

const markPaid = withOk(markWhatsAppPaid);

const METHODS = [
  { value: "UPI", label: "UPI" },
  { value: "NETBANKING", label: "Net banking" },
] as const;

export function MarkPaidDialog({ order, conversationId, onOpenChange }: { order: Order | null; conversationId: string; onOpenChange: (o: boolean) => void }) {
  const [method, setMethod] = useState<"UPI" | "NETBANKING">("UPI");
  const [reference, setReference] = useState("");
  const paid = useAction(markPaid, { success: "Payment recorded. Pieces are reserved for this order." });

  const submit = async () => {
    if (!order) return;
    if ((await paid.run(conversationId, order.id, method, reference.trim())) !== undefined) {
      setReference("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark payment received</DialogTitle>
          <DialogDescription>{order ? `Order #${order.number} · ${formatINR(order.total)}. Check your bank or UPI app before confirming.` : ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Payment method">
            {METHODS.map((m) => (
              <button key={m.value} type="button" role="radio" aria-checked={method === m.value} onClick={() => setMethod(m.value)} className={cn("h-8 rounded-md text-sm font-medium", method === m.value ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-ref">{method === "UPI" ? "UPI reference (UTR)" : "Bank reference"}</Label>
            <Input id="wa-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "UPI" ? "426512349876" : "NEFT / IMPS ref"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={paid.pending} data-testid="wa-confirm-paid">Confirm payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
