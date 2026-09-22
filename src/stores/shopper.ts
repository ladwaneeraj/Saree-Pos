"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { newId } from "@/lib/id";

interface ShopperState {
  /** Two demo shoppers make the "someone else has it in their cart" scenario easy to show. */
  shoppers: { A: string; B: string };
  active: "A" | "B";
  switchShopper: (to: "A" | "B") => void;
}

export const useShopper = create<ShopperState>()(
  persist(
    (set) => ({
      shoppers: { A: newId("shopper"), B: newId("shopper") },
      active: "A",
      switchShopper: (to) => set({ active: to }),
    }),
    { name: "dhanvi-shopper" },
  ),
);

export function useShopperId(): string {
  return useShopper((s) => s.shoppers[s.active]);
}
