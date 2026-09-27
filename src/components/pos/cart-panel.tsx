"use client";

import { BadgePercent, CheckCircle2, ChevronDown, MessageCircle, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { Order, PaymentMethod } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useSettings } from "@/hooks/use-catalog";
import { formatINR, formatINRPaise } from "@/lib/format";
import { cn } from "@/lib/utils";
import { completePosSale, posClear } from "@/services/pos";
import type { HeldLine } from "@/services/reservations";
import { SHOP_UPI_ID } from "@/services/whatsapp";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { CartLines } from "./cart-lines";
import { CustomerPicker } from "./customer-picker";
import { PaymentSection } from "./payment-section";
import { usePosDraft } from "./pos-store";
import { computePosTotals, planPayments } from "./pos-totals";

const clearBill = async () => {
  await posClear();
  return true;
};

export function CartPanel({ lines, onCompleted, onClose, className }: { lines: HeldLine[] | undefined; onCompleted: (order: Order) => void; onClose?: () => void; className?: string }) {
  const settings = useSettings();
  const draft = usePosDraft();
  const { confirm, dialog } = useConfirm();
  const clear = useAction(clearBill, { success: "Bill cleared. Pieces are back in stock." });
  const complete = useAction(completePosSale);

  const gstRate = settings?.tax.gstRate ?? 5;
  const totals = computePosTotals(lines ?? [], draft, gstRate);
  const [creditMethod, setCreditMethod] = useState<PaymentMethod>("CASH");
  const plan = planPayments(totals.total, draft.tender, draft.tendered, draft.reference, draft.split, creditMethod);
  const count = lines?.length ?? 0;
  const needsCustomer = draft.tender === "CREDIT" && !draft.customer;
  const canComplete = count > 0 && plan.valid && !needsCustomer && !complete.pending;

  const onClear = async () => {
    const ok = await confirm({
      title: "Clear this bill?",
      description: `${count} piece${count === 1 ? "" : "s"} will be released back to stock and can be sold on the website again.`,
      confirmLabel: "Clear bill",
      destructive: true,
    });
    if (ok && (await clear.run()) !== undefined) draft.reset();
  };

  const onComplete = async () => {
    if (!lines) return;
    const ids = new Set(lines.map((l) => l.item.id));
    const lineDiscounts = Object.fromEntries(Object.entries(draft.lineDiscounts).filter(([id, v]) => ids.has(id) && v > 0));
    const c = draft.customer;
    const order = await complete.run({
      lineDiscounts,
      orderDiscount: totals.orderDiscount,
      customer: c ? (c.kind === "existing" ? { id: c.id } : { name: c.name, phone: c.phone }) : null,
      payments: plan.payments,
      credit: plan.credit,
      sendReceipt: !!c && draft.sendReceipt,
    });
    if (order) {
      draft.reset();
      onCompleted(order);
    }
  };

  return (
    <section className={cn("flex min-h-0 flex-col bg-card", className)} aria-label="Current bill">
      <div className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <ShoppingBag className="size-4 text-primary" />
        <h2 className="font-semibold">Current bill</h2>
        {count > 0 && <span className="rounded-full bg-wine-50 px-2 py-0.5 text-xs font-semibold text-primary tabular" data-testid="pos-count">{count} {count === 1 ? "saree" : "sarees"}</span>}
        <div className="ml-auto flex items-center gap-1">
          {count > 0 && (
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={onClear} disabled={clear.pending}>
              <Trash2 /> Clear
            </Button>
          )}
          {onClose && <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close bill"><ChevronDown /></Button>}
        </div>
      </div>

      <div className="border-b px-4 py-3 sm:px-5"><CustomerPicker /></div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!lines ? (
          <div className="space-y-3 p-5">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (
          <CartLines lines={lines} />
        )}
      </div>

      <div className="space-y-3 border-t bg-background/60 px-4 py-3 sm:px-5">
        <dl className="space-y-1 text-sm">
          <Row label={`Subtotal${totals.lineDiscount ? ` (after ${formatINR(totals.lineDiscount)} item discounts)` : ""}`} value={formatINR(totals.subtotal)} />
          <div className="flex items-center justify-between">
            <DiscountEditor subtotal={totals.subtotal} amount={totals.orderDiscount} />
            <span className={cn("tabular", totals.orderDiscount ? "text-success" : "text-muted-foreground")}>{totals.orderDiscount ? `− ${formatINR(totals.orderDiscount)}` : formatINR(0)}</span>
          </div>
          <div className="flex items-baseline justify-between pt-1">
            <dt className="font-semibold">Total</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular" data-testid="pos-total">{formatINR(totals.total)}</dd>
          </div>
          <div className="text-xs text-muted-foreground">
            <div className="flex justify-between"><span>GST {gstRate}% included</span><span className="tabular">{formatINRPaise(totals.tax.tax)}</span></div>
            <div className="text-[11px] tabular">Taxable {formatINRPaise(totals.tax.taxable)} · CGST {formatINRPaise(totals.tax.cgst)} · SGST {formatINRPaise(totals.tax.sgst)}</div>
          </div>
        </dl>

        <PaymentSection total={totals.total} plan={plan} upiId={settings?.business.upiId || SHOP_UPI_ID} hasCustomer={!!draft.customer} creditMethod={creditMethod} onCreditMethod={setCreditMethod} />

        {draft.customer && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={draft.sendReceipt} onCheckedChange={draft.setSendReceipt} aria-label="Send bill on WhatsApp" />
            <MessageCircle className="size-4 text-success" /> Send bill on WhatsApp to +91 {draft.customer.phone}
          </label>
        )}

        <Button size="lg" className="h-12 w-full rounded-xl text-base" disabled={!canComplete} onClick={onComplete} data-testid="pos-complete">
          <CheckCircle2 className="size-5" />
          {complete.pending ? "Completing sale…" : plan.credit > 0 ? `Complete sale · ${formatINR(plan.credit)} due later` : `Complete sale · ${formatINR(totals.total)}`}
        </Button>
      </div>
      {dialog}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function DiscountEditor({ subtotal, amount }: { subtotal: number; amount: number }) {
  const mode = usePosDraft((s) => s.discountMode);
  const value = usePosDraft((s) => s.discountValue);
  const setDiscount = usePosDraft((s) => s.setDiscount);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" data-testid="pos-discount">
          <BadgePercent className="size-4" />
          {amount ? `Bill discount${mode === "PERCENT" ? ` (${value}%)` : ""}` : "Add bill discount"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div className="text-sm font-medium">Discount on the whole bill</div>
        <div className="flex gap-2">
          <div className="grid grid-cols-2 rounded-lg bg-muted p-0.5">
            {(["AMOUNT", "PERCENT"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setDiscount(m, 0)} className={cn("h-8 w-10 rounded-md text-sm font-medium", mode === m ? "bg-card shadow-sm" : "text-muted-foreground")}>
                {m === "AMOUNT" ? "₹" : "%"}
              </button>
            ))}
          </div>
          <Input
            autoFocus
            inputMode="numeric"
            value={value || ""}
            onChange={(e) => setDiscount(mode, Number(e.target.value.replace(/[^\d]/g, "")) || 0)}
            onKeyDown={(e) => e.key === "Enter" && setOpen(false)}
            placeholder={mode === "AMOUNT" ? "Amount" : "Percent"}
            className="tabular"
            aria-label="Bill discount"
          />
        </div>
        {mode === "PERCENT" && (
          <div className="flex gap-1.5">
            {[5, 10, 15].map((p) => <Button key={p} size="xs" variant="outline" onClick={() => setDiscount("PERCENT", p)}>{p}%</Button>)}
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>On {formatINR(subtotal)}</span>
          {value > 0 && <button type="button" className="text-destructive hover:underline" onClick={() => setDiscount(mode, 0)}>Remove discount</button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
