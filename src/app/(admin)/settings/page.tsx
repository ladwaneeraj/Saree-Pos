"use client";

import { Bell, Building2, Database, ListTree, Percent, Sparkles, Store, Tag, Truck, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { AiForm } from "@/components/settings/ai-form";
import { CatalogListsForm, MasterLists } from "@/components/settings/catalog-lists";
import { DemoData } from "@/components/settings/demo-data";
import { LabelsForm } from "@/components/settings/labels-form";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { BusinessForm, ShippingForm, StoreForm, TaxForm } from "@/components/settings/section-forms";
import { SettingsValueContext } from "@/components/settings/settings-kit";
import { UsersRoles } from "@/components/settings/users-roles";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "business", label: "Business profile", icon: Building2, render: () => <BusinessForm /> },
  { value: "store", label: "Store settings", icon: Store, render: () => <StoreForm /> },
  { value: "tax", label: "Tax / GST", icon: Percent, render: () => <TaxForm /> },
  { value: "shipping", label: "Shipping", icon: Truck, render: () => <ShippingForm /> },
  { value: "users", label: "Users & roles", icon: Users, render: () => <UsersRoles /> },
  { value: "notifications", label: "Notifications", icon: Bell, render: () => <NotificationsForm /> },
  { value: "labels", label: "SKU & labels", icon: Tag, render: () => <LabelsForm /> },
  { value: "catalog", label: "Catalogue lists", icon: ListTree, render: () => <><CatalogListsForm /><MasterLists /></> },
  { value: "ai", label: "AI", icon: Sparkles, render: () => <AiForm /> },
  { value: "demo", label: "Demo data", icon: Database, render: () => <DemoData /> },
] as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Shop details, selling rules, messages and demo data. Only the owner can change these." />
      <Suspense>
        <SettingsTabs />
      </Suspense>
    </>
  );
}

function SettingsTabs() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const settings = useSettings();
  const current = TABS.find((t) => t.value === params.get("tab")) ?? TABS[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
      <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-20 lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex gap-1 lg:flex-col">
          {TABS.map((t) => (
            <li key={t.value}>
              <button
                type="button"
                onClick={() => router.replace(`${pathname}?tab=${t.value}`, { scroll: false })}
                aria-current={t.value === current.value ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  t.value === current.value ? "bg-card font-medium text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{settings ? <SettingsValueContext.Provider value={settings}><div key={current.value}>{current.render()}</div></SettingsValueContext.Provider> : <Skeleton className="h-96 w-full rounded-xl" />}</div>
    </div>
  );
}
