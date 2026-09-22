"use client";

import { Check, Minus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/shared/status-badge";
import { PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, hasPermission, type Permission } from "@/domain/permissions";
import { ROLES } from "@/domain/types";
import { useSettings } from "@/hooks/use-catalog";
import { initials } from "@/lib/format";
import { useSession } from "@/stores/session";
import { SettingsCard } from "./settings-kit";

const PERMISSION_LABELS: Record<Permission, string> = {
  "dashboard:view": "View dashboard",
  "inventory:view": "View inventory",
  "inventory:edit": "Add and edit stock",
  "cost:view": "See purchase costs",
  "pricing:edit": "Change prices",
  "designs:edit": "Edit products",
  "purchases:manage": "Purchases and imports",
  "pos:use": "POS billing",
  "orders:view": "View orders",
  "orders:manage": "Manage orders and payments",
  "customers:view": "View customers",
  "customers:edit": "Edit customers",
  "whatsapp:use": "WhatsApp selling",
  "dispatch:manage": "Packing and dispatch",
  "returns:manage": "Returns and exchanges",
  "reports:view": "Reports",
  "audit:view": "Activity log",
  "settings:manage": "Settings",
  "demo:manage": "Reset and import demo data",
};

export function UsersRoles() {
  const settings = useSettings();
  const { user, setUser } = useSession();
  const router = useRouter();
  const users = settings?.users ?? [];

  return (
    <div className="space-y-5">
      <SettingsCard title="Staff accounts" description="Demo sign-in. Switch user to see exactly what each role can see and do.">
        <ul className="grid gap-3 md:grid-cols-2">
          {users.map((u) => {
            const current = u.id === user.id;
            return (
              <li key={u.id} className="flex items-center gap-3 rounded-lg border p-3.5">
                <Avatar className="size-10"><AvatarFallback className="bg-wine-50 text-sm font-semibold text-primary">{initials(u.name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    <Pill tone={u.role === "OWNER" ? "wine" : u.role === "MANAGER" ? "gold" : "neutral"} dot={false}>{ROLE_LABELS[u.role]}</Pill>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                  <div className="truncate text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[u.role]}</div>
                </div>
                {current ? (
                  <span className="text-xs font-medium text-success">Signed in</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setUser(u);
                      toast.success(`Signed in as ${u.name}`, { description: ROLE_LABELS[u.role] });
                      if (!hasPermission(u.role, "settings:manage")) router.push(hasPermission(u.role, "dashboard:view") ? "/dashboard" : u.role === "BILLING" ? "/pos" : "/dispatch");
                    }}
                  >
                    Switch
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </SettingsCard>

      <SettingsCard title="Permissions by role" description="Enforced in the app and in every service call, not only hidden in the menu.">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Permission</th>
                {ROLES.map((r) => <th key={r} className="px-3 py-2.5 text-center font-medium">{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p} className="border-b last:border-0">
                  <td className="px-5 py-2">{PERMISSION_LABELS[p]}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {hasPermission(r, p) ? <Check className="mx-auto size-4 text-success" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
    </div>
  );
}
