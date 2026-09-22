import type { CustomerType, InventoryStatus, OrderStatus, PaymentStatus, ReturnStatus, SalesChannel } from "@/domain/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/domain/rules/orders";
import { CUSTOMER_TYPE_LABELS } from "@/domain/rules/customers";
import { cn } from "@/lib/utils";
import { Globe, MessageCircle, Store } from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "wine" | "gold";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-[oklch(0.5_0.12_65)] ring-warning/25",
  danger: "bg-danger-soft text-destructive ring-destructive/20",
  info: "bg-info-soft text-info ring-info/20",
  wine: "bg-wine-50 text-primary ring-primary/15",
  gold: "bg-[oklch(0.96_0.04_85)] text-gold-foreground ring-gold/30",
};

export function Pill({ tone = "neutral", children, className, dot = true }: { tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

const INVENTORY_TONE: Record<InventoryStatus, Tone> = { AVAILABLE: "success", RESERVED: "warning", SOLD: "neutral", DAMAGED: "danger", RETURNED: "info" };
const INVENTORY_LABEL: Record<InventoryStatus, string> = { AVAILABLE: "Available", RESERVED: "Reserved", SOLD: "Sold", DAMAGED: "Damaged", RETURNED: "Returned · QC" };

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  return <Pill tone={INVENTORY_TONE[status]}>{INVENTORY_LABEL[status]}</Pill>;
}

export const inventoryStatusLabel = (s: InventoryStatus) => INVENTORY_LABEL[s];

const ORDER_TONE: Record<OrderStatus, Tone> = {
  NEW: "info",
  PAYMENT_PENDING: "warning",
  CONFIRMED: "info",
  RESERVED: "wine",
  PACKING: "gold",
  READY_TO_DISPATCH: "gold",
  DISPATCHED: "info",
  IN_TRANSIT: "info",
  DELIVERED: "success",
  CANCELLED: "neutral",
  RETURN_REQUESTED: "danger",
  RETURNED: "neutral",
  REFUNDED: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Pill tone={ORDER_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Pill>;
}

const PAYMENT_TONE: Record<PaymentStatus, Tone> = { PENDING: "warning", PAID: "success", PARTIALLY_REFUNDED: "info", REFUNDED: "neutral" };

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Pill tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS_LABELS[status]}</Pill>;
}

const CHANNEL_META: Record<SalesChannel, { label: string; icon: typeof Store; className: string }> = {
  SHOP: { label: "Shop", icon: Store, className: "text-foreground" },
  WEBSITE: { label: "Website", icon: Globe, className: "text-info" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, className: "text-success" },
};

export function ChannelBadge({ channel, className }: { channel: SalesChannel; className?: string }) {
  const meta = CHANNEL_META[channel];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap", className)}>
      <Icon className={cn("size-3.5", meta.className)} />
      {meta.label}
    </span>
  );
}

const CUSTOMER_TONE: Record<CustomerType, Tone> = { NEW: "info", REPEAT: "success", HIGH_VALUE: "gold", INACTIVE: "neutral" };

export function CustomerTypeBadge({ type }: { type: CustomerType }) {
  return <Pill tone={CUSTOMER_TONE[type]}>{CUSTOMER_TYPE_LABELS[type]}</Pill>;
}

const RETURN_TONE: Record<ReturnStatus, Tone> = { REQUESTED: "danger", APPROVED: "warning", REJECTED: "neutral", RECEIVED: "info", QC_COMPLETED: "gold", REFUNDED: "success", EXCHANGED: "success" };
const RETURN_LABEL: Record<ReturnStatus, string> = { REQUESTED: "Requested", APPROVED: "Awaiting parcel", REJECTED: "Rejected", RECEIVED: "Received · QC", QC_COMPLETED: "Quality checked", REFUNDED: "Refunded", EXCHANGED: "Exchanged" };

export function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  return <Pill tone={RETURN_TONE[status]}>{RETURN_LABEL[status]}</Pill>;
}
