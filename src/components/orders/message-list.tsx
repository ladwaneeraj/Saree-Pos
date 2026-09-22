import { CheckCheck, ExternalLink, MessageCircle } from "lucide-react";
import type { Notification, NotificationEvent } from "@/domain/types";
import { formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  ORDER_CONFIRMED: "Order confirmed",
  PAYMENT_REQUEST: "Payment request",
  PAYMENT_RECEIVED: "Payment received",
  ORDER_PACKED: "Packed",
  ORDER_DISPATCHED: "Dispatched",
  ORDER_DELIVERED: "Delivered",
  REVIEW_REQUEST: "Review request",
  BACK_IN_STOCK: "Back in stock",
  RETURN_UPDATE: "Return update",
  ORDER_CANCELLED: "Cancelled",
};

const CHANNEL_WORD = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" } as const;

/** Customer messages rendered as outgoing chat bubbles, oldest first. */
export function MessageList({ notifications, emptyText = "No messages have been sent yet." }: { notifications: Notification[]; emptyText?: string }) {
  if (notifications.length === 0) return <EmptyState icon={MessageCircle} title="No messages" description={emptyText} className="py-8" />;
  const list = [...notifications].sort((a, b) => a.createdAt - b.createdAt);
  return (
    <div className="space-y-3 rounded-lg bg-[oklch(0.965_0.012_95)] p-3 sm:p-4">
      {list.map((n) => (
        <div key={n.id} className="flex justify-end">
          <div className="max-w-[92%] sm:max-w-[80%]">
            <div className="mb-1 text-right text-[11px] font-medium text-muted-foreground">
              {NOTIFICATION_EVENT_LABELS[n.event]} · {CHANNEL_WORD[n.channel]}
            </div>
            <div className="rounded-2xl rounded-tr-sm bg-[oklch(0.94_0.06_145)] px-3 py-2 text-sm leading-relaxed text-[oklch(0.25_0.03_150)] shadow-xs">
              <p className="break-words whitespace-pre-wrap">{n.message}</p>
              {n.ctaLabel && n.ctaUrl && (
                <a href={n.ctaUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1.5 border-t border-black/10 pt-2 text-[13px] font-medium text-info">
                  <ExternalLink className="size-3.5" />
                  {n.ctaLabel}
                </a>
              )}
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-black/45">
                {formatDateTime(n.createdAt)}
                <CheckCheck className="size-3.5 text-info" />
              </div>
            </div>
          </div>
        </div>
      ))}
      <p className="text-center text-[11px] text-muted-foreground">Demo mode: messages are simulated, nothing is sent.</p>
    </div>
  );
}
