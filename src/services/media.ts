import { repos, transaction } from "@/data";
import type { Colour, Media } from "@/domain/types";
import { newId } from "@/lib/id";
import { now } from "./context";

export interface ProcessedImage {
  media: Media;
  /** Average colour of the centre of the photo, used to pre-fill the colour field. */
  dominantHex: string;
}

const MAX_EDGE = 1200;
const THUMB_EDGE = 360;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not a readable image"));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function averageCentreColour(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d")!;
  const w = Math.max(1, Math.floor(canvas.width * 0.5));
  const h = Math.max(1, Math.floor(canvas.height * 0.5));
  const data = ctx.getImageData(Math.floor(canvas.width * 0.25), Math.floor(canvas.height * 0.25), w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 16) {
    const [pr, pg, pb] = [data[i]!, data[i + 1]!, data[i + 2]!];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    // Skip near-white and near-grey background pixels so the fabric colour dominates.
    if (max > 235 && min > 225) continue;
    r += pr; g += pg; b += pb; n++;
  }
  if (n === 0) return "#f7f5f0";
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Resizes an uploaded photo in the browser. Runs outside any transaction (it awaits image decoding). */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image`);
  const img = await loadImage(file);
  const full = draw(img, MAX_EDGE);
  const thumb = draw(img, THUMB_EDGE);
  return {
    media: {
      id: newId("med"),
      kind: "UPLOAD",
      mime: "image/jpeg",
      url: full.toDataURL("image/jpeg", 0.84),
      thumbUrl: thumb.toDataURL("image/jpeg", 0.8),
      width: full.width,
      height: full.height,
      credit: null,
      createdAt: now(),
    },
    dominantHex: averageCentreColour(thumb),
  };
}

export async function saveMedia(media: Media[]): Promise<void> {
  await transaction(() => repos().media.bulkAdd(media));
}

const cache = new Map<string, Media>();

/** Media records are immutable once written, so they are cached for the page lifetime. */
export async function getMediaMany(ids: string[]): Promise<Map<string, Media>> {
  const missing = ids.filter((id) => !cache.has(id));
  if (missing.length) for (const m of await repos().media.getMany([...new Set(missing)])) cache.set(m.id, m);
  return new Map(ids.flatMap((id) => (cache.has(id) ? [[id, cache.get(id)!] as const] : [])));
}

export function getCachedMedia(id: string): Media | undefined {
  return cache.get(id);
}

export function clearMediaCache(): void {
  cache.clear();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Closest named colour by perceptual-ish distance (weighted RGB). */
export function nearestColour(hex: string, colours: Colour[]): Colour | undefined {
  const [r1, g1, b1] = hexToRgb(hex);
  let best: Colour | undefined;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of colours) {
    const [r2, g2, b2] = hexToRgb(c.hex);
    const rm = (r1 + r2) / 2;
    const d = (2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
