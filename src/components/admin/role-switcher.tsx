"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, hasPermission } from "@/domain/permissions";
import { useSettings } from "@/hooks/use-catalog";
import { initials } from "@/lib/format";
import { useSession } from "@/stores/session";
import { ALL_NAV_ITEMS } from "./nav";

/** Demo sign-in switcher. Changing user changes what the admin shows and allows. */
export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const settings = useSettings();
  const { user, setUser } = useSession();
  const router = useRouter();
  const users = settings?.users ?? [user];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left hover:bg-sidebar-accent focus-visible:outline-none">
        <Avatar className="size-8">
          <AvatarFallback className="bg-wine-100 text-xs font-semibold text-primary">{initials(user.name)}</AvatarFallback>
        </Avatar>
        {!compact && (
          <>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
            </div>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Switch demo user</DropdownMenuLabel>
        {users.map((u) => (
          <DropdownMenuItem
            key={u.id}
            className="items-start gap-2.5 py-2"
            onSelect={() => {
              setUser(u);
              toast.success(`Signed in as ${u.name}`, { description: ROLE_LABELS[u.role] });
              const home = ALL_NAV_ITEMS.find((i) => hasPermission(u.role, i.permission));
              if (home) router.push(home.href);
            }}
          >
            <Avatar className="mt-0.5 size-7">
              <AvatarFallback className="text-[10px]">{initials(u.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {u.name} <span className="font-normal text-muted-foreground">· {ROLE_LABELS[u.role]}</span>
              </div>
              <div className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[u.role]}</div>
            </div>
            {u.id === user.id && <Check className="mt-1 size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Demo only. Real sign-in comes with the backend.</div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
