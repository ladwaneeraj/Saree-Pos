"use client";

import { CheckCheck, ExternalLink, IndianRupee, Info, ReceiptText } from "lucide-react";
import Link from "next/link";
import type { Order, WaMessage } from "@/domain/types";
import { formatINR, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WaProductCard } from "@/services/whatsapp";
import { MediaImage } from "@/components/shared/media-image";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/status-badge";

function Meta({ at, out, className }: { at: number; out: boolean; className?: string }) {
  return (
    <span className={cn("ml-2 inline-flex translate-y-1 items-center gap-0.5 float-right text-[11px] text-[#667781]", className)}>
      {formatTime(at).toLowerCase()}
      {out && <CheckCheck className="size-3.5 text-[#53bdeb]" />}
    </span>
  );
}

function Bubble({ out, children, className, tail = true }: { out: boolean; children: React.ReactNode; className?: string; tail?: boolean }) {
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative max-w-[82%] rounded-lg px-2 py-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[65%]",
          out ? "bg-[#d9fdd3]" : "bg-white",
          tail && (out ? "rounded-tr-none" : "rounded-tl-none"),
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Renders *bold* the way WhatsApp does. */
function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function MessageBubble({ message, product, order }: { message: WaMessage; product?: WaProductCard; order?: Order }) {
  const out = message.direction === "OUT";

  if (message.kind === "SYSTEM") {
    return (
      <div className="flex justify-center py-1">
        <div className="inline-flex max-w-[85%] items-center gap-1.5 rounded-lg bg-[#fff5c4] px-3 py-1.5 text-center text-[12.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
          <Info className="size-3.5 shrink-0" />
          <span>{message.text}</span>
          <span className="ml-1 text-[11px] text-[#8696a0]">{formatTime(message.createdAt).toLowerCase()}</span>
        </div>
      </div>
    );
  }

  if (message.kind === "PRODUCT" && product) {
    const lines = message.text.split("\n");
    const description = lines.slice(2, -2).join(" ");
    return (
      <Bubble out={out} className="w-[300px] max-w-[85%] p-1">
        <MediaImage id={product.imageId} alt={product.name} thumb rounded="rounded-md" aspect="aspect-[4/3]" />
        <div className="px-1.5 pt-2 pb-1">
          <div className="font-semibold">{product.name}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-semibold text-[#008069] tabular">{formatINR(product.price)}</span>
            <span className={cn("text-xs", product.available ? "text-[#667781]" : "text-destructive")}>
              {product.available === 0 ? "Currently sold out" : product.available === 1 ? "Only 1 piece left" : `${product.available} pieces available`}
            </span>
          </div>
          {description && <p className="mt-1 line-clamp-2 text-[13px] text-[#54656f]">{description}</p>}
          <Meta at={message.createdAt} out={out} />
        </div>
        <Link href={`/store/p?slug=${product.slug}`} target="_blank" className="mt-1 flex items-center justify-center gap-1.5 border-t border-black/5 py-2 text-[14px] font-medium text-[#008069] hover:bg-black/[0.03]">
          <ExternalLink className="size-4" /> View product
        </Link>
      </Bubble>
    );
  }

  if ((message.kind === "ORDER" || message.kind === "PAYMENT_REQUEST") && order) {
    const isPay = message.kind === "PAYMENT_REQUEST";
    const link = message.text.match(/upi:\/\/\S+/)?.[0];
    return (
      <Bubble out={out} className="w-[300px] max-w-[85%] p-1">
        <div className={cn("flex items-center gap-3 rounded-md p-3", isPay ? "bg-[#c8f1c0]" : "bg-[#cfe9c9]/60")}>
          <span className="flex size-10 items-center justify-center rounded-full bg-white/70 text-[#008069]">
            {isPay ? <IndianRupee className="size-5" /> : <ReceiptText className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-[#54656f]">{isPay ? "Payment request" : "Order"} · #{order.number}</div>
            <div className="text-lg font-semibold tabular">{formatINR(message.amount ?? order.total)}</div>
          </div>
        </div>
        <div className="px-1.5 pt-1.5 pb-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {isPay ? <PaymentStatusBadge status={order.paymentStatus} /> : <OrderStatusBadge status={order.status} />}
            <span className="text-xs text-[#667781]">{order.itemCount} saree{order.itemCount === 1 ? "" : "s"} · {order.fulfilment === "SHIPPING" ? "Delivery" : "Store pickup"}</span>
          </div>
          {isPay && link && <div className="mt-1.5 truncate font-mono text-[11px] text-[#027eb5]" title={link}>{link}</div>}
          <Meta at={message.createdAt} out={out} />
        </div>
        {isPay && (
          <div className="mt-1 flex items-center justify-center gap-1.5 border-t border-black/5 py-2 text-[14px] font-medium text-[#008069]">
            <IndianRupee className="size-4" /> {order.paymentStatus === "PENDING" ? "Pay now with UPI" : "Paid, thank you"}
          </div>
        )}
      </Bubble>
    );
  }

  return (
    <Bubble out={out}>
      <span className="break-words whitespace-pre-wrap"><WaText text={message.text} /></span>
      <Meta at={message.createdAt} out={out} />
    </Bubble>
  );
}
