"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Actor, DemoUser, Role } from "@/domain/types";
import { DEFAULT_SETTINGS } from "@/services/settings-defaults";
import { hasPermission, type Permission } from "@/domain/permissions";

interface SessionState {
  user: DemoUser;
  setUser: (user: DemoUser) => void;
}

/** Demo sign-in: which staff member is using the admin. Persisted per browser. */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: DEFAULT_SETTINGS.users[0]!,
      setUser: (user) => set({ user }),
    }),
    { name: "dhanvi-session" },
  ),
);

export function sessionActor(): Actor {
  const { user } = useSession.getState();
  return { id: user.id, name: user.name, role: user.role };
}

export function useCan(permission: Permission): boolean {
  const role = useSession((s) => s.user.role);
  return hasPermission(role, permission);
}

export function useRole(): Role {
  return useSession((s) => s.user.role);
}
