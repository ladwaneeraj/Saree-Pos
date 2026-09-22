import type { Actor, Role } from "./types";
import { DomainError } from "./errors";

export const PERMISSIONS = [
  "dashboard:view",
  "inventory:view",
  "inventory:edit",
  "cost:view",
  "pricing:edit",
  "designs:edit",
  "purchases:manage",
  "pos:use",
  "orders:view",
  "orders:manage",
  "customers:view",
  "customers:edit",
  "whatsapp:use",
  "dispatch:manage",
  "returns:manage",
  "reports:view",
  "audit:view",
  "settings:manage",
  "demo:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  MANAGER: [
    "dashboard:view",
    "inventory:view",
    "inventory:edit",
    "cost:view",
    "pricing:edit",
    "designs:edit",
    "purchases:manage",
    "pos:use",
    "orders:view",
    "orders:manage",
    "customers:view",
    "customers:edit",
    "whatsapp:use",
    "dispatch:manage",
    "returns:manage",
    "reports:view",
    "audit:view",
  ],
  BILLING: ["pos:use", "orders:view", "orders:manage", "customers:view", "customers:edit", "whatsapp:use"],
  PACKING: ["orders:view", "dispatch:manage"],
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  BILLING: "Billing staff",
  PACKING: "Packing staff",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access, including settings, costs and demo data",
  MANAGER: "Inventory, pricing, purchases, orders, customers and reports",
  BILLING: "POS billing, WhatsApp orders, customers and orders",
  PACKING: "Packing, dispatch and shipment tracking",
};

export function hasPermission(role: Role | "SYSTEM", permission: Permission): boolean {
  if (role === "SYSTEM") return true;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function assertPermission(actor: Actor, permission: Permission): void {
  if (!hasPermission(actor.role, permission)) {
    throw new DomainError(`${actor.name} does not have permission for this action`, "FORBIDDEN");
  }
}
