/**
 * Tax invoice PDF, laid out like the shop's printed bill book. Pure: no DOM, no data access,
 * so it can be rendered in the browser or under Node for tests.
 *
 * Standard PDF fonts have no rupee glyph, so amounts print as "Rs." with Indian digit grouping.
 */
import { jsPDF } from "jspdf";
import qrcode from "qrcode-generator";

export interface InvoiceLine {
  description: string;
  detail: string;
  hsn: string;
  quantity: number;
  /** Taxable rate per unit (price exclusive of GST). */
  rate: number;
  tax: number;
  total: number;
}

export interface InvoiceModel {
  number: string;
  date: string;
  business: { name: string; legalName: string; gstin: string; phone: string; email: string; website: string; address: string; terms: string; state: string };
  billTo: { name: string; phone: string; address: string };
  shipTo: { name: string; address: string } | null;
  placeOfSupply: string;
  lines: InvoiceLine[];
  taxable: number;
  taxRate: number;
  /** Intra-state: CGST and SGST are each half the tax. Inter-state: IGST is the whole tax. */
  interState: boolean;
  tax: number;
  discount: number;
  shipping: number;
  total: number;
  received: number;
  balance: number;
  amountInWords: string;
  /** upi://pay link. Rendered as a QR code when the balance is above zero. */
  upiUri: string | null;
  paidBy: string;
}

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const rs = (n: number) => `Rs. ${inr.format(n)}`;

const PAGE = { w: 210, h: 297, margin: 12 };
const WINE: [number, number, number] = [107, 31, 58];
const INK: [number, number, number] = [28, 28, 28];
const MUTED: [number, number, number] = [110, 110, 110];
const RULE: [number, number, number] = [205, 205, 205];
const BAND: [number, number, number] = [226, 238, 205];

export function buildInvoicePdf(m: InvoiceModel): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = PAGE.margin;
  const right = PAGE.w - PAGE.margin;
  const width = right - left;
  let y = PAGE.margin;

  const text = (s: string | string[], x: number, yy: number, o: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center"; maxWidth?: number } = {}) => {
    doc.setFont("helvetica", o.bold ? "bold" : "normal");
    doc.setFontSize(o.size ?? 9);
    doc.setTextColor(...(o.color ?? INK));
    doc.text(s, x, yy, { align: o.align ?? "left", maxWidth: o.maxWidth });
  };
  const rule = (yy: number, x1 = left, x2 = right) => {
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.25);
    doc.line(x1, yy, x2, yy);
  };
  const wrap = (s: string, w: number, size: number, bold = false): string[] => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    return doc.splitTextToSize(s, w) as string[];
  };

  /* Header ----------------------------------------------------------- */
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.4);
  doc.rect(left - 2, y - 2, width + 4, PAGE.h - 2 * PAGE.margin + 4);

  text(m.business.name, left + 2, y + 8, { size: 20, bold: true, color: WINE });
  const contactLines = [
    m.business.gstin ? `GSTIN ${m.business.gstin}` : "",
    [m.business.phone, m.business.email].filter(Boolean).join("   "),
    m.business.address,
    m.business.website ? `website: ${m.business.website}` : "",
  ].filter(Boolean);
  let hy = y + 14;
  for (const l of contactLines) {
    text(l, left + 2, hy, { size: 8.5, color: MUTED });
    hy += 4.2;
  }
  text("TAX INVOICE", right - 2, y + 8, { size: 13, bold: true, align: "right" });
  doc.setDrawColor(...RULE);
  doc.rect(right - 42, y + 10.5, 40, 6);
  text("ORIGINAL FOR RECIPIENT", right - 22, y + 14.6, { size: 7, color: MUTED, align: "center" });
  y = Math.max(hy, y + 22) + 3;
  rule(y);

  /* Invoice meta ------------------------------------------------------ */
  y += 6;
  text("Invoice No.", left + 2, y, { size: 8, bold: true });
  text("Invoice Date", left + 50, y, { size: 8, bold: true });
  text(m.number, left + 2, y + 4.5, { size: 9 });
  text(m.date, left + 50, y + 4.5, { size: 9 });
  y += 8;
  rule(y);

  /* Bill to / ship to ------------------------------------------------- */
  y += 6;
  const mid = left + width / 2;
  text("Bill To", left + 2, y, { size: 9, bold: true, color: WINE });
  text(m.billTo.name, left + 2, y + 5, { size: 9, bold: true });
  const billAddr = wrap(m.billTo.address || "", width / 2 - 8, 8.5);
  billAddr.forEach((l, i) => text(l, left + 2, y + 9.5 + i * 4, { size: 8.5 }));
  let by = y + 9.5 + billAddr.length * 4;
  if (m.billTo.phone) {
    text(`Mobile ${m.billTo.phone}`, left + 2, by, { size: 8.5 });
    by += 4;
  }
  text(`Place of Supply ${m.placeOfSupply}`, left + 2, by, { size: 8.5 });
  by += 4;

  let sy = y;
  if (m.shipTo) {
    text("Ship To", mid + 4, sy, { size: 9, bold: true, color: WINE });
    text(m.shipTo.name, mid + 4, sy + 5, { size: 9, bold: true });
    const shipAddr = wrap(m.shipTo.address, width / 2 - 8, 8.5);
    shipAddr.forEach((l, i) => text(l, mid + 4, sy + 9.5 + i * 4, { size: 8.5 }));
    sy = sy + 9.5 + shipAddr.length * 4;
  }
  doc.line(mid, y - 4, mid, Math.max(by, sy) + 1);
  y = Math.max(by, sy) + 2;
  rule(y);

  /* Items table -------------------------------------------------------- */
  const cols = [
    { key: "no", label: "No", w: 10, align: "left" as const },
    { key: "item", label: "Items", w: 74, align: "left" as const },
    { key: "hsn", label: "HSN No.", w: 18, align: "left" as const },
    { key: "qty", label: "Qty.", w: 16, align: "right" as const },
    { key: "rate", label: "Rate", w: 24, align: "right" as const },
    { key: "tax", label: "Tax", w: 22, align: "right" as const },
    { key: "total", label: "Total", w: 22, align: "right" as const },
  ];
  const colX: number[] = [];
  let cx = left + 2;
  for (const c of cols) {
    colX.push(cx);
    cx += c.w;
  }
  const cellX = (i: number) => (cols[i]!.align === "right" ? colX[i]! + cols[i]!.w - 2 : colX[i]!);

  y += 1;
  doc.setFillColor(...BAND);
  doc.rect(left - 2, y, width + 4, 8, "F");
  cols.forEach((c, i) => text(c.label, cellX(i), y + 5.3, { size: 8, bold: true, align: c.align }));
  y += 12;

  const tableBottom = PAGE.h - 118;
  m.lines.forEach((l, i) => {
    if (y > tableBottom) {
      doc.addPage();
      y = PAGE.margin + 6;
    }
    const nameLines = wrap(l.description, cols[1]!.w - 4, 9, true);
    text(nameLines, colX[1]!, y, { size: 9, bold: true, color: WINE });
    let dy = y + nameLines.length * 4;
    if (l.detail) {
      text(l.detail, colX[1]!, dy, { size: 7.5, color: MUTED, maxWidth: cols[1]!.w - 4 });
      dy += 3.5;
    }
    text(String(i + 1), cellX(0), y, { size: 9 });
    text(l.hsn, cellX(2), y, { size: 9 });
    text(`${l.quantity} PCS`, cellX(3), y, { size: 9, align: "right" });
    text(inr.format(l.rate), cellX(4), y, { size: 9, align: "right" });
    text(inr.format(l.tax), cellX(5), y, { size: 9, align: "right" });
    text(`(${m.taxRate}%)`, cellX(5), y + 3.5, { size: 7, color: MUTED, align: "right" });
    text(inr.format(l.total), cellX(6), y, { size: 9, align: "right" });
    y = Math.max(dy, y + 7) + 2;
  });

  /* Subtotal band ------------------------------------------------------ */
  const qty = m.lines.reduce((s, l) => s + l.quantity, 0);
  const bandY = Math.max(y + 4, PAGE.h - 112);
  doc.setFillColor(...BAND);
  doc.rect(left - 2, bandY, width + 4, 8, "F");
  text("SUBTOTAL", colX[1]!, bandY + 5.3, { size: 8.5, bold: true });
  text(String(qty), cellX(3), bandY + 5.3, { size: 8.5, bold: true, align: "right" });
  text(rs(m.tax), cellX(5), bandY + 5.3, { size: 8.5, bold: true, align: "right" });
  text(rs(m.total - m.shipping), cellX(6), bandY + 5.3, { size: 8.5, bold: true, align: "right" });
  y = bandY + 14;

  /* Totals (right) ----------------------------------------------------- */
  const tx = mid + 4;
  const tr = right - 2;
  let ty = y;
  const row = (label: string, value: string, o: { bold?: boolean; size?: number } = {}) => {
    text(label, tx, ty, { size: o.size ?? 8.5, bold: o.bold, color: o.bold ? INK : MUTED });
    text(value, tr, ty, { size: o.size ?? 8.5, bold: o.bold, align: "right" });
    ty += 5;
  };
  row("Taxable Amount", rs(m.taxable));
  if (m.discount > 0) row("Discount", `- ${rs(m.discount)}`);
  if (m.interState) row(`IGST @${m.taxRate}%`, rs(m.tax));
  else {
    row(`CGST @${m.taxRate / 2}%`, rs(m.tax / 2));
    row(`SGST @${m.taxRate / 2}%`, rs(m.tax / 2));
  }
  if (m.shipping > 0) row("Shipping", rs(m.shipping));
  ty += 1;
  rule(ty - 3.5, tx, tr);
  row("Total Amount", rs(m.total), { bold: true, size: 10.5 });
  ty += 1;
  rule(ty - 3.5, tx, tr);
  row("Received Amount", rs(m.received));
  row("Balance", rs(m.balance), { bold: true });
  if (m.paidBy) row("Paid by", m.paidBy);
  ty += 3;
  text("Total Amount (in words)", tx, ty, { size: 8.5, bold: true });
  ty += 4.5;
  wrap(m.amountInWords, tr - tx, 8.5).forEach((l) => {
    text(l, tx, ty, { size: 8.5, color: MUTED });
    ty += 4;
  });

  /* Terms (left) --------------------------------------------------------- */
  let ly = y;
  text("Terms & Conditions", left + 2, ly, { size: 9, bold: true });
  ly += 4.5;
  wrap(m.business.terms, width / 2 - 8, 7.5).forEach((l) => {
    text(l, left + 2, ly, { size: 7.5, color: MUTED });
    ly += 3.4;
  });

  /* Payment QR or signature block --------------------------------------- */
  const boxY = Math.max(ty, ly) + 6;
  const boxH = 34;
  const boxW = 80;
  const boxX = right - 2 - boxW;
  const safeBoxY = Math.min(boxY, PAGE.h - PAGE.margin - boxH - 4);
  doc.setDrawColor(201, 162, 74);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, safeBoxY, boxW, boxH, 2, 2);
  if (m.balance > 0 && m.upiUri) {
    drawQr(doc, m.upiUri, boxX + 3, safeBoxY + 3, boxH - 6);
    text("Scan to pay balance", boxX + boxH + 2, safeBoxY + 9, { size: 9, bold: true });
    text(rs(m.balance), boxX + boxH + 2, safeBoxY + 15, { size: 11, bold: true, color: WINE });
    text("Any UPI app. Amount is filled in.", boxX + boxH + 2, safeBoxY + 21, { size: 7.5, color: MUTED });
    text(`For ${m.business.legalName || m.business.name}`, boxX + boxH + 2, safeBoxY + 29, { size: 7.5, color: MUTED });
  } else {
    text("Signature", boxX + boxW / 2, safeBoxY + boxH - 9, { size: 8.5, bold: true, align: "center" });
    text(m.business.legalName || m.business.name, boxX + boxW / 2, safeBoxY + boxH - 4.5, { size: 8, color: MUTED, align: "center" });
  }
  return doc;
}

/** QR code as filled squares, quiet zone included in `size`. */
function drawQr(doc: jsPDF, data: string, x: number, y: number, size: number): void {
  const qr = qrcode(0, "M");
  qr.addData(data);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / (n + 2);
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) doc.rect(x + (c + 1) * cell, y + (r + 1) * cell, cell, cell, "F");
    }
  }
}
