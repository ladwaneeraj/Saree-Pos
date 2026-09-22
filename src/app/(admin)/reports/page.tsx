"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryReportView } from "@/components/reports/inventory-report";
import { SalesReportView } from "@/components/reports/sales-report";
import { useLive } from "@/hooks/use-live";
import { formatDate } from "@/lib/format";
import { getInventoryReport, getSalesReport } from "@/services/reports";
import { useCan } from "@/stores/session";

const DAY = 86_400_000;
const PRESETS = [
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "12 months", days: 365 },
] as const;
type Preset = (typeof PRESETS)[number]["value"];

export default function ReportsPage() {
  return (
    <Suspense>
      <Reports />
    </Suspense>
  );
}

function Reports() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "inventory" ? "inventory" : "sales";
  const [preset, setPreset] = useState<Preset>("30");
  const canSeeCost = useCan("cost:view");

  const days = PRESETS.find((p) => p.value === preset)!.days;
  const sales = useLive(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return getSalesReport(start.getTime() - (days - 1) * DAY, Date.now());
  }, [days]);
  const inventory = useLive(() => (tab === "inventory" ? getInventoryReport() : Promise.resolve(undefined)), [tab]);
  const rangeLabel = sales.data ? `${formatDate(sales.data.from)} to ${formatDate(sales.data.to)}` : "";

  const setTab = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "sales") next.delete("tab");
    else next.set("tab", value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title="Reports" description="Live from this shop's sales, payments and stock. Sales count once payment is received." />
      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="sales" className="px-4">Sales</TabsTrigger>
            <TabsTrigger value="inventory" className="px-4">Inventory</TabsTrigger>
          </TabsList>
          {tab === "sales" && (
            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted-foreground lg:inline">{rangeLabel}</span>
              <ToggleGroup type="single" variant="outline" size="sm" value={preset} onValueChange={(v) => v && setPreset(v as Preset)} className="bg-card">
                {PRESETS.map((p) => (
                  <ToggleGroupItem key={p.value} value={p.value} className="px-3 text-xs">
                    {p.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </div>
        <TabsContent value="sales">
          <SalesReportView data={sales.data} canSeeCost={canSeeCost} rangeLabel={rangeLabel} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReportView data={inventory.data ?? undefined} canSeeCost={canSeeCost} />
        </TabsContent>
      </Tabs>
    </>
  );
}
