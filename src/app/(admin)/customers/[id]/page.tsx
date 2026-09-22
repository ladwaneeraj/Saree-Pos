"use client";

import { CalendarClock, Heart, IndianRupee, Mail, MapPin, MessageCircle, Phone, ReceiptText, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { CopyButton } from "@/components/shared/misc";
import { PageHeader, SectionTitle } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ChannelBadge, CustomerTypeBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";
import { CustomerAvatar } from "@/components/customers/customer-avatar";
import { MessageList } from "@/components/orders/message-list";
import type { Customer, Order } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useLive } from "@/hooks/use-live";
import { formatDate, formatDateTime, formatINR, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCustomerDetail, updateCustomer } from "@/services/customers";
import { CHANNEL_LABELS } from "@/services/orders";
import { useCan } from "@/stores/session";

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data } = useLive(() => getCustomerDetail(id), [id]);

  if (data === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-80" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }
  if (data === null) {
    return <EmptyState icon={Users} title="Customer not found" description="This customer may have been removed." action={<Link href="/customers" className="text-sm font-medium text-primary hover:underline">Back to customers</Link>} className="mt-10" />;
  }

  const { customer, orders } = data;
  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);
  const columns: Column<Order>[] = [
    { key: "n", header: "Order", cell: (o) => <span className="font-semibold tabular">#{o.number}</span> },
    { key: "d", header: "Date", cell: (o) => formatDate(o.createdAt) },
    { key: "c", header: "Channel", cell: (o) => <ChannelBadge channel={o.channel} /> },
    { key: "i", header: "Items", align: "right", cell: (o) => o.itemCount },
    { key: "t", header: "Total", align: "right", cell: (o) => <span className="font-medium">{formatINR(o.total)}</span> },
    { key: "p", header: "Payment", cell: (o) => <PaymentStatusBadge status={o.paymentStatus} /> },
    { key: "s", header: "Status", cell: (o) => <OrderStatusBadge status={o.status} /> },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <CustomerAvatar name={customer.name} className="size-11 text-sm" />
            {customer.name}
            <CustomerTypeBadge type={data.type} />
          </span>
        }
        description={`Customer since ${formatDate(customer.createdAt)} · first contact via ${CHANNEL_LABELS[customer.source]}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={`https://wa.me/91${customer.phone}`} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`tel:+91${customer.phone}`}>
                <Phone /> Call
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total spend" value={formatINR(customer.stats.totalSpend)} icon={IndianRupee} hint="After refunds" />
        <StatCard label="Orders" value={customer.stats.orderCount} icon={ShoppingBag} hint={customer.stats.firstOrderAt ? `First on ${formatDate(customer.stats.firstOrderAt)}` : "No orders yet"} />
        <StatCard label="Average order value" value={formatINR(data.averageOrderValue)} icon={ReceiptText} />
        <StatCard label="Last order" value={customer.stats.lastOrderAt ? formatRelative(customer.stats.lastOrderAt) : "None"} icon={CalendarClock} hint={customer.stats.lastOrderAt ? formatDate(customer.stats.lastOrderAt) : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section>
            <SectionTitle>Orders</SectionTitle>
            <DataTable
              columns={columns}
              rows={sorted}
              rowKey={(o) => o.id}
              onRowClick={(o) => router.push(`/orders/${o.number}`)}
              mobileCard={(o) => (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-semibold tabular">#{o.number}</span>
                    <span className="font-semibold tabular">{formatINR(o.total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? "" : "s"}</span>
                    <ChannelBadge channel={o.channel} />
                  </div>
                  <OrderStatusBadge status={o.status} />
                </div>
              )}
              empty={<EmptyState icon={ShoppingBag} title="No orders yet" description="Orders placed at the shop, on the website or on WhatsApp appear here." />}
            />
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
            <SectionTitle>
              <span className="inline-flex items-center gap-1.5"><Heart className="size-4 text-primary" /> Wishlist</span>
            </SectionTitle>
            {data.wishlist.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved sarees.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                {data.wishlist.map((d) => (
                  <Link key={d.id} href={`/designs/${d.id}`} className="group">
                    <MediaImage id={d.imageIds[0]} alt={d.name} thumb className="transition-opacity group-hover:opacity-90" />
                    <div className="mt-1.5 truncate text-xs font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground tabular">{formatINR(d.price)}</div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
            <SectionTitle>Messages sent</SectionTitle>
            <MessageList notifications={data.notifications.slice(-30)} emptyText="Order updates and back-in-stock alerts sent to this customer appear here." />
          </section>
        </div>

        <div className="space-y-6">
          <ContactCard customer={customer} />
          <NotesCard customer={customer} />
        </div>
      </div>
    </>
  );
}

function ContactCard({ customer }: { customer: Customer }) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <SectionTitle>Contact</SectionTitle>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" /> +91 {customer.phone}</span>
          <CopyButton text={customer.phone} size="icon-sm" variant="ghost" />
        </div>
        <div className="flex items-center gap-2">
          <Mail className="size-3.5 shrink-0 text-muted-foreground" />
          {customer.email ? <a href={`mailto:${customer.email}`} className="truncate hover:underline">{customer.email}</a> : <span className="text-muted-foreground">No email</span>}
        </div>
      </div>
      <div className="mt-4 border-t pt-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Addresses</div>
        {customer.addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved address.</p>
        ) : (
          <ul className="space-y-3">
            {customer.addresses.map((a, i) => (
              <li key={a.id} className="flex gap-2.5 text-sm">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {a.label}
                    {i === 0 && customer.addresses.length > 1 && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Latest</span>}
                  </div>
                  <div className="text-muted-foreground">
                    {[a.line1, a.line2].filter(Boolean).join(", ")}, {a.city}, {a.state} {a.pincode}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function NotesCard({ customer }: { customer: Customer }) {
  const canEdit = useCan("customers:edit");
  const [draft, setDraft] = useState<string | null>(null);
  const { run, pending } = useAction(updateCustomer, { success: "Notes saved" });
  const value = draft ?? customer.notes;
  const dirty = draft !== null && draft !== customer.notes;
  return (
    <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <SectionTitle>Notes</SectionTitle>
      {canEdit ? (
        <>
          <Textarea
            value={value}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Preferences, sizes for blouse stitching, festivals they shop for…"
            rows={5}
            className={cn("resize-none bg-[oklch(0.985_0.02_90)]")}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Updated {formatDateTime(customer.updatedAt)}</span>
            <Button
              size="sm"
              disabled={!dirty || pending}
              onClick={async () => {
                await run(customer.id, { notes: value.trim() });
                setDraft(null);
              }}
            >
              Save notes
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">{customer.notes || "No notes yet."}</p>
      )}
    </section>
  );
}
