"use client";

import { Printer } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppSettings } from "@/domain/types";
import { splitInclusiveTax } from "@/domain/rules/pricing";
import { useSettings } from "@/hooks/use-catalog";
import { formatDate, formatINRPaise } from "@/lib/format";
import type { OrderDetail } from "@/services/orders";
import { PAYMENT_METHOD_LABELS } from "@/services/orders";

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

/** Indian numbering: 1,23,456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six". */
export function rupeesInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const units: [number, string][] = [[10_000_000, "Crore"], [100_000, "Lakh"], [1000, "Thousand"], [100, "Hundred"]];
  for (const [value, name] of units) {
    const q = Math.floor(n / value);
    if (q) parts.push(`${value === 10_000_000 ? rupeesInWords(q).replace(/^Rupees | Only$/g, "") : twoDigits(q)} ${name}`);
    n %= value;
  }
  if (n) parts.push(twoDigits(n));
  return `Rupees ${parts.join(" ")} Only`;
}

function financialYear(ts: number): string {
  const d = new Date(ts);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function invoiceNumber(orderNumber: number, createdAt: number): string {
  return `DS/${financialYear(createdAt)}/${orderNumber}`;
}

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
  const number = invoiceNumber(detail.order.number, detail.order.createdAt);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 pr-8">
          <div className="space-y-1">
            <DialogTitle>Tax invoice {number}</DialogTitle>
            <DialogDescription>Prices are inclusive of GST. The invoice uses the prices charged on the day of sale.</DialogDescription>
          </div>
          <Button onClick={() => ref.current && printNode(ref.current, `Invoice ${number}`)} disabled={!settings}>
            <Printer /> Print
          </Button>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          {settings ? (
            <div ref={ref}>
              <InvoiceSheet detail={detail} settings={settings} number={number} />
            </div>
          ) : (
            <Skeleton className="h-96" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceSheet({ detail, settings, number }: { detail: OrderDetail; settings: AppSettings; number: string }) {
  const { order } = detail;
  const biz = settings.business;
  const lines = detail.lines;
  const goods = order.total - order.shippingFee;
  const tax = splitInclusiveTax(goods, order.taxRate);
  const address = order.shippingAddress;
  const interState = !!address && address.state.trim().toLowerCase() !== biz.state.trim().toLowerCase();
  const paymentMethods = [...new Set(detail.payments.filter((p) => p.kind === "PAYMENT").map((p) => PAYMENT_METHOD_LABELS[p.method]))].join(", ");

  return (
    <div className="min-w-[640px] bg-white p-8 text-[12px] leading-relaxed text-neutral-900">
      <div className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-4">
        <div>
          <div className="font-display text-3xl text-primary">{biz.name}</div>
          <div className="font-medium">{biz.legalName}</div>
          <div className="text-neutral-600">
            {biz.address}, {biz.city}, {biz.state} {biz.pincode}
          </div>
          <div className="text-neutral-600">
            {biz.phone} · {biz.email}
          </div>
          <div className="mt-1 font-medium">GSTIN: {biz.gstin}</div>
        </div>
        <div className="text-right">
          <div className="text-base font-semibold tracking-wide uppercase">Tax invoice</div>
          <div className="mt-1 text-neutral-600">Original for recipient</div>
          <table className="mt-2 ml-auto text-left">
            <tbody>
              <tr><td className="pr-3 text-neutral-500">Invoice no.</td><td className="font-medium">{number}</td></tr>
              <tr><td className="pr-3 text-neutral-500">Invoice date</td><td className="font-medium">{formatDate(order.createdAt)}</td></tr>
              <tr><td className="pr-3 text-neutral-500">Order</td><td className="font-medium">#{order.number}</td></tr>
              <tr><td className="pr-3 text-neutral-500">Place of supply</td><td className="font-medium">{address?.state ?? biz.state}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 border-b border-neutral-300 py-4">
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Billed to</div>
          <div className="font-medium">{order.customer.name}</div>
          {order.customer.phone && <div>+91 {order.customer.phone}</div>}
          {order.customer.email && <div>{order.customer.email}</div>}
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">{address ? "Shipped to" : "Delivery"}</div>
          {address ? (
            <>
              <div className="font-medium">{address.name}</div>
              <div>{[address.line1, address.line2].filter(Boolean).join(", ")}</div>
              <div>
                {address.city}, {address.state} {address.pincode}
              </div>
            </>
          ) : (
            <div>Collected at store</div>
          )}
        </div>
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-neutral-300 bg-neutral-50 text-left text-[10px] tracking-wider text-neutral-500 uppercase">
            <th className="px-2 py-2">#</th>
            <th className="px-2 py-2">Description</th>
            <th className="px-2 py-2">HSN</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">MRP</th>
            <th className="px-2 py-2 text-right">Discount</th>
            <th className="px-2 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id} className="border-b border-neutral-200 align-top">
              <td className="px-2 py-2">{i + 1}</td>
              <td className="px-2 py-2">
                <div className="font-medium">{l.designName}</div>
                <div className="text-neutral-500">
                  {l.fabricName} · {l.colourName} · SKU {l.sku}
                </div>
              </td>
              <td className="px-2 py-2">{settings.tax.hsnCode}</td>
              <td className="px-2 py-2 text-right tabular">1</td>
              <td className="px-2 py-2 text-right tabular">{formatINRPaise(l.mrp)}</td>
              <td className="px-2 py-2 text-right tabular">{formatINRPaise(l.mrp - l.lineTotal)}</td>
              <td className="px-2 py-2 text-right font-medium tabular">{formatINRPaise(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between gap-8">
        <div className="max-w-xs space-y-2 text-neutral-600">
          <div>
            <span className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">Amount in words</span>
            <div className="font-medium text-neutral-900">{rupeesInWords(order.total)}</div>
          </div>
          {paymentMethods && <div>Paid by {paymentMethods}</div>}
        </div>
        <table className="w-72 tabular">
          <tbody>
            <InvoiceRow label="Items total" value={order.subtotal} />
            {order.discount > 0 && <InvoiceRow label="Less: discount" value={-order.discount} />}
            <InvoiceRow label="Taxable value" value={tax.taxable} muted />
            {interState ? (
              <InvoiceRow label={`IGST @ ${order.taxRate}%`} value={tax.tax} muted />
            ) : (
              <>
                <InvoiceRow label={`CGST @ ${order.taxRate / 2}%`} value={tax.cgst} muted />
                <InvoiceRow label={`SGST @ ${order.taxRate / 2}%`} value={tax.sgst} muted />
              </>
            )}
            {order.shippingFee > 0 && <InvoiceRow label="Shipping" value={order.shippingFee} />}
            <tr className="border-t border-neutral-900 text-sm font-semibold">
              <td className="py-2">Grand total</td>
              <td className="py-2 text-right">{formatINRPaise(order.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex items-end justify-between border-t border-neutral-300 pt-4 text-neutral-500">
        <div className="max-w-sm">
          Goods once sold can be returned or exchanged within {settings.store.returnWindowDays} days of delivery with the original tags. Thank you for shopping with {biz.name}.
        </div>
        <div className="text-right">
          <div className="h-10" />
          <div className="font-medium text-neutral-900">For {biz.legalName}</div>
          <div>Authorised signatory</div>
        </div>
      </div>
    </div>
  );
}

function InvoiceRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <tr className={muted ? "text-neutral-500" : undefined}>
      <td className="py-0.5">{label}</td>
      <td className="py-0.5 text-right">{value < 0 ? `-${formatINRPaise(-value)}` : formatINRPaise(value)}</td>
    </tr>
  );
}
