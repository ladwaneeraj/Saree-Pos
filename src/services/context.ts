import type { Actor } from "@/domain/types";

export const SYSTEM_ACTOR: Actor = { id: "system", name: "System", role: "SYSTEM" };
export const WEBSITE_ACTOR: Actor = { id: "system-website", name: "Website", role: "SYSTEM" };

let resolveActor: () => Actor = () => SYSTEM_ACTOR;

/** Called by the admin shell so services can attribute changes to the signed-in demo user. */
export function setActorResolver(resolver: () => Actor): void {
  resolveActor = resolver;
}

export function currentActor(): Actor {
  return resolveActor();
}

export function now(): number {
  return Date.now();
}

export function appOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export const DAY_MS = 86_400_000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
