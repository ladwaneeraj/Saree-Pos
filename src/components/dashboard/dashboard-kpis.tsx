"use client";

import { Boxes, Gem, Globe, IndianRupee, MessageCircle, ReceiptText, ShoppingBag, Truck } from "lucide-react";
import Link from "next/link";
import { StatCard, percentChange } from "@/components/shared/stat-card";
import type { DashboardData } from "@/services/reports";
import { formatINR, formatINRCompact, formatNumber } from "@/lib/format";

export function DashboardKpis({ kpis, canSeeCost }: { kpis: DashboardData["kpis"] | undefined; canSeeCost: boolean }) {
  const loading = !kpis;
  const k = kpis;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        label="Today's sales"
        icon={IndianRupee}
        loading={loading}
        value={k && formatINR(k.todaySales)}
        delta={k ? percentChange(k.todaySales, k.yesterdaySales) : null}
        hint={k && <span>vs {formatINRCompact(k.yesterdaySales)} yesterday</span>}
        className="bg-gradient-to-br from-wine-50 to-card"
      />
      <StatCard label="Orders today" icon={ReceiptText} loading={loading} value={k && formatNumber(k.todayOrders)} delta={k ? percentChange(k.todayOrders, k.yesterdayOrders) : null} hint={k && <span>{formatNumber(k.yesterdayOrders)} yesterday</span>} />
      <StatCard label="Sarees sold" icon={ShoppingBag} loading={loading} value={k && formatNumber(k.sareesSoldToday)} hint="Pieces billed today" />
      <StatCard label="Online orders" icon={Globe} loading={loading} value={k && formatNumber(k.onlineOrdersToday)} hint="From the website today" />
      <StatCard label="WhatsApp orders" icon={MessageCircle} loading={loading} value={k && formatNumber(k.whatsappOrdersToday)} hint="Confirmed on chat today" />
      <StatCard
        label="Current stock"
        icon={Boxes}
        loading={loading}
        value={k && <>{formatNumber(k.currentStock)} <span className="text-sm font-normal text-muted-foreground">pcs</span></>}
        hint={k && <span>{formatNumber(k.availableStock)} available · {formatNumber(k.reservedStock)} reserved</span>}
      />
      <StatCard
        label="Stock value"
        icon={Gem}
        loading={loading}
        value={k && formatINRCompact(k.stockValueRetail)}
        hint={k && (canSeeCost ? <span>At retail · {formatINRCompact(k.stockValueCost)} at cost</span> : <span>At selling price</span>)}
      />
      <Link href="/dispatch" className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <StatCard
          label="Pending dispatch"
          icon={Truck}
          loading={loading}
          value={k && formatNumber(k.pendingDispatch)}
          hint={<span className="font-medium text-primary group-hover:underline">Open dispatch queue</span>}
          className="h-full transition-colors group-hover:border-primary/30"
        />
      </Link>
    </div>
  );
}
