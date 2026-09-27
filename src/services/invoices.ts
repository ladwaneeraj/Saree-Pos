/**
 * Invoice PDFs. Built from the order snapshot and current business settings, then kept against
 * the order so the same file can be downloaded or shared again. A new file replaces the old one
 * whenever the balance changes, so the QR always asks for what is actually due.
 */
import { repos, transaction } from "@/data";
import type { AppSettings, InvoiceFile } from "@/domain/types";
import { DomainError } from "@/domain/errors";
import { assertPermission } from "@/domain/permissions";
import { invoiceNumber, rupeesInWords } from "@/domain/rules/invoice";
import { balanceDue, upiPaymentUri } from "@/domain/rules/payments";
import { splitInclusiveTax } from "@/domain/rules/pricing";
import { downloadFile } from "@/lib/files";
import { formatDate } from "@/lib/format";
import { newId } from "@/lib/id";
import type { InvoiceModel } from "@/lib/invoice-pdf";
import { currentActor, now } from "./context";
import { getOrderDetail, PAYMENT_METHOD_LABELS, type OrderDetail } from "./orders";
import { getSettings } from "./settings";

export function invoiceNumberFor(detail: Pick<OrderDetail, "order">, settings: AppSettings): string {
  return invoiceNumber(settings.business.shopCode, detail.order.number, detail.order.createdAt);
}

/** Everything the PDF needs, from the order snapshot. Prices are GST-inclusive; the split is derived. */
export function invoiceModel(detail: OrderDetail, settings: AppSettings): InvoiceModel {
  const { order } = detail;
  const biz = settings.business;
  const address = order.shippingAddress;
  const interState = !!address && address.state.trim().toLowerCase() !== biz.state.trim().toLowerCase();
  const goods = order.total - order.shippingFee;
  const tax = splitInclusiveTax(goods, order.taxRate);
  const lines = detail.lines.filter((l) => l.status === "ACTIVE");
  const balance = balanceDue(order);
  const number = invoiceNumberFor(detail, settings);
  const paidBy = [...new Set(detail.payments.filter((p) => p.kind === "PAYMENT").map((p) => PAYMENT_METHOD_LABELS[p.method]))].join(", ");
  return {
    number,
    date: formatDate(order.createdAt),
    business: {
      name: biz.name,
      legalName: biz.legalName,
      gstin: biz.gstin,
      phone: biz.phone,
      email: biz.email,
      website: biz.website,
      address: [biz.address, biz.city, biz.state, biz.pincode].filter(Boolean).join(", "),
      terms: biz.invoiceTerms,
      state: biz.state,
    },
    billTo: {
      name: order.customer.name,
      phone: order.customer.phone,
      address: address ? [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ") : `${biz.city}, ${biz.state}`,
    },
    shipTo: address ? { name: address.name, address: [address.line1, address.line2, address.city, address.state, address.pincode].filter(Boolean).join(", ") } : null,
    placeOfSupply: address?.state ?? biz.state,
    lines: lines.map((l) => {
      const split = splitInclusiveTax(l.lineTotal, order.taxRate);
      return {
        description: l.designName,
        detail: [l.fabricName, l.colourName, `SKU ${l.sku}`].filter(Boolean).join(" · "),
        hsn: settings.tax.hsnCode,
        quantity: 1,
        rate: split.taxable,
        tax: split.tax,
        total: l.lineTotal,
      };
    }),
    taxable: tax.taxable,
    taxRate: order.taxRate,
    interState,
    tax: tax.tax,
    discount: order.discount,
    shipping: order.shippingFee,
    total: order.total,
    received: order.total - balance,
    balance,
    amountInWords: rupeesInWords(order.total),
    upiUri: biz.upiId ? upiPaymentUri({ upiId: biz.upiId, payeeName: biz.name, amount: balance, note: `Invoice ${number}` }) : null,
    paidBy,
  };
}

/** Renders the PDF in the browser. jsPDF is loaded on demand so it never weighs on the first paint. */
export async function renderInvoicePdf(detail: OrderDetail, settings: AppSettings): Promise<{ blob: Blob; number: string }> {
  const { buildInvoicePdf } = await import("@/lib/invoice-pdf");
  const model = invoiceModel(detail, settings);
  return { blob: buildInvoicePdf(model).output("blob"), number: model.number };
}

export function invoiceFileName(number: string, customerName: string): string {
  const safe = (s: string) => s.replace(/[^\w-]+/g, "_").replace(/^_|_$/g, "");
  return `${safe(number)}_sales_invoice_${safe(customerName) || "customer"}.pdf`;
}

/** Builds the PDF for an order and stores it, replacing any earlier file for the same order. */
export async function saveInvoicePdf(orderId: string): Promise<InvoiceFile> {
  assertPermission(currentActor(), "orders:view");
  const [detail, settings] = await Promise.all([getOrderDetail(orderId), getSettings()]);
  if (!detail) throw new DomainError("Order not found");
  const { blob, number } = await renderInvoicePdf(detail, settings);
  const file: InvoiceFile = { id: newId("inv"), orderId, number, balance: balanceDue(detail.order), size: blob.size, blob, createdAt: now() };
  await transaction(async () => {
    const old = await repos().invoices.listByOrder(orderId);
    await repos().invoices.bulkRemove(old.map((o) => o.id));
    await repos().invoices.add(file);
  });
  return file;
}

export function getStoredInvoice(orderId: string): Promise<InvoiceFile | undefined> {
  return repos().invoices.listByOrder(orderId).then((list) => list[0]);
}

/** Downloads the stored file when it matches the current balance, otherwise regenerates first. */
export async function downloadInvoicePdf(orderId: string): Promise<InvoiceFile> {
  const [stored, detail] = await Promise.all([getStoredInvoice(orderId), getOrderDetail(orderId)]);
  if (!detail) throw new DomainError("Order not found");
  const file = stored && stored.balance === balanceDue(detail.order) ? stored : await saveInvoicePdf(orderId);
  downloadFile(invoiceFileName(file.number, detail.order.customer.name), file.blob, "application/pdf");
  return file;
}
