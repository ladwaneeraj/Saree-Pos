"use client";

import {
  Ban,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  MoreHorizontal,
  Navigation,
  PackageOpen,
  Printer,
  RotateCcw,
  ScrollText,
  StickyNote,
  Store,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MediaImage } from "@/components/shared/media-image";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { DispatchDialog } from "@/components/dispatch/dispatch-dialog";
import { PickListDialog, type PickTarget } from "@/components/dispatch/pick-list-dialog";
import { CANCELLABLE_STATUSES } from "@/domain/rules/orders";
import type { PaymentMethod, ShipmentStatus } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { copyText } from "@/lib/files";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { advanceShipment, handOverAtStore, markDelivered, startPacking } from "@/services/dispatch";
import { PAYMENT_METHOD_LABELS, addOrderNote, cancelOrder, confirmPayment, type OrderDetail } from "@/services/orders";
import { requestReturn } from "@/services/returns";
import { useCan } from "@/stores/session";
import { InvoiceDialog } from "./invoice-dialog";
import { useOrderAction } from "./use-order-action";

type DialogKind = null | "payment" | "cancel" | "return" | "note" | "dispatch" | "pick" | "invoice";

const SHIPMENT_LABEL: Record<ShipmentStatus, string> = { DISPATCHED: "Dispatched", IN_TRANSIT: "In transit", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered" };

export function trackingPath(orderId: string): string {
  return `/track/${orderId}`;
}

/** Contextual actions for an order, driven by its status and the signed-in role. */
export function OrderActions({ detail }: { detail: OrderDetail }) {
  const { order } = detail;
  const canManage = useCan("orders:manage");
  const canDispatch = useCan("dispatch:manage");
  const canReturn = useCan("returns:manage");
  const [dialog, setDialog] = useState<DialogKind>(null);
  const close = () => setDialog(null);

  const pack = useOrderAction(startPacking, "Packing started");
  const advance = useOrderAction(advanceShipment, (s: ShipmentStatus) => `Tracking updated: ${SHIPMENT_LABEL[s]}`);
  const deliver = useOrderAction(markDelivered, "Marked as delivered");
  const handOver = useOrderAction(handOverAtStore, "Handed over at the store");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const busy = pack.pending || advance.pending || deliver.pending || handOver.pending;

  const shipping = order.fulfilment === "SHIPPING";
  const s = order.status;
  const activeLines = detail.lines.filter((l) => l.status === "ACTIVE");
  const openReturn = detail.returns.some((r) => ["REQUESTED", "APPROVED", "RECEIVED", "QC_COMPLETED"].includes(r.status));

  const pickTarget: PickTarget = {
    id: order.id,
    number: order.number,
    customerName: order.customer.name,
    lines: activeLines.map((l) => ({ id: l.id, sku: l.sku, designName: l.designName, colourName: l.colourName, imageId: l.imageId, location: l.location })),
  };

  const trackingUrl = typeof window === "undefined" ? trackingPath(order.id) : `${window.location.origin}${trackingPath(order.id)}`;

  const primary: React.ReactNode[] = [];
  if (canManage && (s === "PAYMENT_PENDING" || s === "NEW"))
    primary.push(<Button key="pay" onClick={() => setDialog("payment")}><CreditCard /> Confirm payment</Button>);
  if (canDispatch && shipping && (s === "CONFIRMED" || s === "RESERVED"))
    primary.push(
      <Button key="pack" disabled={busy} onClick={async () => { if (await pack.run(order.id)) setDialog("pick"); }}>
        <PackageOpen /> Start packing
      </Button>,
    );
  if (canDispatch && s === "PACKING") primary.push(<Button key="ready" onClick={() => setDialog("pick")}><ScrollText /> Pick list · Mark ready</Button>);
  if (canDispatch && s === "READY_TO_DISPATCH") primary.push(<Button key="dispatch" onClick={() => setDialog("dispatch")}><Truck /> Dispatch</Button>);
  if (canDispatch && (s === "DISPATCHED" || s === "IN_TRANSIT")) {
    primary.push(<Button key="adv" variant="outline" disabled={busy} onClick={() => advance.run(order.id)}><Navigation /> Tracking update</Button>);
    primary.push(<Button key="del" disabled={busy} onClick={() => deliver.run(order.id)}><CheckCircle2 /> Mark delivered</Button>);
  }
  if (canManage && !shipping && s === "RESERVED")
    primary.push(
      <Button
        key="collect"
        disabled={busy}
        onClick={async () => {
          if (await confirm({ title: `Hand over order #${order.number}?`, description: "The pieces are marked sold and the order is completed.", confirmLabel: "Collected at store" })) await handOver.run(order.id);
        }}
      >
        <Store /> Collected at store
      </Button>,
    );
  if (canReturn && s === "DELIVERED" && activeLines.length > 0 && !openReturn)
    primary.push(<Button key="ret" variant="outline" onClick={() => setDialog("return")}><RotateCcw /> Return / exchange</Button>);

  const cancellable = canManage && CANCELLABLE_STATUSES.includes(s);

  return (
    <>
      {primary}
      <Button variant="outline" onClick={() => setDialog("invoice")} className="hidden sm:inline-flex" disabled={order.paymentStatus === "PENDING"}>
        <Printer /> Invoice
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More order actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canManage && (
            <DropdownMenuItem onSelect={() => setDialog("note")}>
              <StickyNote /> Add note
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={async () => {
              await copyText(trackingUrl);
              toast.success("Tracking link copied", { description: trackingUrl });
            }}
          >
            <Copy /> Copy tracking link
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={trackingPath(order.id)} target="_blank" rel="noreferrer">
              <ExternalLink /> Open tracking page
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("invoice")} disabled={order.paymentStatus === "PENDING"}>
            <Printer /> Print invoice
          </DropdownMenuItem>
          {cancellable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("cancel")}>
                <Ban /> Cancel order
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PaymentDialog detail={detail} open={dialog === "payment"} onClose={close} />
      <CancelDialog detail={detail} open={dialog === "cancel"} onClose={close} />
      <ReturnDialog detail={detail} open={dialog === "return"} onClose={close} />
      <NoteDialog orderId={order.id} open={dialog === "note"} onClose={close} />
      <PickListDialog target={pickTarget} open={dialog === "pick"} onOpenChange={(o) => !o && close()} />
      <DispatchDialog order={order} open={dialog === "dispatch"} onOpenChange={(o) => !o && close()} />
      <InvoiceDialog detail={detail} open={dialog === "invoice"} onOpenChange={(o) => !o && close()} />
      {confirmDialog}
    </>
  );
}

function PaymentDialog({ detail, open, onClose }: { detail: OrderDetail; open: boolean; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [reference, setReference] = useState("");
  const { run, pending } = useOrderAction(confirmPayment, `Payment confirmed for #${detail.order.number}`);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm payment</DialogTitle>
          <DialogDescription>
            Record {formatINR(detail.order.total)} received from {detail.order.customer.name}. The sarees stay reserved for this order until dispatch.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["UPI", "CARD", "NETBANKING", "CASH"] as const).map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-ref">Reference (UTR / transaction ID)</Label>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 425918736402" className="font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={pending} onClick={async () => { if (await run(detail.order.id, { method, reference: reference.trim() })) onClose(); }}>
            <CreditCard /> Confirm {formatINR(detail.order.total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const CANCEL_REASONS = ["Customer changed their mind", "Payment not received in time", "Duplicate order", "Piece found damaged during packing", "Address not serviceable"];

function CancelDialog({ detail, open, onClose }: { detail: OrderDetail; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const [other, setOther] = useState("");
  const { run, pending } = useOrderAction(cancelOrder, `Order #${detail.order.number} cancelled`);
  const paid = detail.order.paymentStatus === "PAID";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order #{detail.order.number}?</DialogTitle>
          <DialogDescription>
            Reserved sarees go back on sale on every channel.
            {paid && ` A refund of ${formatINR(detail.order.total)} is recorded to the original payment method.`} This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...CANCEL_REASONS, "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          {reason === "Other" && <Textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Describe the reason" autoFocus />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Keep order</Button>
          <Button variant="destructive" disabled={pending || (reason === "Other" && !other.trim())} onClick={async () => { if (await run(detail.order.id, reason === "Other" ? other : reason)) onClose(); }}>
            <Ban /> Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RETURN_REASONS = ["Colour looks different from the photo", "Damage or defect in the fabric", "Received a different saree", "Did not like the drape or texture", "Would like a different colour"];

function ReturnDialog({ detail, open, onClose }: { detail: OrderDetail; open: boolean; onClose: () => void }) {
  const lines = detail.lines.filter((l) => l.status === "ACTIVE");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(lines.length === 1 ? [lines[0]!.id] : []));
  const [type, setType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [reason, setReason] = useState(RETURN_REASONS[0]!);
  const [note, setNote] = useState("");
  const { run, pending } = useOrderAction((orderId: string, input: Parameters<typeof requestReturn>[0]) => requestReturn({ ...input, orderId }), (r) => `${r.number} created`);
  const amount = lines.filter((l) => picked.has(l.id)).reduce((s, l) => s + l.lineTotal, 0);

  const toggle = (id: string) => setPicked((p) => {
    const next = new Set(p);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create return or exchange</DialogTitle>
          <DialogDescription>Order #{detail.order.number} · {detail.order.customer.name}. Choose the sarees coming back.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["RETURN", "EXCHANGE"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn("rounded-lg border p-3 text-left transition-colors", type === t ? "border-primary bg-wine-50 ring-1 ring-primary" : "hover:bg-accent")}
              >
                <div className="text-sm font-medium">{t === "RETURN" ? "Return for refund" : "Exchange"}</div>
                <div className="text-xs text-muted-foreground">{t === "RETURN" ? "Refund after quality check" : "Swap for another saree"}</div>
              </button>
            ))}
          </div>
          <ul className="divide-y rounded-lg border">
            {lines.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 p-2.5 hover:bg-accent/50">
                  <Checkbox checked={picked.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <MediaImage id={l.imageId} alt={l.designName} thumb className="w-9 shrink-0" rounded="rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.designName}</div>
                    <div className="text-xs text-muted-foreground">{l.sku} · {l.colourName}</div>
                  </div>
                  <span className="text-sm font-medium tabular">{formatINR(l.lineTotal)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add details from the customer (optional)" rows={2} />
          </div>
        </div>
        <DialogFooter className="items-center">
          {picked.size > 0 && <span className="mr-auto text-sm text-muted-foreground">{type === "RETURN" ? "Refund value" : "Exchange credit"} <span className="font-semibold text-foreground tabular">{formatINR(amount)}</span></span>}
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || picked.size === 0}
            onClick={async () => {
              const ok = await run(detail.order.id, { orderId: detail.order.id, orderItemIds: [...picked], type, reason: note.trim() ? `${reason}. ${note.trim()}` : reason });
              if (ok) onClose();
            }}
          >
            <RotateCcw /> Create {type === "RETURN" ? "return" : "exchange"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ orderId, open, onClose }: { orderId: string; open: boolean; onClose: () => void }) {
  const [note, setNote] = useState("");
  const { run, pending } = useAction(addOrderNote, { success: "Note added to the timeline" });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>Internal note for the team. Customers never see it.</DialogDescription>
        </DialogHeader>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer asked for gift wrapping, call before delivery" rows={3} autoFocus />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending || !note.trim()}
            onClick={async () => {
              await run(orderId, note);
              setNote("");
              onClose();
            }}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
