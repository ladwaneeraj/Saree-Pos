"use client";

import { ArrowRight, Check, CheckCircle2, PackageCheck, RotateCcw, Search, ThumbsDown, ThumbsUp, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MediaImage } from "@/components/shared/media-image";
import { SectionTitle } from "@/components/shared/page-header";
import { OrderStatusBadge, Pill, ReturnStatusBadge } from "@/components/shared/status-badge";
import { Timeline } from "@/components/shared/timeline";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { PaymentMethod, ReturnRequest } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useLive } from "@/hooks/use-live";
import { formatDateTime, formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS, getOrderDetail } from "@/services/orders";
import {
  approveReturn,
  completeExchange,
  completeQualityCheck,
  findExchangeCandidates,
  getReturn,
  receiveReturn,
  refundReturn,
  rejectReturn,
  type ExchangeCandidate,
} from "@/services/returns";

const METHODS: PaymentMethod[] = ["UPI", "CARD", "NETBANKING", "CASH"];

export function ReturnDrawer({ returnId, onClose }: { returnId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!returnId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">{returnId && <ReturnDetail key={returnId} returnId={returnId} />}</SheetContent>
    </Sheet>
  );
}

function ReturnDetail({ returnId }: { returnId: string }) {
  const { data: ret } = useLive(() => getReturn(returnId), [returnId]);
  const { data: order } = useLive(() => (ret ? getOrderDetail(ret.orderId) : Promise.resolve(null)), [ret?.orderId]);

  if (!ret) {
    return (
      <div className="space-y-4 p-6">
        <SheetHeader className="p-0">
          <SheetTitle>Loading return</SheetTitle>
        </SheetHeader>
        <Skeleton className="h-24" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  const imageByItem = new Map(order?.lines.map((l) => [l.id, l.imageId]) ?? []);

  return (
    <>
      <SheetHeader className="border-b p-5 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="text-lg">{ret.number}</SheetTitle>
          <ReturnStatusBadge status={ret.status} />
          <Pill tone={ret.type === "EXCHANGE" ? "gold" : "neutral"} dot={false}>
            {ret.type === "EXCHANGE" ? "Exchange" : "Return"}
          </Pill>
        </div>
        <SheetDescription>
          {ret.customerName} · order{" "}
          <Link href={`/orders/${ret.orderNumber}`} className="font-medium text-primary hover:underline">
            #{ret.orderNumber}
          </Link>{" "}
          · requested {formatDateTime(ret.createdAt)}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 p-5">
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <div className="text-xs font-medium text-muted-foreground">Reason from customer</div>
          <div className="mt-0.5">{ret.reason}</div>
        </div>

        <section>
          <SectionTitle>Pieces</SectionTitle>
          <ul className="divide-y rounded-lg border">
            {ret.lines.map((l) => (
              <li key={l.orderItemId} className="flex items-center gap-3 p-3">
                <MediaImage id={imageByItem.get(l.orderItemId)} alt={l.designName} thumb className="w-10 shrink-0" rounded="rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.designName}</div>
                  <div className="text-xs text-muted-foreground">
                    <Link href={`/inventory/${l.sku}`} className="font-mono text-primary hover:underline">{l.sku}</Link> · {l.colourName}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-medium tabular">{formatINR(l.unitPrice)}</span>
                  {l.qc !== "PENDING" && <Pill tone={l.qc === "GOOD" ? "success" : "danger"}>{l.qc === "GOOD" ? "QC passed" : "Damaged"}</Pill>}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between px-1 text-sm">
            <span className="text-muted-foreground">{ret.type === "EXCHANGE" ? "Exchange credit" : "Refund value"}</span>
            <span className="font-semibold tabular">{formatINR(ret.refundAmount)}</span>
          </div>
        </section>

        <ReturnActions ret={ret} />

        {ret.exchange && (
          <section className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-success">
              <CheckCircle2 className="size-4" /> Exchanged for {ret.exchange.newDesignName}
            </div>
            <div className="mt-1 text-muted-foreground">
              {ret.exchange.newSku} at {formatINR(ret.exchange.newPrice)} ·{" "}
              {ret.exchange.priceDifference === 0
                ? "no price difference"
                : ret.exchange.priceDifference > 0
                  ? `collected ${formatINR(ret.exchange.priceDifference)}`
                  : `refunded ${formatINR(-ret.exchange.priceDifference)}`}
            </div>
            {ret.exchange.newOrderId && (
              <Link href={`/orders/${ret.exchange.newOrderId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open replacement order <ArrowRight className="size-3" />
              </Link>
            )}
          </section>
        )}

        {order && (
          <section>
            <SectionTitle>Linked order</SectionTitle>
            <Link href={`/orders/${order.order.number}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent/50">
              <div>
                <div className="text-sm font-medium">Order #{order.order.number}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(order.order.createdAt)} · {formatINR(order.order.total)} · {order.lines.length} item{order.lines.length === 1 ? "" : "s"}
                </div>
              </div>
              <OrderStatusBadge status={order.order.status} />
            </Link>
          </section>
        )}

        <section>
          <SectionTitle>Timeline</SectionTitle>
          <Timeline
            entries={ret.timeline.map((t, i) => ({
              id: `${i}`,
              title: t.label,
              meta: t.actorName,
              at: t.at,
              tone: /reject/i.test(t.label) ? "danger" : /refunded|exchanged/i.test(t.label) ? "success" : "default",
            }))}
          />
        </section>
      </div>
    </>
  );
}

function ReturnActions({ ret }: { ret: ReturnRequest }) {
  const approve = useAction(approveReturn, { success: "Return approved. Reverse pickup scheduled." });
  const receive = useAction(receiveReturn, { success: "Parcel received. Pieces are waiting for quality check." });
  const [rejecting, setRejecting] = useState(false);

  if (ret.status === "REQUESTED") {
    return (
      <section className="rounded-xl border p-4">
        <SectionTitle>Review request</SectionTitle>
        {rejecting ? (
          <RejectForm ret={ret} onCancel={() => setRejecting(false)} />
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" disabled={approve.pending} onClick={() => approve.run(ret.id)}>
              <ThumbsUp /> Approve
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setRejecting(true)}>
              <ThumbsDown /> Reject
            </Button>
          </div>
        )}
      </section>
    );
  }
  if (ret.status === "APPROVED") {
    return (
      <section className="rounded-xl border p-4">
        <SectionTitle>Waiting for the parcel</SectionTitle>
        <p className="mb-3 text-sm text-muted-foreground">Mark the parcel received once it reaches the shop. The pieces move to Returned and wait for quality check.</p>
        <Button className="w-full" disabled={receive.pending} onClick={() => receive.run(ret.id)}>
          <PackageCheck /> Parcel received
        </Button>
      </section>
    );
  }
  if (ret.status === "RECEIVED") return <QualityCheckForm ret={ret} />;
  if (ret.status === "QC_COMPLETED") return ret.type === "RETURN" ? <RefundForm ret={ret} /> : <ExchangeForm ret={ret} />;
  return null;
}

function RejectForm({ ret, onCancel }: { ret: ReturnRequest; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const { run, pending } = useAction(rejectReturn, { success: "Return rejected. The customer has been informed." });
  return (
    <div className="space-y-2">
      <Label htmlFor="reject-reason">Reason shared with the customer</Label>
      <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Tags removed and saree has been worn" rows={2} autoFocus />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Back</Button>
        <Button variant="destructive" disabled={pending || !reason.trim()} onClick={() => run(ret.id, reason.trim())}>
          <XCircle /> Reject return
        </Button>
      </div>
    </div>
  );
}

function QualityCheckForm({ ret }: { ret: ReturnRequest }) {
  const [results, setResults] = useState<Record<string, "GOOD" | "DAMAGED">>({});
  const [rack, setRack] = useState("");
  const { run, pending } = useAction(completeQualityCheck, { success: "Quality check saved. Good pieces are back on sale." });
  const complete = ret.lines.every((l) => results[l.inventoryItemId]);
  const anyGood = Object.values(results).includes("GOOD");
  return (
    <section className="rounded-xl border p-4">
      <SectionTitle>Quality check</SectionTitle>
      <ul className="space-y-2">
        {ret.lines.map((l) => (
          <li key={l.inventoryItemId} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-sm">{l.sku}</span>
            <div className="flex gap-1.5">
              {(["GOOD", "DAMAGED"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResults((x) => ({ ...x, [l.inventoryItemId]: r }))}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
                    results[l.inventoryItemId] === r ? (r === "GOOD" ? "border-success bg-success-soft text-success" : "border-destructive bg-danger-soft text-destructive") : "hover:bg-accent",
                  )}
                >
                  {r === "GOOD" ? <Check className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {r === "GOOD" ? "Good" : "Damaged"}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {anyGood && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor="qc-rack">Rack for good pieces</Label>
          <Input id="qc-rack" value={rack} onChange={(e) => setRack(e.target.value.toUpperCase())} placeholder="Leave empty to keep the old rack" className="font-mono" />
        </div>
      )}
      <Button className="mt-4 w-full" disabled={!complete || pending} onClick={() => run(ret.id, results, rack)}>
        <CheckCircle2 /> Complete quality check
      </Button>
    </section>
  );
}

function RefundForm({ ret }: { ret: ReturnRequest }) {
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const { run, pending } = useAction(refundReturn, { success: `Refund of ${formatINR(ret.refundAmount)} recorded` });
  const { confirm, dialog } = useConfirm();
  return (
    <section className="rounded-xl border p-4">
      <SectionTitle>Refund</SectionTitle>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={async () => {
            if (await confirm({ title: `Refund ${formatINR(ret.refundAmount)}?`, description: `Recorded as a ${PAYMENT_METHOD_LABELS[method]} refund on order #${ret.orderNumber}. The customer is notified.`, confirmLabel: "Refund" }))
              await run(ret.id, method);
          }}
        >
          <Wallet /> Refund {formatINR(ret.refundAmount)}
        </Button>
      </div>
      {dialog}
    </section>
  );
}

function ExchangeForm({ ret }: { ret: ReturnRequest }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<ExchangeCandidate | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const { data: candidates } = useLive(() => findExchangeCandidates(q), [q]);
  const { run, pending } = useAction(completeExchange, { success: (o) => `Exchange completed. Replacement order #${o.number} created.` });
  const diff = chosen ? chosen.price - ret.refundAmount : 0;

  return (
    <section className="rounded-xl border p-4">
      <SectionTitle>Choose the replacement saree</SectionTitle>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search available SKU, design or colour" className="pl-9" />
      </div>
      <ul className="mt-2 max-h-64 divide-y overflow-y-auto rounded-lg border">
        {!candidates && <li className="p-3"><Skeleton className="h-10" /></li>}
        {candidates?.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No available pieces match.</li>}
        {candidates?.map((c) => (
          <li key={c.item.id}>
            <button type="button" onClick={() => setChosen(c)} className={cn("flex w-full items-center gap-3 p-2.5 text-left hover:bg-accent/50", chosen?.item.id === c.item.id && "bg-wine-50")}>
              <MediaImage id={c.imageId} alt={c.designName} thumb className="w-9 shrink-0" rounded="rounded" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.designName}</div>
                <div className="text-xs text-muted-foreground">
                  <span className="font-mono">{c.item.sku}</span> · {c.colourName} · Rack {c.item.location}
                </div>
              </div>
              <span className="text-sm font-medium tabular">{formatINR(c.price)}</span>
              {chosen?.item.id === c.item.id && <Check className="size-4 text-primary" />}
            </button>
          </li>
        ))}
      </ul>

      {chosen && (
        <div className="mt-4 space-y-3 rounded-lg bg-muted/60 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">New saree</span><span className="tabular">{formatINR(chosen.price)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Exchange credit</span><span className="tabular">-{formatINR(ret.refundAmount)}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>{diff > 0 ? "Collect from customer" : diff < 0 ? "Refund to customer" : "No difference"}</span>
            <span className={cn("tabular", diff > 0 ? "text-primary" : diff < 0 ? "text-success" : undefined)}>{formatINR(Math.abs(diff))}</span>
          </div>
          {diff !== 0 && (
            <div className="flex items-center justify-between gap-2">
              <Label>{diff > 0 ? "Collected via" : "Refund via"}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
      <Button className="mt-4 w-full" disabled={!chosen || pending} onClick={() => chosen && run(ret.id, chosen.item.id, method)}>
        <RotateCcw /> Complete exchange
      </Button>
    </section>
  );
}

