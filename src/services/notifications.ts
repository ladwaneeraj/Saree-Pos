import { repos } from "@/data";
import type { Customer, Design, Notification, NotificationEvent, Order } from "@/domain/types";
import { newId } from "@/lib/id";
import { formatINR } from "@/lib/format";
import { appOrigin, now } from "./context";
import { getSettings } from "./settings";

export interface NotifyContext {
  order?: Order;
  customer?: Pick<Customer, "id" | "name" | "phone"> | null;
  design?: Design;
  ownerId?: string | null;
  vars?: Record<string, string>;
}

const CTA: Partial<Record<NotificationEvent, string>> = {
  ORDER_CONFIRMED: "Track order",
  ORDER_DISPATCHED: "Track shipment",
  ORDER_DELIVERED: "View order",
  REVIEW_REQUEST: "Rate your saree",
  BACK_IN_STOCK: "View saree",
  PAYMENT_REQUEST: "Pay now",
};

export function trackingUrl(orderId: string): string {
  return `${appOrigin()}/track?id=${orderId}`;
}

export function productUrl(slug: string): string {
  return `${appOrigin()}/store/p?slug=${slug}`;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match).replace(/\s+/g, " ").trim();
}

function ctaUrl(event: NotificationEvent, ctx: NotifyContext, vars: Record<string, string>): string | null {
  if (event === "BACK_IN_STOCK" && ctx.design) return productUrl(ctx.design.slug);
  if (event === "PAYMENT_REQUEST") return vars.paymentLink ?? null;
  if (event === "REVIEW_REQUEST" && ctx.order) return `${trackingUrl(ctx.order.id)}#review`;
  if (ctx.order && CTA[event]) return trackingUrl(ctx.order.id);
  return null;
}

/**
 * Records a simulated customer message. Nothing leaves the browser; the outbox is shown in
 * the admin and on the customer's tracking page. A real WhatsApp/SMS provider would consume
 * these records from a queue.
 */
export async function notify(event: NotificationEvent, ctx: NotifyContext): Promise<Notification | null> {
  const settings = await getSettings();
  if (!settings.notifications.enabled[event]) return null;

  const customerName = ctx.customer?.name ?? ctx.order?.customer.name ?? "";
  const phone = ctx.customer?.phone ?? ctx.order?.customer.phone ?? "";
  const vars: Record<string, string> = {
    name: customerName.split(" ")[0] || "there",
    store: settings.business.name,
    ...(ctx.order && {
      order: `#${ctx.order.number}`,
      total: formatINR(ctx.order.total),
      amount: formatINR(ctx.order.total),
      trackingLink: trackingUrl(ctx.order.id),
      reviewLink: `${trackingUrl(ctx.order.id)}#review`,
    }),
    ...(ctx.design && {
      design: ctx.design.name,
      price: formatINR(ctx.design.price),
      productLink: productUrl(ctx.design.slug),
    }),
    ...ctx.vars,
  };

  const notification: Notification = {
    id: newId("ntf"),
    event,
    channel: settings.notifications.channel,
    recipient: phone || "Saved on shopper's device",
    recipientName: customerName || "Website shopper",
    message: renderTemplate(settings.notifications.templates[event], vars),
    ctaLabel: CTA[event] ?? null,
    ctaUrl: ctaUrl(event, ctx, vars),
    customerId: ctx.customer?.id ?? ctx.order?.customerId ?? null,
    ownerId: ctx.ownerId ?? null,
    orderId: ctx.order?.id ?? null,
    designId: ctx.design?.id ?? null,
    status: "SIMULATED",
    createdAt: now(),
  };
  await repos().notifications.add(notification);
  return notification;
}

export function listRecentNotifications(limit = 200) {
  return repos().notifications.listRecent(limit);
}
