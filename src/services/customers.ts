import { repos, transaction } from "@/data";
import type { Address, Customer, CustomerType, Design, Notification, Order, SalesChannel } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { countsAsSale } from "@/domain/rules/orders";
import { customerType, isValidIndianMobile, normalizePhone } from "@/domain/rules/customers";
import { newId } from "@/lib/id";
import { currentActor, now } from "./context";
import { getSettings } from "./settings";
import { listCustomerWishlist } from "./wishlist";

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string;
  address?: Omit<Address, "id" | "label"> & { label?: string };
  source: SalesChannel;
}

function sameAddress(a: Omit<Address, "id" | "label">, b: Omit<Address, "id" | "label">): boolean {
  const norm = (s: string) => s.trim().toLowerCase();
  return norm(a.line1) === norm(b.line1) && a.pincode.trim() === b.pincode.trim();
}

/** Finds a customer by phone or creates one; adds a new address when it differs. Inside a transaction. */
export async function upsertCustomerInTx(input: CustomerInput): Promise<Customer> {
  const phone = normalizePhone(input.phone);
  if (!isValidIndianMobile(phone)) throw new DomainError("Enter a valid 10-digit mobile number");
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) throw new DomainError("Customer name is required");
  const r = repos();
  const t = now();
  const existing = await r.customers.findByPhone(phone);
  const address = input.address ? { ...input.address, label: input.address.label ?? "Home" } : null;

  if (existing) {
    const addresses = [...existing.addresses];
    if (address && !addresses.some((a) => sameAddress(a, address))) addresses.unshift({ ...address, id: newId("adr") });
    const updated: Customer = {
      ...existing,
      name: existing.name || name,
      email: input.email?.trim() || existing.email,
      addresses,
      updatedAt: t,
    };
    await r.customers.put(updated);
    return updated;
  }

  const customer: Customer = {
    id: newId("cus"),
    name,
    phone,
    email: input.email?.trim() ?? "",
    addresses: address ? [{ ...address, id: newId("adr") }] : [],
    notes: "",
    source: input.source,
    stats: { orderCount: 0, totalSpend: 0, firstOrderAt: null, lastOrderAt: null },
    createdAt: t,
    updatedAt: t,
  };
  await r.customers.add(customer);
  return customer;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  assertPermission(currentActor(), "customers:edit");
  return transaction(async () => {
    if (await repos().customers.findByPhone(normalizePhone(input.phone))) {
      throw new DomainError("A customer with this mobile number already exists");
    }
    return upsertCustomerInTx(input);
  });
}

/** Rebuilds spend and order stats from orders and refunds. Inside a transaction. */
export async function recomputeCustomerStatsInTx(customerId: string | null): Promise<void> {
  if (!customerId) return;
  const r = repos();
  const customer = await r.customers.get(customerId);
  if (!customer) return;
  const orders = (await r.orders.listByCustomer(customerId)).filter(countsAsSale);
  let refunds = 0;
  for (const order of orders) {
    if (order.paymentStatus === "PAID") continue;
    const payments = await r.payments.listByOrder(order.id);
    refunds += payments.filter((p) => p.kind === "REFUND").reduce((s, p) => s + p.amount, 0);
  }
  const times = orders.map((o) => o.createdAt).sort((a, b) => a - b);
  await r.customers.update(customerId, {
    stats: {
      orderCount: orders.length,
      totalSpend: orders.reduce((s, o) => s + o.total, 0) - refunds,
      firstOrderAt: times[0] ?? null,
      lastOrderAt: times[times.length - 1] ?? null,
    },
    updatedAt: now(),
  });
}

export interface CustomerRow {
  customer: Customer;
  type: CustomerType;
  averageOrderValue: number;
}

export async function listCustomers(): Promise<CustomerRow[]> {
  const [customers, settings] = await Promise.all([repos().customers.list(), getSettings()]);
  const t = now();
  return customers
    .map((customer) => ({
      customer,
      type: customerType(customer, t, settings.store),
      averageOrderValue: customer.stats.orderCount ? Math.round(customer.stats.totalSpend / customer.stats.orderCount) : 0,
    }))
    .sort((a, b) => (b.customer.stats.lastOrderAt ?? b.customer.createdAt) - (a.customer.stats.lastOrderAt ?? a.customer.createdAt));
}

export interface CustomerDetail extends CustomerRow {
  orders: Order[];
  wishlist: Design[];
  notifications: Notification[];
}

export async function getCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  const r = repos();
  const [customer, settings] = await Promise.all([r.customers.get(customerId), getSettings()]);
  if (!customer) return null;
  const [orders, wishlist, notifications] = await Promise.all([
    r.orders.listByCustomer(customerId),
    listCustomerWishlist(customerId),
    r.notifications.listByCustomer(customerId),
  ]);
  return {
    customer,
    type: customerType(customer, now(), settings.store),
    averageOrderValue: customer.stats.orderCount ? Math.round(customer.stats.totalSpend / customer.stats.orderCount) : 0,
    orders,
    wishlist,
    notifications,
  };
}

export async function updateCustomer(customerId: string, changes: Partial<Pick<Customer, "name" | "email" | "notes">>): Promise<void> {
  assertPermission(currentActor(), "customers:edit");
  await transaction(async () => {
    const customer = await repos().customers.get(customerId);
    if (!customer) throw new DomainError("Customer not found");
    if (changes.name !== undefined && !changes.name.trim()) throw new DomainError("Name cannot be empty");
    await repos().customers.update(customerId, { ...changes, updatedAt: now() });
  });
}

export async function findCustomerByPhone(phone: string): Promise<Customer | undefined> {
  const p = normalizePhone(phone);
  return p.length === 10 ? repos().customers.findByPhone(p) : undefined;
}
