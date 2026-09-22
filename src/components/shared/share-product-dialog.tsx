"use client";

import { Link2, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyText } from "@/lib/files";
import { productUrl } from "@/services/notifications";
import { formatShareMessage } from "@/services/storefront";
import { MediaImage } from "./media-image";
import { CopyButton } from "./misc";

export interface ShareProduct {
  name: string;
  slug: string;
  price: number;
  description: string;
  available: number;
  imageId: string | null;
}

/** Share a product on WhatsApp, by link, or through the device share sheet. */
export function ShareProductDialog({ product, open, onOpenChange }: { product: ShareProduct | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!product) return null;
  const url = productUrl(product.slug);
  const message = formatShareMessage({ name: product.name, price: product.price, description: product.description, available: product.available, url });
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator && window.isSecureContext;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share product</DialogTitle>
          <DialogDescription>Price and availability are read live from inventory.</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-[#e7ddd3] p-3">
          <div className="ml-auto max-w-[85%] overflow-hidden rounded-lg rounded-tr-none bg-[#d9fdd3] shadow-sm">
            <MediaImage id={product.imageId} alt={product.name} thumb rounded="rounded-none" aspect="aspect-[4/3]" />
            <pre className="p-2.5 font-sans text-[13px] leading-snug whitespace-pre-wrap text-[#111b21]">{message.replace(/\*/g, "")}</pre>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button asChild className="bg-[#1faa53] text-white hover:bg-[#1a9549]">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle /> WhatsApp
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await copyText(url);
              toast.success("Product link copied");
            }}
          >
            <Link2 /> Copy link
          </Button>
          <Button
            variant="outline"
            disabled={!canNativeShare}
            onClick={() => navigator.share({ title: product.name, text: message, url }).catch(() => undefined)}
          >
            <Share2 /> Share
          </Button>
        </div>
        <CopyButton text={message} label="Copy message" className="w-full" />
      </DialogContent>
    </Dialog>
  );
}
