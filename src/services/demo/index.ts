import { dataStore, repos } from "@/data";
import type { TableSnapshot } from "@/data/repositories";
import { assertPermission } from "@/domain/permissions";
import { recordAudit } from "../audit";
import { appOrigin, currentActor, now } from "../context";
import { clearMediaCache } from "../media";
import { generateDemoData } from "./seed";

export const SEED_VERSION = 1;
const EXPORT_FORMAT = "vasra-demo-export";

export type SeedProgress = (stage: string) => void;

async function writeSeed(onProgress?: SeedProgress): Promise<void> {
  onProgress?.("Weaving the demo catalogue");
  await new Promise((r) => setTimeout(r, 30));
  const tables = generateDemoData(now(), appOrigin());
  onProgress?.("Saving to this browser");
  await dataStore().importSnapshot(tables as unknown as TableSnapshot);
  await repos().meta.set("seededAt", now());
  await repos().meta.set("seedVersion", SEED_VERSION);
  clearMediaCache();
}

/** Seeds on first launch. Returns true when data was created. */
export async function ensureSeeded(onProgress?: SeedProgress): Promise<boolean> {
  const seededAt = await repos().meta.get<number>("seededAt");
  if (seededAt) return false;
  await writeSeed(onProgress);
  return true;
}

export async function getSeededAt(): Promise<number | null> {
  return (await repos().meta.get<number>("seededAt")) ?? null;
}

/** Clears IndexedDB and re-seeds relative to today. */
export async function resetDemoData(onProgress?: SeedProgress): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "demo:manage");
  await writeSeed(onProgress);
  await recordAudit({ action: "DEMO_RESET", entityType: "SYSTEM", entityId: "demo", entityLabel: "Demo data", summary: "Demo data reset and re-seeded", actor });
}

export async function exportDemoData(): Promise<string> {
  assertPermission(currentActor(), "demo:manage");
  const tables = await dataStore().exportSnapshot();
  return JSON.stringify({ format: EXPORT_FORMAT, version: SEED_VERSION, exportedAt: now(), tables });
}

export async function importDemoData(json: string): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "demo:manage");
  let parsed: { format?: string; tables?: TableSnapshot };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("This file is not valid JSON");
  }
  if (parsed.format !== EXPORT_FORMAT || !parsed.tables) throw new Error("This file is not a VASRA demo export");
  await dataStore().importSnapshot(parsed.tables);
  clearMediaCache();
  await recordAudit({ action: "DATA_IMPORTED", entityType: "SYSTEM", entityId: "demo", entityLabel: "Demo data", summary: "Demo data imported from file", actor });
}
