"use client";

import { Banknote, BookOpen, CreditCard, Plus, QrCode, Split, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PaymentMethod } from "@/domain/types";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/services/orders";
import { newSplitRow, usePosDraft, type PosTender } from "./pos-store";
import { cashSuggestions, type PaymentPlan } from "./pos-totals";

const TENDERS: { value: PosTender; label: string; icon: typeof Banknote }[] = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "UPI", label: "UPI", icon: QrCode },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "SPLIT", label: "Split", icon: Split },
  { value: "CREDIT", label: "Pay later", icon: BookOpen },
];

const SPLIT_METHODS: PaymentMethod[] = ["CASH", "UPI", "CARD"];

export function PaymentSection({ total, plan, upiId, hasCustomer, creditMethod, onCreditMethod }: { total: number; plan: PaymentPlan; upiId: string; hasCustomer: boolean; creditMethod: PaymentMethod; onCreditMethod: (m: PaymentMethod) => void }) {
  const { tender, setTender, tendered, setTendered, reference, setReference, split, setSplit } = usePosDraft();

  const updateRow = (id: string, patch: Partial<{ method: PaymentMethod; amount: string }>) => setSplit(split.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-5 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Payment method">
        {TENDERS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={tender === t.value}
            onClick={() => setTender(t.value)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
              tender === t.value ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tender === "CASH" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input inputMode="numeric" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))} placeholder={total ? String(total) : "Cash received"} className="bg-card pl-7 tabular" aria-label="Cash received" />
            </div>
            <div className={cn("min-w-28 text-right text-sm", plan.remaining > 0 && "text-destructive")}>
              {plan.remaining > 0 ? (
                <>Short <span className="font-semibold tabular">{formatINR(plan.remaining)}</span></>
              ) : (
                <>Change <span className="font-semibold text-success tabular" data-testid="pos-change">{formatINR(plan.change)}</span></>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cashSuggestions(total).map((v) => (
              <Button key={v} type="button" size="xs" variant="outline" className="bg-card tabular" onClick={() => setTendered(String(v))}>
                {v === total ? "Exact" : formatINR(v)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {(tender === "UPI" || tender === "CARD") && (
        <div className="flex items-center gap-2">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={tender === "UPI" ? "UPI reference / UTR (optional)" : "Card approval code (optional)"} className="bg-card" />
          {tender === "UPI" && <span className="hidden text-xs whitespace-nowrap text-muted-foreground sm:block">Pay to {upiId}</span>}
        </div>
      )}

      {tender === "CREDIT" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select value={creditMethod} onValueChange={(v) => onCreditMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-28 bg-card" aria-label="Advance method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPLIT_METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <Input inputMode="numeric" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))} placeholder="0" className="bg-card pl-7 tabular" aria-label="Amount received now" />
            </div>
            <div className="min-w-28 text-right text-sm">
              Balance <span className={cn("font-semibold tabular", plan.credit > 0 ? "text-destructive" : "text-muted-foreground")}>{formatINR(plan.credit)}</span>
            </div>
          </div>
          <p className={cn("text-xs", hasCustomer ? "text-muted-foreground" : "text-destructive")}>
            {hasCustomer
              ? "The balance is recorded against the customer. The invoice carries a UPI QR for the amount due."
              : "Add the customer first so the balance has a name and number against it."}
          </p>
          {plan.message && <p className="text-xs text-destructive">{plan.message}</p>}
        </div>
      )}

      {tender === "SPLIT" && (
        <div className="space-y-1.5">
          {split.map((row, i) => (
            <div key={row.id} className="flex items-center gap-2" data-testid="split-row">
              <Select value={row.method} onValueChange={(v) => updateRow(row.id, { method: v as PaymentMethod })}>
                <SelectTrigger className="w-28 bg-card" aria-label={`Split ${i + 1} method`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPLIT_METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input inputMode="numeric" value={row.amount} onChange={(e) => updateRow(row.id, { amount: e.target.value.replace(/\D/g, "") })} className="bg-card pl-7 tabular" aria-label={`Split ${i + 1} amount`} />
              </div>
              {plan.remaining > 0 && (
                <Button type="button" size="xs" variant="ghost" className="text-primary" onClick={() => updateRow(row.id, { amount: String((Number(row.amount) || 0) + plan.remaining) })}>
                  +Rest
                </Button>
              )}
              <Button type="button" size="icon-sm" variant="ghost" disabled={split.length <= 2} onClick={() => setSplit(split.filter((r) => r.id !== row.id))} aria-label="Remove split row">
                <X />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between">
            {split.length < 4 ? (
              <Button type="button" size="xs" variant="ghost" onClick={() => setSplit([...split, newSplitRow("CARD")])}><Plus /> Add payment</Button>
            ) : <span />}
            <span className={cn("text-xs", plan.remaining === 0 ? "text-success" : "text-destructive")}>
              {plan.remaining === 0 ? "Balanced with the total" : `${formatINR(Math.abs(plan.remaining))} ${plan.message}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
