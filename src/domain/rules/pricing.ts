import type { Design, InventoryItem } from "../types";

type PricedItem = Pick<InventoryItem, "priceOverride" | "mrpOverride">;
type PricedDesign = Pick<Design, "price" | "mrp">;

/** Current selling price: the piece override if set, otherwise the design default. */
export function effectivePrice(item: PricedItem, design: PricedDesign): number {
  return item.priceOverride ?? design.price;
}

export function effectiveMrp(item: PricedItem, design: PricedDesign): number {
  return item.mrpOverride ?? design.mrp;
}

export function priceSource(item: PricedItem): "DESIGN" | "OVERRIDE" {
  return item.priceOverride === null ? "DESIGN" : "OVERRIDE";
}

export function discountPercent(mrp: number, price: number): number {
  if (mrp <= 0 || price >= mrp) return 0;
  return Math.round((1 - price / mrp) * 100);
}

export interface TaxBreakdown {
  taxable: number;
  tax: number;
  cgst: number;
  sgst: number;
}

/** Splits a tax-inclusive amount into taxable value and GST, rounded to paise. */
export function splitInclusiveTax(amount: number, ratePercent: number): TaxBreakdown {
  const taxable = Math.round((amount / (1 + ratePercent / 100)) * 100) / 100;
  const tax = Math.round((amount - taxable) * 100) / 100;
  const cgst = Math.round((tax / 2) * 100) / 100;
  return { taxable, tax, cgst, sgst: Math.round((tax - cgst) * 100) / 100 };
}

export function validatePriceTriplet(input: { cost?: number | null; mrp?: number | null; price?: number | null }): string[] {
  const issues: string[] = [];
  const { cost, mrp, price } = input;
  if (price == null || !Number.isFinite(price) || price <= 0) issues.push("Selling price is required");
  if (mrp == null || !Number.isFinite(mrp) || mrp <= 0) issues.push("MRP is required");
  if (cost != null && (!Number.isFinite(cost) || cost < 0)) issues.push("Cost must be a positive number");
  if (price != null && mrp != null && price > mrp) issues.push("Selling price is above MRP");
  if (cost != null && price != null && cost > price) issues.push("Cost is above selling price");
  return issues;
}
