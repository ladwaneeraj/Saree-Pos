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

export function financialYear(ts: number): string {
  const d = new Date(ts);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start % 100).padStart(2, "0")}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Bill-book style number: DS/26-27/Aug470. */
export function invoiceNumber(shopCode: string, orderNumber: number, createdAt: number): string {
  return `${shopCode || "INV"}/${financialYear(createdAt)}/${MONTHS[new Date(createdAt).getMonth()]}${orderNumber}`;
}
