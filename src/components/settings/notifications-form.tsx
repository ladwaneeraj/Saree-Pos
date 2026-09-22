"use client";

import { MessageCircle, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NOTIFICATION_EVENTS, type NotificationEvent } from "@/domain/types";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listRecentNotifications, renderTemplate } from "@/services/notifications";
import { DEFAULT_TEMPLATES } from "@/services/settings-defaults";
import { SaveFooter, SettingsCard, useSettingsForm } from "./settings-kit";

export const EVENT_LABELS: Record<NotificationEvent, { label: string; hint: string }> = {
  ORDER_CONFIRMED: { label: "Order confirmed", hint: "When an order is placed and paid" },
  PAYMENT_REQUEST: { label: "Payment request", hint: "WhatsApp orders awaiting payment" },
  PAYMENT_RECEIVED: { label: "Payment received", hint: "When payment is confirmed" },
  ORDER_PACKED: { label: "Order packed", hint: "When packing is complete" },
  ORDER_DISPATCHED: { label: "Order dispatched", hint: "With courier and AWB" },
  ORDER_DELIVERED: { label: "Order delivered", hint: "When the courier confirms delivery" },
  REVIEW_REQUEST: { label: "Review request", hint: "A few days after delivery" },
  BACK_IN_STOCK: { label: "Back in stock", hint: "Wishlisted saree available again" },
  RETURN_UPDATE: { label: "Return update", hint: "Return or exchange status changes" },
  ORDER_CANCELLED: { label: "Order cancelled", hint: "With refund note" },
};

const VARIABLES = ["name", "order", "courier", "awb", "trackingLink", "total", "amount", "design", "price", "paymentLink", "store"] as const;

const SAMPLE: Record<string, string> = {
  name: "Lakshmi",
  store: "Dhanvi Silks",
  order: "#11852",
  total: "₹14,999",
  amount: "₹14,999",
  courier: "DTDC",
  awb: "D41820937561",
  trackingLink: "dhanvisilks.in/track?id=ord_11852",
  paymentLink: "upi://pay?pa=dhanvisilks@hdfc",
  dueTime: "11:30 AM tomorrow",
  reviewLink: "dhanvisilks.in/track?id=ord_11852#review",
  design: "Kanchipuram Bridal Zari Silk",
  price: "₹38,999",
  productLink: "dhanvisilks.in/store/p?slug=kanchipuram-bridal-zari-silk",
  returnNumber: "RET-0042",
  returnStatus: "Approved. Our courier will pick it up tomorrow.",
  refundNote: "Your refund of ₹14,999 will reach your account in 5 to 7 working days.",
};

const schema = z.object({
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"]),
  enabled: z.record(z.enum(NOTIFICATION_EVENTS), z.boolean()),
  templates: z.record(z.enum(NOTIFICATION_EVENTS), z.string().trim().min(10, "Template is too short").max(600, "Keep it under 600 characters")),
});

export function NotificationsForm() {
  const { form, onSubmit, pending } = useSettingsForm("notifications", schema);
  const settings = useSettings();
  const [active, setActive] = useState<NotificationEvent>("ORDER_DISPATCHED");
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const enabled = form.watch("enabled") ?? {};
  const template = form.watch(`templates.${active}`) ?? "";
  const channel = form.watch("channel");

  const insert = (variable: string) => {
    const el = textRef.current;
    const token = `{${variable}}`;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    form.setValue(`templates.${active}`, template.slice(0, start) + token + template.slice(end), { shouldDirty: true, shouldValidate: true });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="space-y-5">
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <SettingsCard title="Customer notifications" description="Messages are simulated in this demo: nothing is sent, every message appears in the outbox below and on the customer's tracking page." footer={<SaveFooter form={form} pending={pending} />}>
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem className="mb-5 max-w-xs">
                  <FormLabel>Send through</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="WHATSAPP">WhatsApp Business</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <ul className="space-y-1">
                {NOTIFICATION_EVENTS.map((e) => (
                  <li key={e}>
                    <div className={cn("flex items-center gap-3 rounded-lg px-3 py-2", active === e ? "bg-wine-50 ring-1 ring-primary/15" : "hover:bg-muted/60")}>
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActive(e)}>
                        <div className={cn("text-sm font-medium", !enabled[e] && "text-muted-foreground")}>{EVENT_LABELS[e].label}</div>
                        <div className="truncate text-xs text-muted-foreground">{EVENT_LABELS[e].hint}</div>
                      </button>
                      <Switch checked={!!enabled[e]} aria-label={`Send ${EVENT_LABELS[e].label}`} onCheckedChange={(on) => form.setValue(`enabled.${e}`, on, { shouldDirty: true })} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="min-w-0 space-y-4">
                <FormField
                  control={form.control}
                  name={`templates.${active}`}
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>{EVENT_LABELS[active].label} message</FormLabel>
                        <Button type="button" variant="ghost" size="xs" onClick={() => form.setValue(`templates.${active}`, DEFAULT_TEMPLATES[active], { shouldDirty: true, shouldValidate: true })}>
                          <RotateCcw /> Default
                        </Button>
                      </div>
                      <FormControl>
                        <Textarea {...field} value={field.value ?? ""} ref={(el) => { field.ref(el); textRef.current = el; }} rows={4} className="font-mono text-[13px]" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div>
                  <div className="mb-1.5 text-xs text-muted-foreground">Insert a variable</div>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((v) => (
                      <button key={v} type="button" onClick={() => insert(v)} className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs hover:border-primary/40 hover:bg-wine-50">
                        {`{${v}}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs text-muted-foreground">Live preview with sample order</div>
                  <div className="rounded-xl bg-[oklch(0.94_0.02_150)] p-4">
                    <div className="max-w-md rounded-lg rounded-tl-none bg-card px-3 py-2 text-sm shadow-xs">
                      <div className="mb-1 text-xs font-semibold text-success">{settings?.business.name ?? "Dhanvi Silks"}</div>
                      <p className="break-words whitespace-pre-wrap">{renderTemplate(template, SAMPLE)}</p>
                      <div className="mt-1 text-right text-[10px] text-muted-foreground">{channel === "WHATSAPP" ? "WhatsApp" : channel === "SMS" ? "SMS" : "Email"} · 11:42 AM</div>
                    </div>
                  </div>
                  {!enabled[active] && <p className="mt-2 text-xs text-muted-foreground">This message is switched off and will not be sent.</p>}
                </div>
              </div>
            </div>
          </SettingsCard>
        </form>
      </Form>
      <Outbox />
    </div>
  );
}

function Outbox() {
  const { data } = useLive(() => listRecentNotifications(25), []);
  return (
    <SettingsCard title="Outbox" description="The most recent simulated customer messages.">
      {!data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No messages yet. Place an order or dispatch a parcel to see one here.</p>
      ) : (
        <ul className="divide-y">
          {data.map((n) => (
            <li key={n.id} className="flex gap-3 py-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success"><MessageCircle className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-sm font-medium">{n.recipientName} <span className="font-normal text-muted-foreground">· {n.recipient}</span></span>
                  <span className="text-xs text-muted-foreground" title={formatDateTime(n.createdAt)}>{EVENT_LABELS[n.event].label} · {formatRelative(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{n.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}
