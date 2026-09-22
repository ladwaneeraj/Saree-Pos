import type { CSSProperties } from "react";

/** WhatsApp Web palette, used only inside the simulated sales desk. */
export const WA = {
  chatBg: "bg-[#efeae2]",
  outBubble: "bg-[#d9fdd3]",
  inBubble: "bg-white",
  text: "text-[#111b21]",
  meta: "text-[#667781]",
  green: "bg-[#00a884]",
  greenText: "text-[#008069]",
  panel: "bg-[#f0f2f5]",
} as const;

/** Subtle doodle-like dot pattern behind the chat, like WhatsApp's wallpaper. */
export const WA_WALLPAPER: CSSProperties = {
  backgroundImage:
    "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.035) 1.5px, transparent 1.6px), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.03) 1.2px, transparent 1.3px)",
  backgroundSize: "28px 28px, 36px 36px",
};

export function dayLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-IN", { weekday: "long" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/** Time for the chat list: clock time today, "Yesterday", weekday, or date. */
export function listTime(ts: number, now = Date.now()): string {
  const label = dayLabel(ts, now);
  if (label === "Today") return new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
  if (label === "Yesterday") return label;
  if (now - ts < 7 * 86_400_000) return new Date(ts).toLocaleDateString("en-IN", { weekday: "short" });
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const AVATAR_TONES = ["bg-[#dfe5e7] text-[#54656f]", "bg-[#fde2e4] text-[#9b2c3a]", "bg-[#e1f2ea] text-[#127a55]", "bg-[#fff1d6] text-[#8a5a00]", "bg-[#e7e3fb] text-[#5b44b5]"];
export function avatarTone(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
}
