"use client";

import { CheckCircle2, ExternalLink, MessageCircle, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { splitInclusiveTax } from "@/domain/rules/pricing";
import type { Order } from "@/domain/types";
import { useAction } from "@/hooks/use-action";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatDateTime, formatINR, formatINRPaise } from "@/lib/format";
import { getOrderDetail, PAYMENT_METHOD_LABELS } from "@/services/orders";
import { sendPosReceipt } from "@/services/pos";

const PRINT_CSS = `@media print {
  body * { visibility: hidden !important; }
  #pos-receipt, #pos-receipt * { visibility: visible !important; }
  [data-slot=dialog-content] { transform: none !important; left: 0 !important; top: 0 !important; border: 0 !important; box-shadow: none !important; }
  #pos-receipt { position: fixed; left: 0; top: 0; width: 80mm; padding: 0; }
}`;

export function ReceiptDialog({ order, onNewSale }: { order: Order | null; onNewSale: () => void }) {
  const settings = useSettings();
  const { data } = useLive(() => (order ? getOrderDetail(order.id) : Promise.resolve(null)), [order?.id]);
  const send = useAction(sendPosReceipt, { success: "Bill sent on WhatsApp (simulated)" });
  const sent = data?.notifications.some((n) => n.event === "PAYMENT_RECEIVED") ?? false;
  const hasPhone = !!data?.order.customer.phone;
  const b = settings?.business;
  const tax = data ? splitInclusiveTax(data.order.total - data.order.shippingFee, data.order.taxRate) : null;

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onNewSale()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <style>{PRINT_CSS}</style>
        <DialogHeader className="no-print items-center border-b px-6 pt-6 pb-5 text-center sm:text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-7" /></div>
          <DialogTitle className="text-xl">Sale completed</DialogTitle>
          <DialogDescription>
            {order ? (
              <>Order <Link href={`/orders/${order.number}`} className="font-medium text-primary hover:underline" data-testid="receipt-order-link">#{order.number}</Link> · {formatINR(order.total)} received · pieces marked sold</>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/50 px-6 py-5">
          {!data || !b || !tax ? (
            <Skeleton className="h-80 rounded-lg" />
          ) : (
            <div id="pos-receipt" className="mx-auto max-w-[320px] rounded-lg bg-white px-5 py-5 font-mono text-[12px] leading-relaxed text-black shadow-sm">
              <div className="text-center">
                <div className="font-sans text-base font-semibold">{b.name}</div>
                <div>{b.address}, {b.city} {b.pincode}</div>
                <div>Ph {b.phone} · GSTIN {b.gstin}</div>
                <div className="my-2 border-t border-dashed border-black/40" />
                <div className="font-semibold">TAX INVOICE</div>
              </div>
              <div className="mt-2 flex justify-between"><span>Bill #{data.order.number}</span><span>{formatDateTime(data.order.createdAt)}</span></div>
              <div>Customer: {data.order.customer.name}{data.order.customer.phone ? ` (${data.order.customer.phone})` : ""}</div>
              <div>Billed by: {data.order.createdBy}</div>
              <div className="my-2 border-t border-dashed border-black/40" />
              {data.lines.map((l) => (
                <div key={l.id} className="mb-1.5">
                  <div className="flex justify-between gap-2"><span className="truncate">{l.designName}</span><span>{formatINR(l.unitPrice)}</span></div>
                  <div className="flex justify-between text-black/60"><span>{l.sku} · {l.colourName}</span>{l.discount > 0 && <span>disc −{formatINR(l.discount)}</span>}</div>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-black/40" />
              <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(data.order.subtotal)}</span></div>
              {data.order.discount > 0 && <div className="flex justify-between"><span>Bill discount</span><span>−{formatINR(data.order.discount)}</span></div>}
              <div className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>{formatINR(data.order.total)}</span></div>
              <div className="flex justify-between text-black/60"><span>Taxable value</span><span>{formatINRPaise(tax.taxable)}</span></div>
              <div className="flex justify-between text-black/60"><span>CGST {data.order.taxRate / 2}%</span><span>{formatINRPaise(tax.cgst)}</span></div>
              <div className="flex justify-between text-black/60"><span>SGST {data.order.taxRate / 2}%</span><span>{formatINRPaise(tax.sgst)}</span></div>
              <div className="my-2 border-t border-dashed border-black/40" />
              {data.payments.map((p) => (
                <div key={p.id} className="flex justify-between"><span>Paid by {PAYMENT_METHOD_LABELS[p.method]}{p.reference ? ` (${p.reference})` : ""}</span><span>{formatINR(p.amount)}</span></div>
              ))}
              <div className="text-black/60">Prices include GST. HSN {settings?.tax.hsnCode}</div>
              <div className="mt-3 text-center">Thank you for shopping with us!<br />Exchange within {settings?.store.returnWindowDays} days with this bill.</div>
            </div>
          )}
        </div>

        <div className="no-print space-y-3 border-t px-6 py-4">
          {hasPhone ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={sent} disabled={sent || send.pending} onCheckedChange={(on) => on && order && send.run(order.id)} aria-label="Send bill on WhatsApp" />
              <MessageCircle className="size-4 text-success" />
              {sent ? `Bill sent on WhatsApp to +91 ${data?.order.customer.phone}` : "Send bill on WhatsApp"}
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">Walk-in sale. Add a customer next time to send the bill on WhatsApp.</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => window.print()} disabled={!data}><Printer /> Print</Button>
            <Button variant="outline" asChild>
              <Link href={order ? `/orders/${order.number}` : "#"}><ExternalLink /> Order</Link>
            </Button>
            <Button onClick={onNewSale} autoFocus data-testid="pos-new-sale"><Plus /> New sale</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
