"use client";

import { ChevronRight, CreditCard, PackageOpen, RotateCcw, Truck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/reports/panel";
import type { DashboardData } from "@/services/reports";
import type { Order } from "@/domain/types";
import { formatINR, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Group {
  key: keyof DashboardData["attention"];
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  tone: string;
}

const GROUPS: Group[] = [
  { key: "paymentPending", label: "Payment pending", description: "Awaiting UPI or link payment", icon: CreditCard, href: "/orders?tab=ATTENTION", tone: "bg-warning-soft text-[oklch(0.5_0.12_65)]" },
  { key: "packingPending", label: "Packing pending", description: "Confirmed, not yet packed", icon: PackageOpen, href: "/dispatch", tone: "bg-wine-50 text-primary" },
  { key: "readyToDispatch", label: "Ready to dispatch", description: "Packed, awaiting courier pickup", icon: Truck, href: "/dispatch", tone: "bg-success-soft text-success" },
  { key: "returnRequests", label: "Return requests", description: "Customers waiting for a decision", icon: RotateCcw, href: "/returns", tone: "bg-muted text-foreground" },
];

export function AttentionPanel({ attention }: { attention: DashboardData["attention"] | undefined }) {
  const total = attention ? GROUPS.reduce((s, g) => s + attention[g.key].length, 0) : 0;
  return (
    <Panel title="Orders requiring attention" description={attention ? (total ? `${formatNumber(total)} orders need action` : "All caught up") : " "} bodyClassName="pt-2">
      <ul className="divide-y">
        {GROUPS.map((g) => {
          const orders = attention?.[g.key];
          return (
            <li key={g.key}>
              <Link href={g.href} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/60">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", g.tone)}>
                  <g.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{g.label}</div>
                  <div className="truncate text-xs text-muted-foreground">{orders?.[0] ? oldestHint(orders[0]) : g.description}</div>
                </div>
                {orders ? <span className="text-lg font-semibold tabular">{orders.length}</span> : <Skeleton className="h-6 w-6" />}
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function oldestHint(order: Order): string {
  return `Oldest #${order.number} · ${order.customer.name} · ${formatINR(order.total)} · ${formatRelative(order.createdAt)}`;
}
