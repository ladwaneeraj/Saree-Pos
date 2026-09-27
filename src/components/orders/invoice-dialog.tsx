"use client";

import { Download, FileCheck2, Loader2, Printer, QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppSettings, InvoiceFile } from "@/domain/types";
import { balanceDue } from "@/domain/rules/payments";
import { useAction } from "@/hooks/use-action";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatDateTime, formatINRPaise } from "@/lib/format";
import type { InvoiceModel } from "@/lib/invoice-pdf";
import { downloadInvoicePdf, getStoredInvoice, invoiceModel, saveInvoicePdf } from "@/services/invoices";
import type { OrderDetail } from "@/services/orders";
import { UpiQr } from "@/components/shared/upi-qr";

/** Prints only the invoice node, in a hidden frame that reuses the app's stylesheets. */
function printNode(node: HTMLElement, title: string): void {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("");
  doc.open();
  doc.write(`<!doctype html><html><head><title>${title}</title>${styles}<style>@page{size:A4;margin:12mm}body{background:#fff}</style></head><body>${node.outerHTML}</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1000);
  }, 500);
}

export function InvoiceDialog({ detail, open, onOpenChange }: { detail: OrderDetail; open: boolean; onOpenChange: (open: boolean) => void }) {
  const settings = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const model = settings ? invoiceModel(detail, settings) : null;
  const { data: stored } = useLive(() => getStoredInvoice(detail.order.id), [detail.order.id, detail.order.amountPaid]);
  const download = useAction(downloadInvoicePdf, { success: "Invoice PDF downloaded" });
  const save = useAction(saveInvoicePdf, { success: "Invoice PDF saved to this order" });
  const balance = balanceDue(detail.order);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 pr-8">
          <div className="space-y-1">
            <DialogTitle>Tax invoice {model?.number}</DialogTitle>
            <DialogDescription>
              {balance > 0 ? `${formatINRPaise(balance)} still due. The PDF carries a UPI QR for that amount.` : "Prices are inclusive of GST. The invoice uses the prices charged on the day of sale."}
            </DialogDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => ref.current && printNode(ref.current, `Invoice ${model?.number}`)} disabled={!settings}>
              <Printer /> Print
            </Button>
            <Button onClick={() => download.run(detail.order.id)} disabled={!settings || download.pending}>
              {download.pending ? <Loader2 className="animate-spin" /> : <Download />} PDF
            </Button>
          </div>
        </DialogHeader>
        <StoredInvoiceNote stored={stored} balance={balance} onSave={() => save.run(detail.order.id)} saving={save.pending} />
        <div className="overflow-x-auto rounded-lg border">
          {model && settings ? (
            <div ref={ref}>
              <InvoiceSheet model={model} settings={settings} />
            </div>
          ) : (
            <Skeleton className="h-96" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StoredInvoiceNote({ stored, balance, onSave, saving }: { stored: InvoiceFile | undefined | null; balance: number; onSave: () => void; saving: boolean }) {
  const current = stored && stored.balance === balance;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <FileCheck2 className="size-3.5" />
        {stored ? (
          <>
            PDF saved {formatDateTime(stored.createdAt)} ({Math.round(stored.size / 1024)} KB){!current && ", balance has changed since"}
          </>
        ) : (
          "No PDF saved for this order yet"
        )}
      </span>
      <Button size="xs" variant="ghost" onClick={onSave} disabled={saving || !!current}>
        {saving ? <Loader2 className="animate-spin" /> : null} {current ? "Up to date" : stored ? "Regenerate PDF" : "Save PDF"}
      </Button>
    </div>
  );
}

const rs = (n: number) => formatINRPaise(n);

/** HTML twin of the PDF layout, used for on-screen preview and browser printing. */
function InvoiceSheet({ model: m, settings }: { model: InvoiceModel; settings: AppSettings }) {
  const biz = m.business;
  return (
    <div className="min-w-[640px] bg-white p-8 text-[12px] leading-relaxed text-neutral-900">
      <div className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
        <div>
          <div className="font-display text-3xl text-primary">{biz.name}</div>
          {biz.gstin && <div className="font-medium">GSTIN {biz.gstin}</div>}
          <div className="text-neutral-600">{[biz.phone, biz.email].filter(Boolean).join(" · ")}</div>
          <div className="text-neutral-600">{biz.address}</div>
          {biz.website && <div className="text-neutral-600">website: {biz.website}</div>}
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tracking-wide uppercase">Tax invoice</div>
          <div className="mt-1 inline-block rounded border border-neutral-300 px-2 text-[10px] text-neutral-600 uppercase">Original for recipient</div>
        </div>
      </div>
      <div className="flex gap-12 border-b border-neutral-300 py-3">
        <div><div className="text-[10px] font-semibold text-neutral-500 uppercase">Invoice no.</div><div className="font-medium">{m.number}</div></div>
        <div><div className="text-[10px] font-semibold text-neutral-500 uppercase">Invoice date</div><div className="font-medium">{m.date}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-6 border-b border-neutral-300 py-4">
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Bill to</div>
          <div className="font-medium">{m.billTo.name}</div>
          <div>{m.billTo.address}</div>
          {m.billTo.phone && <div>Mobile {m.billTo.phone}</div>}
          <div>Place of supply {m.placeOfSupply}</div>
        </div>
        <div className="border-l border-neutral-300 pl-6">
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Ship to</div>
          {m.shipTo ? (<><div className="font-medium">{m.shipTo.name}</div><div>{m.shipTo.address}</div></>) : <div>Collected at store</div>}
        </div>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-neutral-300 bg-[#e2eecd] text-left text-[10px] tracking-wider text-neutral-700 uppercase">
            <th className="px-2 py-2">No</th><th className="px-2 py-2">Items</th><th className="px-2 py-2">HSN</th>
            <th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-right">Tax</th><th className="px-2 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {m.lines.map((l, i) => (
            <tr key={i} className="border-b border-neutral-200 align-top">
              <td className="px-2 py-2">{i + 1}</td>
              <td className="px-2 py-2"><div className="font-medium text-primary">{l.description}</div><div className="text-neutral-500">{l.detail}</div></td>
              <td className="px-2 py-2">{l.hsn}</td>
              <td className="px-2 py-2 text-right tabular">{l.quantity} PCS</td>
              <td className="px-2 py-2 text-right tabular">{rs(l.rate)}</td>
              <td className="px-2 py-2 text-right tabular">{rs(l.tax)}<div className="text-[10px] text-neutral-500">({m.taxRate}%)</div></td>
              <td className="px-2 py-2 text-right font-medium tabular">{rs(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between gap-8">
        <div className="max-w-xs space-y-2 text-neutral-600">
          <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Terms & conditions</div>
          <p className="text-[10px] leading-snug">{biz.terms}</p>
        </div>
        <table className="w-72 tabular">
          <tbody>
            <Row label="Taxable amount" value={m.taxable} muted />
            {m.discount > 0 && <Row label="Discount" value={-m.discount} muted />}
            {m.interState ? <Row label={`IGST @ ${m.taxRate}%`} value={m.tax} muted /> : (<><Row label={`CGST @ ${m.taxRate / 2}%`} value={m.tax / 2} muted /><Row label={`SGST @ ${m.taxRate / 2}%`} value={m.tax / 2} muted /></>)}
            {m.shipping > 0 && <Row label="Shipping" value={m.shipping} />}
            <tr className="border-t border-neutral-900 text-sm font-semibold"><td className="py-2">Total amount</td><td className="py-2 text-right">{rs(m.total)}</td></tr>
            <Row label="Received amount" value={m.received} muted />
            <tr className="font-semibold"><td className="py-0.5">Balance</td><td className="py-0.5 text-right">{rs(m.balance)}</td></tr>
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex items-end justify-between gap-6 border-t border-neutral-300 pt-4">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Total amount (in words)</div>
          <div className="font-medium">{m.amountInWords}</div>
          {m.paidBy && <div className="mt-1 text-neutral-500">Paid by {m.paidBy}</div>}
        </div>
        <div className="flex min-w-56 items-center gap-3 rounded-lg border border-[#c9a24a] p-3">
          {m.balance > 0 && m.upiUri ? (
            <>
              <UpiQr uri={m.upiUri} size={88} />
              <div>
                <div className="inline-flex items-center gap-1 font-semibold"><QrCode className="size-3.5" /> Scan to pay balance</div>
                <div className="text-base font-semibold text-primary">{rs(m.balance)}</div>
                <div className="text-[10px] text-neutral-500">Any UPI app · {settings.business.upiId}</div>
              </div>
            </>
          ) : (
            <div className="w-full text-center"><div className="h-10" /><div className="font-medium">Signature</div><div className="text-neutral-500">{biz.legalName || biz.name}</div></div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <tr className={muted ? "text-neutral-500" : undefined}>
      <td className="py-0.5">{label}</td>
      <td className="py-0.5 text-right">{value < 0 ? `-${rs(-value)}` : rs(value)}</td>
    </tr>
  );
}
