"use client";

import { ArrowRight, History, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/misc";
import { PageHeader } from "@/components/shared/page-header";
import { Pill } from "@/components/shared/status-badge";
import { ROLE_LABELS } from "@/domain/permissions";
import { AUDIT_ACTIONS, type AuditAction, type AuditLog, type Role } from "@/domain/types";
import { useLive } from "@/hooks/use-live";
import { downloadFile, toCsv } from "@/lib/files";
import { formatDate, formatDateTime, formatNumber, formatTime, initials } from "@/lib/format";
import { listRecentAudit } from "@/services/audit";

type Tone = React.ComponentProps<typeof Pill>["tone"];

const ACTION_META: Record<AuditAction, { label: string; tone: Tone }> = {
  PRICE_CHANGED: { label: "Price changed", tone: "gold" },
  PRODUCT_CREATED: { label: "Product created", tone: "wine" },
  PRODUCT_EDITED: { label: "Product edited", tone: "wine" },
  INVENTORY_ADDED: { label: "Stock added", tone: "info" },
  INVENTORY_EDITED: { label: "Stock edited", tone: "info" },
  INVENTORY_ADJUSTED: { label: "Stock adjusted", tone: "warning" },
  ORDER_CREATED: { label: "Order created", tone: "success" },
  ORDER_STATUS_CHANGED: { label: "Order updated", tone: "neutral" },
  ORDER_CANCELLED: { label: "Order cancelled", tone: "danger" },
  PAYMENT_RECORDED: { label: "Payment recorded", tone: "success" },
  RETURN_UPDATED: { label: "Return updated", tone: "warning" },
  PURCHASE_RECEIVED: { label: "Purchase received", tone: "info" },
  SETTINGS_CHANGED: { label: "Settings changed", tone: "neutral" },
  DEMO_RESET: { label: "Demo reset", tone: "danger" },
  DATA_IMPORTED: { label: "Data imported", tone: "info" },
};

const ENTITY_HREF: Partial<Record<AuditLog["entityType"], (id: string) => string>> = {
  DESIGN: (id) => `/designs/view?id=${id}`,
  INVENTORY: (id) => `/inventory/item?sku=${id}`,
  ORDER: (id) => `/orders/view?number=${id}`,
  PURCHASE: (id) => `/purchases/view?id=${id}`,
  RETURN: (id) => `/returns?open=${id}`,
  CUSTOMER: (id) => `/customers/view?id=${id}`,
  SETTINGS: () => "/settings",
};

const ALL = "__all";
const STEP = 60;

function roleLabel(role: string) {
  return ROLE_LABELS[role as Role] ?? (role === "SYSTEM" ? "System" : role);
}

export default function ActivityPage() {
  const { data } = useLive(() => listRecentAudit(1000), []);
  const [action, setAction] = useState<string>(ALL);
  const [actor, setActor] = useState<string>(ALL);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(STEP);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    data?.forEach((a) => map.set(a.actorName, a.actorRole));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data?.filter(
      (a) =>
        (action === ALL || a.action === action) &&
        (actor === ALL || a.actorName === actor) &&
        (!needle || [a.entityLabel, a.summary, a.before ?? "", a.after ?? "", a.actorName].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [data, action, actor, q]);

  const groups = useMemo(() => {
    const out: { day: string; rows: AuditLog[] }[] = [];
    for (const row of filtered?.slice(0, limit) ?? []) {
      const day = formatDate(row.createdAt);
      if (out.at(-1)?.day !== day) out.push({ day, rows: [] });
      out.at(-1)!.rows.push(row);
    }
    return out;
  }, [filtered, limit]);

  const active = (action !== ALL ? 1 : 0) + (actor !== ALL ? 1 : 0) + (q ? 1 : 0);
  const clear = () => { setAction(ALL); setActor(ALL); setQ(""); setLimit(STEP); };
  const exportCsv = () =>
    filtered &&
    downloadFile(
      `dhanvi-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv([["Date", "Action", "Record", "Summary", "Before", "After", "User", "Role"], ...filtered.map((a) => [formatDateTime(a.createdAt), ACTION_META[a.action].label, a.entityLabel, a.summary, a.before, a.after, a.actorName, roleLabel(a.actorRole)])]),
    );

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every price change, stock movement, order update and setting change, with who did it and when."
        actions={<Button variant="outline" onClick={exportCsv} disabled={!filtered?.length}>Export CSV</Button>}
      />

      <div className="mb-5 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setLimit(STEP); }} placeholder="Search SKU, order, design, summary…" className="lg:w-80" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={action} onValueChange={(v) => { setAction(v); setLimit(STEP); }}>
            <SelectTrigger className="w-full bg-card sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => <SelectItem key={a} value={a}>{ACTION_META[a].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actor} onValueChange={(v) => { setActor(v); setLimit(STEP); }}>
            <SelectTrigger className="w-full bg-card sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All users</SelectItem>
              {actors.map(([name, role]) => (
                <SelectItem key={name} value={name}>{name} <span className="text-muted-foreground">· {roleLabel(role)}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {active > 0 && <Button variant="ghost" onClick={clear}><X /> Clear filters</Button>}
        {filtered && <span className="text-sm text-muted-foreground lg:ml-auto">{formatNumber(filtered.length)} entries</span>}
      </div>

      {!filtered ? (
        <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={History} title="No activity matches" description="Try another action type or user." action={active ? <Button variant="outline" onClick={clear}>Clear filters</Button> : undefined} />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.day}</h2>
              <ol className="divide-y overflow-hidden rounded-xl border bg-card">
                {g.rows.map((a) => <AuditRow key={a.id} entry={a} />)}
              </ol>
            </section>
          ))}
          {filtered.length > limit && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setLimit((l) => l + STEP)}>Show {Math.min(STEP, filtered.length - limit)} more</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AuditRow({ entry: a }: { entry: AuditLog }) {
  const meta = ACTION_META[a.action];
  const href = ENTITY_HREF[a.entityType]?.(a.entityId);
  const showDiff = a.before && a.after && !a.summary.includes("→");
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="sm:w-40 sm:shrink-0">
        <Pill tone={meta.tone} className="uppercase tracking-wide text-[11px]">{meta.label}</Pill>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
          {href ? <Link href={href} className="font-mono text-[13px] font-semibold hover:underline">{a.entityLabel}</Link> : <span className="font-mono text-[13px] font-semibold">{a.entityLabel}</span>}
          <span className="text-muted-foreground">{a.summary}</span>
        </div>
        {showDiff && (
          <div className="mt-1 inline-flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through decoration-muted-foreground/50">{a.before}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="rounded bg-success-soft px-1.5 py-0.5 font-medium text-success">{a.after}</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5 sm:w-56 sm:shrink-0 sm:justify-end">
        <Avatar className="size-7"><AvatarFallback className="bg-wine-50 text-[10px] font-semibold text-primary">{initials(a.actorName)}</AvatarFallback></Avatar>
        <div className="min-w-0 text-xs leading-tight sm:text-right">
          <div className="truncate font-medium">{a.actorName} <span className="font-normal text-muted-foreground">({roleLabel(a.actorRole)})</span></div>
          <div className="text-muted-foreground" title={formatDateTime(a.createdAt)}>{formatDate(a.createdAt)}, {formatTime(a.createdAt)}</div>
        </div>
      </div>
    </li>
  );
}
