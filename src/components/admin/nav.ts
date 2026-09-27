import {
  BarChart3,
  Boxes,
  HandCoins,
  History,
  LayoutDashboard,
  MessageCircle,
  Package,
  Palette,
  ReceiptText,
  RotateCcw,
  Settings,
  ShoppingBag,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/domain/permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: Permission;
  shortcut?: string;
}

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:view" }] },
  {
    label: "Sell",
    items: [
      { href: "/pos", label: "POS", icon: ShoppingBag, permission: "pos:use", shortcut: "P" },
      { href: "/orders", label: "Orders", icon: ReceiptText, permission: "orders:view" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, permission: "whatsapp:use" },
      { href: "/dispatch", label: "Dispatch", icon: Truck, permission: "dispatch:manage" },
      { href: "/returns", label: "Returns", icon: RotateCcw, permission: "returns:manage" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/inventory", label: "Inventory", icon: Boxes, permission: "inventory:view", shortcut: "I" },
      { href: "/designs", label: "Products / Designs", icon: Palette, permission: "inventory:view" },
      { href: "/purchases", label: "Purchases", icon: Package, permission: "purchases:manage" },
    ],
  },
  { label: "People", items: [{ href: "/customers", label: "Customers", icon: Users, permission: "customers:view" }] },
  {
    label: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports:view" },
      { href: "/dues", label: "Payables & receivables", icon: HandCoins, permission: "orders:view" },
      { href: "/activity", label: "Activity log", icon: History, permission: "audit:view" },
    ],
  },
  { label: "", items: [{ href: "/settings", label: "Settings", icon: Settings, permission: "settings:manage" }] },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** The permission needed for a path, from the nav item whose href prefixes it. */
export function permissionForPath(pathname: string): Permission | null {
  const item = ALL_NAV_ITEMS.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  return item?.permission ?? null;
}
