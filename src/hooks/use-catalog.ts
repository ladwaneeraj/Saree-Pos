"use client";

import { getCatalog } from "@/services/catalog";
import { getSettings } from "@/services/settings";
import { useLive } from "./use-live";

export function useCatalog() {
  return useLive(getCatalog, []).data;
}

export function useSettings() {
  return useLive(getSettings, []).data;
}
