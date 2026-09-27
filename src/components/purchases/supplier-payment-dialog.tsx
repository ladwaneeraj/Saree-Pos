"use client";

import { Banknote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentMethod, Purchase } from "@/domain/types";
import { purchaseBalance } from "@/domain/rules/payments";
import { useAction } from "@/hooks/use-action";
import { formatINR } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/services/orders";
import { recordPurchasePayment } from "@/services/purchases";

export function SupplierPaymentDialog({ purchase, supplierName, open, onOpenChange }: { purchase: Purchase; supplierName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const due = purchaseBalance(purchase);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [reference, setReference] = useState("");
  const { run, pending } = useAction(recordPurchasePayment, { success: "Supplier payment recorded" });
  const value = Number(amount) || 0;
  const valid = value > 0 && value <= due;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay {supplierName}</DialogTitle>
          <DialogDescription>{formatINR(due)} is due on {purchase.number} (bill {purchase.invoiceNumber}).</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="sp-amount">Amount</Label>
            <Input id="sp-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} className="tabular" aria-invalid={!valid || undefined} />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["UPI", "CASH", "CARD", "NETBANKING"] as const).map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label htmlFor="sp-ref">Reference (optional)</Label>
            <Input id="sp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." className="font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={pending || !valid} onClick={async () => { if (await run(purchase.id, { amount: value, method, reference })) onOpenChange(false); }}>
            <Banknote /> Record {formatINR(value)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
