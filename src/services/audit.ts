import { repos } from "@/data";
import type { Actor, AuditLog } from "@/domain/types";
import { newId } from "@/lib/id";
import { currentActor, now } from "./context";

export interface AuditInput {
  action: AuditLog["action"];
  entityType: AuditLog["entityType"];
  entityId: string;
  entityLabel: string;
  summary: string;
  before?: string | null;
  after?: string | null;
  actor?: Actor;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  const actor = input.actor ?? currentActor();
  await repos().audit.add({
    id: newId("aud"),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    summary: input.summary,
    before: input.before ?? null,
    after: input.after ?? null,
    actorName: actor.name,
    actorRole: actor.role,
    createdAt: now(),
  });
}

export function listRecentAudit(limit = 500) {
  return repos().audit.listRecent(limit);
}

export function listAuditForEntity(entityId: string) {
  return repos().audit.listByEntity(entityId);
}
