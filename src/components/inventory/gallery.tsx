"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/shared/media-image";

/** Main photo with a thumbnail strip. */
export function Gallery({ imageIds, alt, className }: { imageIds: string[]; alt: string; className?: string }) {
  const [index, setIndex] = useState(0);
  const active = imageIds[Math.min(index, imageIds.length - 1)] ?? null;
  if (imageIds.length === 0) {
    return (
      <div className={cn("flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 text-sm text-muted-foreground", className)}>
        <ImageIcon className="size-6" />
        No photos yet
      </div>
    );
  }
  return (
    <div className={cn("space-y-2", className)}>
      <MediaImage id={active} alt={alt} rounded="rounded-xl" priority />
      {imageIds.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {imageIds.slice(0, 10).map((id, i) => (
            <button
              key={id}
              type="button"
              onClick={() => setIndex(i)}
              className={cn("overflow-hidden rounded-md ring-2 ring-offset-1 ring-offset-card transition", i === index ? "ring-primary" : "ring-transparent hover:ring-border")}
              aria-label={`Show photo ${i + 1}`}
            >
              <MediaImage id={id} alt={`${alt} photo ${i + 1}`} thumb rounded="rounded-md" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
