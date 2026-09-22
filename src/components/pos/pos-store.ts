"use client";

import { create } from "zustand";
import type { PaymentMethod } from "@/domain/types";
import { newId } from "@/lib/id";

export type PosTender = "CASH" | "UPI" | "CARD" | "SPLIT";

export type PosCustomer =
  | { kind: "existing"; id: string; name: string; phone: string }
  | { kind: "new"; name: string; phone: string };

export interface SplitRow {
  id: string;
  method: PaymentMethod;
  amount: string;
}

interface PosDraftState {
  lineDiscounts: Record<string, number>;
  discountMode: "AMOUNT" | "PERCENT";
  discountValue: number;
  customer: PosCustomer | null;
  tender: PosTender;
  tendered: string;
  reference: string;
  split: SplitRow[];
  sendReceipt: boolean;
  lastAddedId: string | null;
  setLineDiscount: (itemId: string, amount: number) => void;
  setDiscount: (mode: "AMOUNT" | "PERCENT", value: number) => void;
  setCustomer: (c: PosCustomer | null) => void;
  setTender: (t: PosTender) => void;
  setTendered: (v: string) => void;
  setReference: (v: string) => void;
  setSplit: (rows: SplitRow[]) => void;
  setSendReceipt: (v: boolean) => void;
  markAdded: (itemId: string | null) => void;
  reset: () => void;
}

export const newSplitRow = (method: PaymentMethod, amount = ""): SplitRow => ({ id: newId("spl"), method, amount });

const initial = () => ({
  lineDiscounts: {},
  discountMode: "AMOUNT" as const,
  discountValue: 0,
  customer: null,
  tender: "CASH" as const,
  tendered: "",
  reference: "",
  split: [newSplitRow("CASH"), newSplitRow("UPI")],
  sendReceipt: true,
  lastAddedId: null,
});

/** Draft of the sale being billed. The pieces themselves live in the database as counter holds. */
export const usePosDraft = create<PosDraftState>()((set) => ({
  ...initial(),
  setLineDiscount: (itemId, amount) => set((s) => ({ lineDiscounts: { ...s.lineDiscounts, [itemId]: Math.max(0, Math.round(amount) || 0) } })),
  setDiscount: (discountMode, value) => set({ discountMode, discountValue: Math.max(0, value || 0) }),
  setCustomer: (customer) => set({ customer }),
  setTender: (tender) => set({ tender }),
  setTendered: (tendered) => set({ tendered }),
  setReference: (reference) => set({ reference }),
  setSplit: (split) => set({ split }),
  setSendReceipt: (sendReceipt) => set({ sendReceipt }),
  markAdded: (lastAddedId) => set({ lastAddedId }),
  reset: () => set(initial()),
}));
