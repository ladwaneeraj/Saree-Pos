import {
  AlertTriangle,
  ArrowRightLeft,
  BadgeCheck,
  Clock,
  PackageCheck,
  PackageOpen,
  Pencil,
  RotateCcw,
  ShoppingBag,
  Tag,
  Timer,
  Truck,
  Undo2,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { InventoryMovement, MovementType } from "@/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChannelBadge } from "@/components/shared/status-badge";

type Tone = "wine" | "success" | "warning" | "danger" | "muted" | "info" | "gold";

const META: Record<MovementType, { label: string; icon: LucideIcon; tone: Tone }> = {
  PURCHASED: { label: "Purchased", icon: Truck, tone: "info" },
  RECEIVED: { label: "Received into stock", icon: PackageCheck, tone: "success" },
  LOCATION_CHANGED: { label: "Moved rack", icon: ArrowRightLeft, tone: "muted" },
  RESERVED: { label: "Reserved", icon: Clock, tone: "warning" },
  RESERVATION_RELEASED: { label: "Reservation released", icon: Undo2, tone: "muted" },
  RESERVATION_EXPIRED: { label: "Reservation expired", icon: Timer, tone: "muted" },
  SOLD: { label: "Sold", icon: ShoppingBag, tone: "wine" },
  RETURN_RECEIVED: { label: "Return received", icon: RotateCcw, tone: "info" },
  QC_PASSED: { label: "Quality check passed", icon: BadgeCheck, tone: "success" },
  QC_FAILED: { label: "Quality check failed", icon: XCircle, tone: "danger" },
  MARKED_DAMAGED: { label: "Marked damaged", icon: AlertTriangle, tone: "danger" },
  RESTORED: { label: "Restored to stock", icon: Wrench, tone: "success" },
  PRICE_CHANGED: { label: "Price changed", icon: Tag, tone: "gold" },
  EDITED: { label: "Details edited", icon: Pencil, tone: "muted" },
};

const TONE: Record<Tone, string> = {
  wine: "bg-wine-50 text-primary ring-primary/15",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-[oklch(0.5_0.12_65)] ring-warning/25",
  danger: "bg-danger-soft text-destructive ring-destructive/20",
  info: "bg-info-soft text-info ring-info/20",
  gold: "bg-[oklch(0.96_0.04_85)] text-gold-foreground ring-gold/30",
  muted: "bg-muted text-muted-foreground ring-border",
};

export const movementLabel = (type: MovementType) => META[type].label;

function RefLink({ m }: { m: InventoryMovement }) {
  if (!m.refLabel) return null;
  if (m.refType === "ORDER") return <Link href={`/orders/view?number=${m.refLabel.replace(/^#/, "")}`} className="font-medium text-primary hover:underline">Order {m.refLabel}</Link>;
  if (m.refType === "PURCHASE" && m.refId) return <Link href={`/purchases/view?id=${m.refId}`} className="font-medium text-primary hover:underline">{m.refLabel}</Link>;
  if (m.refType === "RETURN" && m.refId) return <Link href={`/returns?open=${m.refId}`} className="font-medium text-primary hover:underline">{m.refLabel}</Link>;
  return <span className="font-medium text-foreground">{m.refLabel}</span>;
}

/** Vertical history of everything that happened to one physical piece. Newest first. */
export function MovementTimeline({ movements }: { movements: InventoryMovement[] }) {
  const list = [...movements].sort((a, b) => b.createdAt - a.createdAt);
  if (list.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">No movements recorded yet.</p>;
  return (
    <ol className="relative">
      {list.map((m, i) => {
        const meta = META[m.type];
        const Icon = meta.icon;
        const title = m.type === "LOCATION_CHANGED" && m.location ? `Moved to rack ${m.location}` : meta.label;
        return (
          <li key={m.id} className="relative flex gap-3.5 pb-6 last:pb-0">
            {i < list.length - 1 && <span className="absolute top-8 bottom-1 left-[15px] w-px bg-border" />}
            <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", TONE[meta.tone])}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium">{title}</p>
                <time className="text-xs text-muted-foreground tabular" title={formatDateTime(m.createdAt)}>
                  {formatDateTime(m.createdAt)}
                </time>
              </div>
              {m.note && <p className="mt-0.5 text-sm text-muted-foreground">{m.note}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {m.channel && <ChannelBadge channel={m.channel} />}
                <RefLink m={m} />
                {m.fromStatus && m.toStatus && m.fromStatus !== m.toStatus && (
                  <span className="inline-flex items-center gap-1">
                    <PackageOpen className="size-3" />
                    {m.fromStatus.toLowerCase()} → {m.toStatus.toLowerCase()}
                  </span>
                )}
                <span>by {m.actorName}</span>
                <span className="hidden sm:inline">· {formatRelative(m.createdAt)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
