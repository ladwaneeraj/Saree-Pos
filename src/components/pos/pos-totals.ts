import type { PaymentMethod } from "@/domain/types";
import { splitInclusiveTax, type TaxBreakdown } from "@/domain/rules/pricing";
import type { HeldLine } from "@/services/reservations";
import type { PosTender, SplitRow } from "./pos-store";

export interface PosTotals {
  gross: number;
  lineDiscount: number;
  subtotal: number;
  orderDiscount: number;
  total: number;
  tax: TaxBreakdown;
}

export function computePosTotals(
  lines: HeldLine[],
  draft: { lineDiscounts: Record<string, number>; discountMode: "AMOUNT" | "PERCENT"; discountValue: number },
  gstRate: number,
): PosTotals {
  const gross = lines.reduce((s, l) => s + l.price, 0);
  const lineDiscount = lines.reduce((s, l) => s + Math.min(draft.lineDiscounts[l.item.id] ?? 0, l.price), 0);
  const subtotal = gross - lineDiscount;
  const raw = draft.discountMode === "PERCENT" ? Math.round((subtotal * Math.min(draft.discountValue, 100)) / 100) : Math.round(draft.discountValue);
  const orderDiscount = Math.max(0, Math.min(raw, subtotal));
  const total = subtotal - orderDiscount;
  return { gross, lineDiscount, subtotal, orderDiscount, total, tax: splitInclusiveTax(total, gstRate) };
}

export interface PaymentPlan {
  payments: { method: PaymentMethod; amount: number; reference?: string }[];
  valid: boolean;
  /** Amount still to allocate (split) or cash short (cash). Positive means more is needed. */
  remaining: number;
  change: number;
  message: string | null;
}

export function planPayments(total: number, tender: PosTender, tendered: string, reference: string, split: SplitRow[]): PaymentPlan {
  const ref = reference.trim() || undefined;
  if (tender === "SPLIT") {
    const rows = split.map((r) => ({ method: r.method, amount: Number(r.amount) || 0 })).filter((r) => r.amount > 0);
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    const remaining = total - sum;
    return {
      payments: rows,
      valid: total > 0 && remaining === 0 && rows.length > 0,
      remaining,
      change: 0,
      message: remaining > 0 ? "still to allocate" : remaining < 0 ? "more than the total" : null,
    };
  }
  if (tender === "CASH") {
    const given = tendered.trim() === "" ? total : Number(tendered) || 0;
    const short = total - given;
    return {
      payments: [{ method: "CASH", amount: total }],
      valid: total > 0 && short <= 0,
      remaining: Math.max(0, short),
      change: Math.max(0, -short),
      message: short > 0 ? "short" : null,
    };
  }
  return { payments: [{ method: tender, amount: total, reference: ref }], valid: total > 0, remaining: 0, change: 0, message: null };
}

/** Quick cash buttons: exact, then the next round notes above the total. */
export function cashSuggestions(total: number): number[] {
  if (total <= 0) return [];
  const steps = [100, 500, 1000, 2000];
  const out = new Set<number>([total]);
  for (const s of steps) out.add(Math.ceil(total / s) * s);
  return [...out].sort((a, b) => a - b).slice(0, 4);
}
