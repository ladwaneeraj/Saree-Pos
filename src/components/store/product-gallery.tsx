"use client";

import { useRef, useState } from "react";
import { MediaImage } from "@/components/shared/media-image";
import { cn } from "@/lib/utils";

/** Remount with a new `key` to reset to the first photo. Swipeable (scroll-snap) gallery on mobile, thumbnail rail + large image on desktop. */
export function ProductGallery({ imageIds, alt }: { imageIds: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const ids = imageIds.length ? imageIds : [null];

  const current = Math.min(index, ids.length - 1);

  return (
    <div>
      {/* Mobile: swipe */}
      <div className="relative -mx-4 sm:mx-0 md:hidden">
        <div
          ref={scroller}
          className="snap-gallery scrollbar-none flex overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {ids.map((id, i) => (
            <div key={`${id}-${i}`} className="w-full shrink-0">
              <MediaImage id={id} alt={`${alt}, photo ${i + 1}`} rounded="rounded-none sm:rounded-md" priority={i === 0} />
            </div>
          ))}
        </div>
        {ids.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {ids.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full bg-white/70 shadow transition-all", i === current ? "w-5 bg-white" : "w-1.5")} />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: thumbnails */}
      <div className={cn("hidden gap-4 md:grid", ids.length > 1 && "md:grid-cols-[72px_1fr]")}>
        {ids.length > 1 && (
        <div className="flex flex-col gap-3">
          {ids.map((id, i) => (
              <button
                key={`${id}-${i}`}
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => setIndex(i)}
                className={cn("overflow-hidden rounded-md ring-offset-2 transition", i === current ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100")}
                aria-label={`Show photo ${i + 1}`}
              >
                <MediaImage id={id} alt="" thumb rounded="rounded-md" />
              </button>
            ))}
        </div>
        )}
        <MediaImage id={ids[current]} alt={alt} rounded="rounded-md" priority />
      </div>
    </div>
  );
}
