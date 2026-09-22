import { repos, transaction } from "@/data";
import type { AppSettings, SettingsKey } from "@/domain/types";
import { assertPermission } from "@/domain/permissions";
import { DEFAULT_SETTINGS } from "./settings-defaults";
import { recordAudit } from "./audit";
import { currentActor } from "./context";

const KEYS = Object.keys(DEFAULT_SETTINGS) as SettingsKey[];

/** Stored settings merged over defaults, so newly added settings always have a value. */
export async function getSettings(): Promise<AppSettings> {
  const values = await Promise.all(KEYS.map((k) => repos().settings.get(k)));
  const result = { ...DEFAULT_SETTINGS } as Record<SettingsKey, unknown>;
  KEYS.forEach((key, i) => {
    const stored = values[i];
    if (stored === undefined) return;
    const fallback = DEFAULT_SETTINGS[key];
    result[key] = Array.isArray(fallback) ? stored : { ...fallback, ...(stored as object) };
  });
  return result as unknown as AppSettings;
}

export async function getSetting<K extends SettingsKey>(key: K): Promise<AppSettings[K]> {
  return (await getSettings())[key];
}

const SECTION_LABELS: Record<SettingsKey, string> = {
  business: "Business profile",
  store: "Store settings",
  tax: "Tax / GST settings",
  shipping: "Shipping settings",
  notifications: "Notification settings",
  labels: "Label settings",
  users: "Users & roles",
};

export async function updateSettings<K extends SettingsKey>(key: K, value: AppSettings[K]): Promise<void> {
  const actor = currentActor();
  assertPermission(actor, "settings:manage");
  await transaction(async () => {
    await repos().settings.set(key, value);
    await recordAudit({
      action: "SETTINGS_CHANGED",
      entityType: "SETTINGS",
      entityId: `settings:${key}`,
      entityLabel: SECTION_LABELS[key],
      summary: `${SECTION_LABELS[key]} updated`,
      actor,
    });
  });
}
