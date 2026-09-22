import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const TINTS = ["bg-wine-50 text-primary", "bg-[oklch(0.96_0.04_85)] text-gold-foreground", "bg-success-soft text-success", "bg-info-soft text-info", "bg-muted text-foreground"];

export function CustomerAvatar({ name, className }: { name: string; className?: string }) {
  const tint = TINTS[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % TINTS.length];
  return <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", tint, className)}>{initials(name) || "?"}</span>;
}
