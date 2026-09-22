"use client";

import { useSearchParams } from "next/navigation";

/**
 * Reads a record id from the query string. Detail pages use `?id=` style URLs instead of
 * dynamic segments so the app can be exported as static files (GitHub Pages).
 * Callers must render inside <Suspense>.
 */
export function useQueryParam(name: string): string {
  return useSearchParams().get(name) ?? "";
}
