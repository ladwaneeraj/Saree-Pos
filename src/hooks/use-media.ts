"use client";

import { useEffect, useState } from "react";
import type { Media } from "@/domain/types";
import { getCachedMedia, getMediaMany } from "@/services/media";

/** Resolves media records for ids. Media is immutable, so a simple cache is safe. */
export function useMedia(ids: readonly (string | null | undefined)[]): Map<string, Media> {
  const key = ids.filter(Boolean).join(",");
  const [map, setMap] = useState<Map<string, Media>>(() => {
    const initial = new Map<string, Media>();
    for (const id of ids) {
      const m = id ? getCachedMedia(id) : undefined;
      if (m) initial.set(m.id, m);
    }
    return initial;
  });

  useEffect(() => {
    const wanted = key ? key.split(",") : [];
    if (wanted.length === 0) return;
    let active = true;
    getMediaMany(wanted).then((m) => active && setMap(m));
    return () => {
      active = false;
    };
  }, [key]);

  return map;
}
