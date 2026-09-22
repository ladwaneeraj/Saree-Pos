"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PHOTOS, unsplashUrl, type PhotoKey } from "@/services/demo/stock-photos";

/**
 * Editorial storefront photo (hero, story). Falls back to a woven wine-and-gold texture when
 * the photo cannot load, so the layout never shows a broken image.
 */
export function StockImage({ photo, alt, width = 1600, className, imgClassName }: { photo: PhotoKey; alt: string; width?: number; className?: string; imgClassName?: string }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        backgroundColor: "oklch(0.32 0.09 12)",
        backgroundImage:
          "radial-gradient(120% 80% at 80% 10%, oklch(0.74 0.115 78 / 0.35), transparent 60%), repeating-linear-gradient(135deg, oklch(1 0 0 / 0.04) 0 2px, transparent 2px 9px), repeating-linear-gradient(45deg, oklch(0.74 0.115 78 / 0.07) 0 1px, transparent 1px 11px)",
      }}
    >
      {state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={unsplashUrl(PHOTOS[photo], { w: width })}
          alt={alt}
          onLoad={() => setState("ok")}
          onError={() => setState("failed")}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-700", state === "ok" ? "opacity-100" : "opacity-0", imgClassName)}
        />
      )}
    </div>
  );
}
