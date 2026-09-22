/** Presentation helpers. Indian number grouping and IST-friendly dates. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-IN");

export function formatINR(value: number): string {
  return inr.format(Math.round(value));
}

export function formatINRPaise(value: number): string {
  return inrPaise.format(value);
}

export function formatNumber(value: number): string {
  return num.format(value);
}

/** ₹42.8L, ₹1.2Cr, ₹84.5K. */
export function formatINRCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)).replace(/\.?0+$/, "");
  if (abs >= 1e7) return `${sign}₹${fmt(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${fmt(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${fmt(abs / 1e3)}K`;
  return `${sign}₹${abs}`;
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const weekdayFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

export function formatDate(ts: number): string {
  return dateFmt.format(ts);
}

export function formatShortDate(ts: number): string {
  return shortDateFmt.format(ts);
}

export function formatTime(ts: number): string {
  return timeFmt.format(ts).toUpperCase();
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)}, ${formatTime(ts)}`;
}

export function formatWeekday(ts: number): string {
  return weekdayFmt.format(ts);
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = now - ts;
  const future = diff < 0;
  const s = Math.abs(diff) / 1000;
  const say = (v: number, unit: string) => (future ? `in ${v}${unit}` : `${v}${unit} ago`);
  if (s < 45) return future ? "in a moment" : "just now";
  if (s < 3600) return say(Math.round(s / 60), "m");
  if (s < 86_400) return say(Math.round(s / 3600), "h");
  if (s < 86_400 * 7) return say(Math.round(s / 86_400), "d");
  return formatDate(ts);
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatOrderNumber(n: number): string {
  return `#${n}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
