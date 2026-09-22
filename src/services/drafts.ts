/**
 * Bulk photo entry drafts. Each row is one saree waiting to be saved to inventory. Drafts live
 * in the local database so an interrupted session (refresh, closed tab) loses nothing.
 */
import { repos, transaction } from "@/data";
import type { InventoryDraft, InventoryItem } from "@/domain/types";
import { assertPermission } from "@/domain/permissions";
import { newId } from "@/lib/id";
import { currentActor, now } from "./context";
import { createPiecesInTx, type NewPieceInput } from "./inventory";

export type DraftPatch = Partial<Omit<InventoryDraft, "id" | "createdAt" | "updatedAt">>;

export interface NewDraft {
  imageIds: string[];
  colourId?: string | null;
  colourAutoDetected?: boolean;
  values?: DraftPatch;
}

export function listDrafts(): Promise<InventoryDraft[]> {
  return repos().drafts.listOrdered();
}

/** Appends rows after the last draft. Returns the created drafts in order. */
export async function addDrafts(entries: NewDraft[]): Promise<InventoryDraft[]> {
  return transaction(async () => {
    const existing = await repos().drafts.listOrdered();
    let position = (existing.at(-1)?.position ?? 0) + 1;
    const t = now();
    const drafts: InventoryDraft[] = entries.map((e, i) => ({
      id: newId("drf"),
      position: position++,
      imageIds: e.imageIds,
      designId: null,
      designName: "",
      colourId: e.colourId ?? null,
      colourAutoDetected: e.colourAutoDetected ?? false,
      fabricId: null,
      collectionId: null,
      cost: null,
      mrp: null,
      price: null,
      location: "",
      ...e.values,
      createdAt: t + i,
      updatedAt: t + i,
    }));
    await repos().drafts.bulkAdd(drafts);
    return drafts;
  });
}

/** Applies the same patch to many drafts. */
export async function updateDrafts(ids: string[], patch: DraftPatch): Promise<void> {
  await transaction(async () => {
    const drafts = await repos().drafts.getMany(ids);
    const t = now();
    await repos().drafts.bulkPut(drafts.map((d) => ({ ...d, ...patch, updatedAt: t })));
  });
}

/** Writes whole draft rows (debounced autosave from the sheet). */
export async function saveDrafts(drafts: InventoryDraft[]): Promise<void> {
  if (drafts.length === 0) return;
  const t = now();
  await transaction(() => repos().drafts.bulkPut(drafts.map((d) => ({ ...d, updatedAt: t }))));
}

export async function deleteDrafts(ids: string[]): Promise<void> {
  await transaction(() => repos().drafts.bulkRemove(ids));
}

/** Renumbers drafts in the given order. */
export async function reorderDrafts(ids: string[]): Promise<void> {
  await transaction(async () => {
    const drafts = await repos().drafts.getMany(ids);
    const byId = new Map(drafts.map((d) => [d.id, d]));
    const t = now();
    await repos().drafts.bulkPut(ids.flatMap((id, i) => (byId.has(id) ? [{ ...byId.get(id)!, position: i + 1, updatedAt: t }] : [])));
  });
}

/**
 * Saves draft rows as inventory pieces and removes those drafts, atomically. Either every
 * piece gets a SKU and the drafts disappear, or nothing changes.
 */
export async function commitDrafts(draftIds: string[], inputs: NewPieceInput[]): Promise<InventoryItem[]> {
  assertPermission(currentActor(), "inventory:edit");
  return transaction(async () => {
    const items = await createPiecesInTx(inputs, { source: "BULK" });
    await repos().drafts.bulkRemove(draftIds);
    return items;
  });
}
