"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

/** Opens the label print page for pieces. Labels carry SKU barcodes only, never prices. */
export function usePrintLabels() {
  const router = useRouter();
  return useCallback(
    (input: { skus?: string[]; purchaseId?: string }) => {
      const params = new URLSearchParams();
      if (input.skus?.length) params.set("skus", input.skus.join(","));
      if (input.purchaseId) params.set("purchase", input.purchaseId);
      router.push(`/labels?${params.toString()}`);
    },
    [router],
  );
}
