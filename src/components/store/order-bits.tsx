"use client";

import { CheckCheck } from "lucide-react";
import { MediaImage } from "@/components/shared/media-image";
import { formatINR, formatTime } from "@/lib/format";
import type { TrackingView } from "@/services/storefront";

export function OrderLines({ view }: { view: TrackingView }) {
  const { order } = view;
  return (
    <div>
      <ul className="divide-y">
        {view.lines.map((l) => (
          <li key={l.orderItemId} className="flex gap-3 py-3.5">
            <MediaImage id={l.imageId} alt={l.designName} thumb rounded="rounded" className="w-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug font-medium">{l.designName}</p>
              <p className="text-xs text-muted-foreground">{[l.colourName, l.fabricName].filter(Boolean).join(" · ")}</p>
              {l.status !== "ACTIVE" && <p className="mt-1 text-xs font-medium text-primary">{l.status === "RETURNED" ? "Returned" : "Exchanged"}</p>}
            </div>
            <p className="text-sm font-medium tabular">{formatINR(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular">{formatINR(order.subtotal)}</span></div>
        {order.discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="tabular">-{formatINR(order.discount)}</span></div>}
        <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span className="tabular">{order.shippingFee ? formatINR(order.shippingFee) : "Free"}</span></div>
        <div className="flex justify-between pt-1 text-base font-semibold"><span>Total paid</span><span className="tabular">{formatINR(order.total)}</span></div>
      </div>
    </div>
  );
}

/** A simulated WhatsApp message as the customer would see it. */
export function WhatsAppBubble({ message, at }: { message: string; at: number }) {
  return (
    <div className="rounded-xl bg-[#e7ddd3] p-3">
      <div className="max-w-[92%] rounded-lg rounded-tl-none bg-white px-3 py-2 shadow-sm">
        <p className="text-[13px] leading-snug [overflow-wrap:anywhere] whitespace-pre-wrap text-[#111b21]">{message}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
          {formatTime(at)} <CheckCheck className="size-3.5 text-[#53bdeb]" />
        </p>
      </div>
    </div>
  );
}
