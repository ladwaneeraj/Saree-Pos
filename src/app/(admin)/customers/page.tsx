"use client";

import { Download, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, Pagination, type Column, type SortState } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerTypeBadge } from "@/components/shared/status-badge";
import { AddCustomerDialog } from "@/components/customers/add-customer-dialog";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import type { CustomerType } from "@/domain/types";
import { CUSTOMER_TYPE_LABELS } from "@/domain/rules/customers";
import { useLive } from "@/hooks/use-live";
import { useCan } from "@/stores/session";
import { downloadFile, toCsv } from "@/lib/files";
import { formatDate, formatINR, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listCustomers, type CustomerRow } from "@/services/customers";
import { CHANNEL_LABELS } from "@/services/orders";

const TYPES: (CustomerType | "ALL")[] = ["ALL", "NEW", "REPEAT", "HIGH_VALUE", "INACTIVE"];
const PAGE_SIZE = 25;

const SORTERS: Record<string, (r: CustomerRow) => number | string> = {
  name: (r) => r.customer.name.toLowerCase(),
  orders: (r) => r.customer.stats.orderCount,
  spend: (r) => r.customer.stats.totalSpend,
  last: (r) => r.customer.stats.lastOrderAt ?? 0,
};

export default function CustomersPage() {
  const router = useRouter();
  const canEdit = useCan("customers:edit");
  const { data } = useLive(listCustomers, []);
  const [type, setType] = useState<CustomerType | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "last", dir: "desc" });
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const c: Record<CustomerType | "ALL", number> = { ALL: data?.length ?? 0, NEW: 0, REPEAT: 0, HIGH_VALUE: 0, INACTIVE: 0 };
    for (const r of data ?? []) c[r.type]++;
    return c;
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return undefined;
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = data.filter(
      (r) =>
        (type === "ALL" || r.type === type) &&
        (!needle || r.customer.name.toLowerCase().includes(needle) || r.customer.email.toLowerCase().includes(needle) || (digits.length >= 3 && r.customer.phone.includes(digits)) || r.customer.addresses.some((a) => a.city.toLowerCase().includes(needle))),
    );
    const get = SORTERS[sort.key] ?? SORTERS.last!;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => (get(a) > get(b) ? dir : get(a) < get(b) ? -dir : 0));
  }, [data, type, q, sort]);

  const rows = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Name", "Phone", "Email", "City", "Type", "Orders", "Total spend", "Average order", "Last purchase", "First contact", "Customer since"];
    const body = (filtered ?? []).map((r) => [
      r.customer.name,
      r.customer.phone,
      r.customer.email,
      r.customer.addresses[0]?.city ?? "",
      CUSTOMER_TYPE_LABELS[r.type],
      r.customer.stats.orderCount,
      r.customer.stats.totalSpend,
      r.averageOrderValue,
      r.customer.stats.lastOrderAt ? formatDate(r.customer.stats.lastOrderAt) : "",
      CHANNEL_LABELS[r.customer.source],
      formatDate(r.customer.createdAt),
    ]);
    downloadFile(`dhanvi-customers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv([header, ...body]));
  };

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      header: "Customer",
      sortKey: "name",
      cell: ({ customer }) => (
        <div className="flex items-center gap-2.5">
          <CustomerAvatar name={customer.name} />
          <div className="leading-tight">
            <div className="font-medium">{customer.name}</div>
            <div className="text-xs text-muted-foreground">{customer.addresses[0]?.city ?? CHANNEL_LABELS[customer.source]}</div>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Phone", cell: ({ customer }) => <span className="tabular">+91 {customer.phone}</span> },
    { key: "email", header: "Email", cell: ({ customer }) => <span className="block max-w-52 truncate text-muted-foreground">{customer.email || "Not shared"}</span> },
    { key: "orders", header: "Orders", sortKey: "orders", align: "right", cell: ({ customer }) => formatNumber(customer.stats.orderCount) },
    { key: "spend", header: "Total spend", sortKey: "spend", align: "right", cell: ({ customer }) => <span className="font-medium">{formatINR(customer.stats.totalSpend)}</span> },
    {
      key: "last",
      header: "Last purchase",
      sortKey: "last",
      cell: ({ customer }) => <span className="text-muted-foreground">{customer.stats.lastOrderAt ? formatRelative(customer.stats.lastOrderAt) : "No orders yet"}</span>,
    },
    { key: "type", header: "Type", cell: (r) => <CustomerTypeBadge type={r.type} /> },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description={data ? `${formatNumber(data.length)} customers across the shop, website and WhatsApp` : "Loading customers…"}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered}>
              <Download /> Export CSV
            </Button>
            {canEdit && (
              <Button onClick={() => setAdding(true)}>
                <UserPlus /> Add customer
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setPage(1); }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
                type === t ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
              )}
            >
              {t === "ALL" ? "All customers" : CUSTOMER_TYPE_LABELS[t]}
              <span className={cn("text-xs tabular", type === t ? "text-primary-foreground/75" : "text-muted-foreground")}>{data ? formatNumber(counts[t]) : ""}</span>
            </button>
          ))}
        </div>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, phone, email, city…" className="lg:w-80" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.customer.id}
        onRowClick={(r) => router.push(`/customers/${r.customer.id}`)}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        mobileCard={(r) => (
          <div className="flex items-center gap-3">
            <CustomerAvatar name={r.customer.name} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{r.customer.name}</span>
                <CustomerTypeBadge type={r.type} />
              </div>
              <div className="mt-0.5 flex justify-between text-xs text-muted-foreground">
                <span className="tabular">+91 {r.customer.phone}</span>
                <span className="tabular">
                  {r.customer.stats.orderCount} orders · <span className="font-medium text-foreground">{formatINR(r.customer.stats.totalSpend)}</span>
                </span>
              </div>
            </div>
          </div>
        )}
        empty={<EmptyState icon={Users} title="No customers found" description="Try a different search or filter." />}
      />
      {filtered && filtered.length > 0 && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />}

      <AddCustomerDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}
