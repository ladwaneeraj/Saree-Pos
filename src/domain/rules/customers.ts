import type { Customer, CustomerType } from "../types";

export interface CustomerTypeConfig {
  highValueThreshold: number;
  inactiveAfterDays: number;
}

/** Derived, never stored, so time-based types (INACTIVE) are always current. */
export function customerType(customer: Pick<Customer, "stats">, now: number, config: CustomerTypeConfig): CustomerType {
  const { orderCount, totalSpend, lastOrderAt } = customer.stats;
  if (lastOrderAt !== null && now - lastOrderAt > config.inactiveAfterDays * 86_400_000) return "INACTIVE";
  if (totalSpend >= config.highValueThreshold) return "HIGH_VALUE";
  if (orderCount >= 2) return "REPEAT";
  return "NEW";
}

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  NEW: "New",
  REPEAT: "Repeat",
  HIGH_VALUE: "High value",
  INACTIVE: "Inactive",
};

/** Normalises Indian mobile numbers to 10 digits for matching. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function isValidIndianMobile(phone: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(phone));
}

export function maskPhone(phone: string): string {
  const p = normalizePhone(phone);
  return p.length === 10 ? `${p.slice(0, 2)}******${p.slice(8)}` : phone;
}
