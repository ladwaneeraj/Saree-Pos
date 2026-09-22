"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAction } from "@/hooks/use-action";
import { posAddAnother, posAddBySku, posAddItem, posRemove } from "@/services/pos";
import type { InventoryItem } from "@/domain/types";
import { usePosDraft } from "./pos-store";

/** Cart mutations shared by the catalogue, scanner, cart and mobile sheet. */
export function usePosActions() {
  const markAdded = usePosDraft((s) => s.markAdded);
  const bySku = useAction(posAddBySku);
  const byId = useAction(posAddItem);
  const another = useAction(posAddAnother);
  const remove = useAction(posRemove);
  const { run: runSku } = bySku;
  const { run: runId } = byId;
  const { run: runAnother } = another;

  const added = useCallback(
    (item: InventoryItem | undefined) => {
      if (!item) return undefined;
      markAdded(item.id);
      toast.success(`${item.sku} added to the bill`, { duration: 1600 });
      return item;
    },
    [markAdded],
  );

  return {
    addBySku: useCallback(async (sku: string) => added(await runSku(sku)), [added, runSku]),
    addItem: useCallback(async (itemId: string) => added(await runId(itemId)), [added, runId]),
    addAnother: useCallback(async (designId: string, colourId: string) => added(await runAnother(designId, colourId)), [added, runAnother]),
    remove: remove.run,
    pending: bySku.pending || byId.pending || another.pending || remove.pending,
  };
}
