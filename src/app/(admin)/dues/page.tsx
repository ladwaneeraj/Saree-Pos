"use client";

import { Banknote, CreditCard, HandCoins } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { PaymentStatusBadge } from "@/components/shared/status-badge";
import { SupplierPaymentDialog } from "@/components/purchases/supplier-payment-dialog";
import { useLive } from "@/hooks/use-live";
import { formatDate, formatINR, formatNumber } from "@/lib/format";
import { listPayables, listReceivables, type Payable, type Receivable } from "@/services/dues";
import { useCan } from "@/stores/session";

/** The two sides of the bill book: what customers owe the shop, and what the shop owes suppliers. */
export default function DuesPage() {
  const { data: receivables } = useLive(listReceivables, []);
  const { data: payables } = useLive(listPayables, []);
  const canPay = useCan("purchases:manage");
  const [tab, setTab] = useState<"receivable" | "payable">("receivable");
  const [paying, setPaying] = useState<Payable | null>(null);
  const totalR = (receivables ?? []).reduce((s, r) => s + r.balance, 0);
  const totalP = (payables ?? []).reduce((s, p) => s + p.balance, 0);

  const receivableColumns: Column<Receivable>[] = [
    { key: "order", header: "Order", cell: (r) => <Link href={`/orders/view?number=${r.order.number}`} className="font-medium text-primary hover:underline">#{r.order.number}</Link> },
    { key: "customer", header: "Customer", cell: (r) => <span>{r.order.customer.name}{r.order.customer.phone && <span className="text-muted-foreground"> · {r.order.customer.phone}</span>}</span> },
    { key: "date", header: "Date", cell: (r) => <span>{formatDate(r.order.createdAt)} <span className="text-xs text-muted-foreground">({r.ageDays}d)</span></span> },
    { key: "status", header: "Status", cell: (r) => <PaymentStatusBadge status={r.order.paymentStatus} /> },
    { key: "total", header: "Bill", align: "right", cell: (r) => formatINR(r.order.total) },
    { key: "paid", header: "Received", align: "right", cell: (r) => formatINR(r.order.amountPaid) },
    { key: "due", header: "Balance", align: "right", cell: (r) => <span className="font-semibold text-destructive tabular">{formatINR(r.balance)}</span> },
    { key: "act", header: "", cell: (r) => <Button size="sm" variant="outline" asChild><Link href={`/orders/view?number=${r.order.number}`}><CreditCard /> Record</Link></Button> },
  ];
  const payableColumns: Column<Payable>[] = [
    { key: "po", header: "Purchase", cell: (p) => <Link href={`/purchases/view?id=${p.purchase.id}`} className="font-medium text-primary hover:underline">{p.purchase.number}</Link> },
    { key: "supplier", header: "Supplier", cell: (p) => <span>{p.supplier?.name ?? "Unknown"}<span className="text-muted-foreground"> · bill {p.purchase.invoiceNumber}</span></span> },
    { key: "date", header: "Date", cell: (p) => <span>{formatDate(p.purchase.date)} <span className="text-xs text-muted-foreground">({p.ageDays}d)</span></span> },
    { key: "dueBy", header: "Due by", cell: (p) => (p.purchase.dueDate ? <span className={p.overdue ? "font-medium text-destructive" : undefined}>{formatDate(p.purchase.dueDate)}{p.overdue && " · overdue"}</span> : <span className="text-muted-foreground">-</span>) },
    { key: "total", header: "Bill", align: "right", cell: (p) => formatINR(p.purchase.grandTotal) },
    { key: "paid", header: "Paid", align: "right", cell: (p) => formatINR(p.purchase.amountPaid) },
    { key: "due", header: "Balance", align: "right", cell: (p) => <span className="font-semibold text-destructive tabular">{formatINR(p.balance)}</span> },
    { key: "act", header: "", cell: (p) => (canPay ? <Button size="sm" variant="outline" onClick={() => setPaying(p)}><Banknote /> Pay</Button> : null) },
  ];

  return (
    <>
      <PageHeader title="Payables & receivables" description="Unpaid customer bills on one side, unpaid supplier bills on the other. Cleared bills drop off automatically." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <StatCard label="To receive from customers" value={formatINR(totalR)} hint={`${formatNumber(receivables?.length ?? 0)} bill${receivables?.length === 1 ? "" : "s"}`} icon={HandCoins} />
        <StatCard label="To pay suppliers" value={formatINR(totalP)} hint={`${formatNumber(payables?.length ?? 0)} bill${payables?.length === 1 ? "" : "s"}`} icon={Banknote} />
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-4">
        <TabsList>
          <TabsTrigger value="receivable">Receivable <span className="ml-1 text-xs text-muted-foreground tabular">{receivables?.length ?? 0}</span></TabsTrigger>
          <TabsTrigger value="payable">Payable <span className="ml-1 text-xs text-muted-foreground tabular">{payables?.length ?? 0}</span></TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === "receivable" ? (
        receivables && receivables.length === 0 ? (
          <EmptyState icon={HandCoins} title="Nothing to receive" description="Credit and part-paid sales from the POS show up here until the balance is recorded." />
        ) : (
          <DataTable columns={receivableColumns} rows={receivables ?? []} rowKey={(r) => r.order.id} mobileCard={(r) => <div className="flex justify-between text-sm"><span>#{r.order.number} · {r.order.customer.name}</span><span className="font-semibold text-destructive">{formatINR(r.balance)}</span></div>} />
        )
      ) : payables && payables.length === 0 ? (
        <EmptyState icon={Banknote} title="Nothing to pay" description="Supplier bills with an unpaid balance show up here." />
      ) : (
        <DataTable columns={payableColumns} rows={payables ?? []} rowKey={(p) => p.purchase.id} mobileCard={(p) => <div className="flex justify-between text-sm"><span>{p.purchase.number} · {p.supplier?.name}</span><span className="font-semibold text-destructive">{formatINR(p.balance)}</span></div>} />
      )}
      {paying && <SupplierPaymentDialog purchase={paying.purchase} supplierName={paying.supplier?.name ?? "supplier"} open onOpenChange={(o) => !o && setPaying(null)} />}
    </>
  );
}
