"use client";

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { useMedia } from "@/hooks/use-media";
import { cn } from "@/lib/utils";

interface MediaImageProps {
  id: string | null | undefined;
  alt: string;
  className?: string;
  /** Use the small version (tables, grids). */
  thumb?: boolean;
  /** Aspect ratio class; defaults to the 4:5 product ratio. */
  aspect?: string;
  rounded?: string;
  priority?: boolean;
}

/** Renders an image from the shared media store with a quiet placeholder while loading or on failure. */
export function MediaImage({ id, alt, className, thumb = false, aspect = "aspect-[4/5]", rounded = "rounded-lg", priority }: MediaImageProps) {
  const media = useMedia([id]);
  const record = id ? media.get(id) : undefined;
  const [failedId, setFailedId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const src = record ? (thumb ? record.thumbUrl : record.url) : null;
  const failed = failedId === id;

  return (
    <div className={cn("relative overflow-hidden bg-muted", aspect, rounded, className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoadedId(id ?? null)}
          onError={() => setFailedId(id ?? null)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", loadedId === id ? "opacity-100" : "opacity-0")}
        />
      ) : null}
      {(!src || failed || loadedId !== id) && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
          <ImageIcon className="size-5" />
        </div>
      )}
    </div>
  );
}
