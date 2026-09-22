"use client";

import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, Trash2, ZoomIn } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { errorMessage } from "@/domain/errors";
import { processImageFile, saveMedia, type ProcessedImage } from "@/services/media";
import { cn } from "@/lib/utils";
import { MediaImage } from "./media-image";

/** Resizes and stores photos in the shared media table. Returns the processed images in order. */
export async function uploadPhotos(files: File[]): Promise<ProcessedImage[]> {
  const images = files.filter((f) => f.type.startsWith("image/"));
  const processed: ProcessedImage[] = [];
  for (const file of images) processed.push(await processImageFile(file));
  await saveMedia(processed.map((p) => p.media));
  return processed;
}

export function PhotoDropzone({ onFiles, busy, compact, label = "Drop saree photos here", className }: { onFiles: (files: File[]) => void; busy?: boolean; compact?: boolean; label?: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = [...e.dataTransfer.files];
        if (files.length) onFiles(files);
      }}
      onClick={() => input.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition-colors",
        compact ? "aspect-[4/5] p-2" : "px-6 py-10",
        over ? "border-primary bg-wine-50" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/60",
        className,
      )}
    >
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      {busy ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <ImagePlus className={cn("text-muted-foreground", compact ? "size-5" : "size-7")} />}
      {!compact && (
        <>
          <p className="text-sm font-medium">{busy ? "Processing photos…" : label}</p>
          <p className="text-xs text-muted-foreground">or click to browse · JPG, PNG, WebP · resized in your browser</p>
        </>
      )}
      {compact && <span className="text-xs text-muted-foreground">Add</span>}
    </div>
  );
}

interface ImageManagerProps {
  imageIds: string[];
  onChange: (ids: string[]) => void | Promise<void>;
  disabled?: boolean;
  emptyHint?: string;
}

/** Photo gallery editor: upload, drag to reorder, set primary, delete, preview. First image is primary. */
export function ImageManager({ imageIds, onChange, disabled, emptyHint }: ImageManagerProps) {
  const [busy, setBusy] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [preview, setPreview] = useState<number | null>(null);

  const add = async (files: File[]) => {
    setBusy(true);
    try {
      const processed = await uploadPhotos(files);
      await onChange([...imageIds, ...processed.map((p) => p.media.id)]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...imageIds];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    void onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {imageIds.map((id, i) => (
          <div
            key={id}
            draggable={!disabled}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn("group relative", dragIndex === i && "opacity-40")}
          >
            <MediaImage id={id} alt={`Photo ${i + 1}`} thumb />
            {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">Primary</span>}
            <div className="absolute inset-x-1.5 bottom-1.5 flex justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100">
              <Button type="button" size="icon-xs" variant="secondary" onClick={() => setPreview(i)} aria-label="Preview">
                <ZoomIn />
              </Button>
              {!disabled && i > 0 && (
                <Button type="button" size="icon-xs" variant="secondary" onClick={() => move(i, 0)} aria-label="Make primary">
                  <Star />
                </Button>
              )}
              {!disabled && (
                <Button type="button" size="icon-xs" variant="secondary" onClick={() => void onChange(imageIds.filter((x) => x !== id))} aria-label="Delete photo">
                  <Trash2 />
                </Button>
              )}
            </div>
          </div>
        ))}
        {!disabled && <PhotoDropzone compact busy={busy} onFiles={add} />}
      </div>
      <p className="text-xs text-muted-foreground">{imageIds.length === 0 && emptyHint ? emptyHint : "Drag to reorder. The first photo is used on the website, POS and WhatsApp."}</p>
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl p-2 sm:max-w-2xl">
          <DialogTitle className="sr-only">Photo preview</DialogTitle>
          {preview !== null && (
            <div className="relative">
              <MediaImage id={imageIds[preview]} alt="Preview" rounded="rounded-md" />
              {imageIds.length > 1 && (
                <>
                  <Button type="button" size="icon" variant="secondary" className="absolute top-1/2 left-2 -translate-y-1/2" onClick={() => setPreview((preview - 1 + imageIds.length) % imageIds.length)}>
                    <ChevronLeft />
                  </Button>
                  <Button type="button" size="icon" variant="secondary" className="absolute top-1/2 right-2 -translate-y-1/2" onClick={() => setPreview((preview + 1) % imageIds.length)}>
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
