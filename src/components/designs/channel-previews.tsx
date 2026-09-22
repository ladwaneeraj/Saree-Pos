import { CheckCheck, Globe, MessageCircle, ShoppingBag } from "lucide-react";
import type { Design } from "@/domain/types";
import { discountPercent } from "@/domain/rules/pricing";
import { formatINR } from "@/lib/format";
import { MediaImage } from "@/components/shared/media-image";

/** The same live price, shown as each channel presents it. */
export function ChannelPreviews({ design, imageId, available, fabricName }: { design: Design; imageId: string | null; available: number; fabricName: string }) {
  const off = discountPercent(design.mrp, design.price);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Channel icon={ShoppingBag} label="POS">
        <div className="flex gap-2.5 rounded-lg border bg-card p-2">
          <MediaImage id={imageId} alt={design.name} thumb className="w-12 shrink-0" rounded="rounded-md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{design.name}</div>
            <div className="text-[11px] text-muted-foreground">{available} in stock</div>
            <div className="mt-1 text-sm font-semibold tabular">{formatINR(design.price)}</div>
          </div>
        </div>
      </Channel>
      <Channel icon={Globe} label="Website">
        <div className="overflow-hidden rounded-lg border bg-card">
          <MediaImage id={imageId} alt={design.name} thumb aspect="aspect-[4/3]" rounded="rounded-none" />
          <div className="p-2">
            <div className="truncate font-display text-[15px] leading-tight">{design.name}</div>
            <div className="text-[11px] text-muted-foreground">{fabricName}</div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-sm font-semibold tabular">{formatINR(design.price)}</span>
              {off > 0 && (
                <>
                  <span className="text-[11px] text-muted-foreground line-through tabular">{formatINR(design.mrp)}</span>
                  <span className="text-[11px] font-medium text-success">{off}% off</span>
                </>
              )}
            </div>
          </div>
        </div>
      </Channel>
      <Channel icon={MessageCircle} label="WhatsApp">
        <div className="rounded-lg bg-[#e7ddd3] p-2">
          <div className="ml-auto max-w-[92%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm">
            <MediaImage id={imageId} alt={design.name} thumb aspect="aspect-[4/3]" rounded="rounded-none" />
            <div className="px-2 py-1.5 text-[12px] leading-snug text-[#111b21]">
              <div className="truncate font-semibold">{design.name}</div>
              <div className="tabular">{formatINR(design.price)}</div>
              <div className="flex items-center justify-end gap-0.5 text-[10px] text-[#667781]">
                now <CheckCheck className="size-3 text-[#53bdeb]" />
              </div>
            </div>
          </div>
        </div>
      </Channel>
    </div>
  );
}

function Channel({ icon: Icon, label, children }: { icon: typeof Globe; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </div>
      {children}
    </div>
  );
}
