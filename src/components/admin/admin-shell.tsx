"use client";

import { ExternalLink, Keyboard, LayoutDashboard, Lock, Menu, MessageCircle, Search, ShoppingBag, Boxes, ReceiptText, Truck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { hasPermission } from "@/domain/permissions";
import { cn } from "@/lib/utils";
import { useRole } from "@/stores/session";
import { BrandLockup } from "@/components/shared/brand";
import { EmptyState } from "@/components/shared/empty-state";
import { CommandPalette } from "./command-palette";
import { NAV_GROUPS, permissionForPath } from "./nav";
import { NotificationCenter } from "./notification-center";
import { RoleSwitcher } from "./role-switcher";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[role=dialog]");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useRole();
  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((group, gi) => {
        const items = group.items.filter((i) => hasPermission(role, i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi}>
            {group.label && <div className="mb-1.5 px-3 text-[11px] font-medium tracking-wider text-muted-foreground/80 uppercase">{group.label}</div>}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                        active ? "bg-card font-medium text-foreground shadow-xs ring-1 ring-border" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-foreground",
                      )}
                    >
                      <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && <Kbd className="hidden lg:inline-flex">{item.shortcut}</Kbd>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-gold/40 bg-[oklch(0.97_0.035_85)] px-2.5 text-[11px] font-semibold tracking-wide text-gold-foreground">
      <span className="size-1.5 animate-pulse rounded-full bg-gold" />
      DEMO MODE
    </span>
  );
}

const MOBILE_TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, permission: "dashboard:view" as const },
  { href: "/inventory", label: "Stock", icon: Boxes, permission: "inventory:view" as const },
  { href: "/pos", label: "POS", icon: ShoppingBag, permission: "pos:use" as const },
  { href: "/orders", label: "Orders", icon: ReceiptText, permission: "orders:view" as const },
  { href: "/dispatch", label: "Dispatch", icon: Truck, permission: "dispatch:manage" as const },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useRole();
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const fullBleed = pathname.startsWith("/pos") || pathname.startsWith("/whatsapp");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setSearchOpen(true);
        }
        return;
      }
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (key === "n") setNewOrderOpen(true);
      else if (key === "p" && hasPermission(role, "pos:use")) router.push("/pos");
      else if (key === "i" && hasPermission(role, "inventory:view")) router.push("/inventory");
      else if (e.key === "?") setHelpOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [role, router]);

  const required = permissionForPath(pathname);
  const allowed = !required || hasPermission(role, required);
  const tabs = MOBILE_TABS.filter((t) => hasPermission(role, t.permission));

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="px-5 pt-5 pb-6">
          <Link href="/dashboard"><BrandLockup /></Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <div className="space-y-2 border-t p-3">
          <Button asChild variant="outline" size="sm" className="w-full justify-between bg-card">
            <a href="/store" target="_blank" rel="noreferrer">
              View website store <ExternalLink />
            </a>
          </Button>
          <RoleSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="no-print sticky top-0 z-30 flex h-14 min-w-0 items-center gap-1 border-b sm:gap-2 bg-background/85 px-3 backdrop-blur sm:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="hidden shrink-0 sm:block lg:hidden"><BrandLockup compact /></div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-1 flex h-9 w-full min-w-0 max-w-md items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground shadow-xs hover:border-primary/30"
          >
            <Search className="size-4" />
            <span className="flex-1 truncate text-left">Search SKU, orders, customers…</span>
            <Kbd className="hidden sm:inline-flex">/</Kbd>
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <div className="hidden sm:block"><DemoBadge /></div>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts">
              <Keyboard />
            </Button>
            <NotificationCenter />
          </div>
        </header>

        <main className={cn("flex-1 pb-24 lg:pb-8", fullBleed ? "" : "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8")}>
          {allowed ? (
            children
          ) : (
            <div className="p-6">
              <EmptyState icon={Lock} title="You don't have access to this page" description="Switch to a user with the right role from the menu at the bottom of the sidebar." />
            </div>
          )}
        </main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid border-t bg-background/95 pb-safe backdrop-blur lg:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const active = pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
              <t.icon className="size-5" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <BrandLockup />
            </div>
            <div className="px-5 pb-3"><DemoBadge /></div>
            <div className="flex-1 overflow-y-auto px-3"><NavLinks onNavigate={() => setNavOpen(false)} /></div>
            <div className="space-y-2 border-t p-3">
              <Button asChild variant="outline" size="sm" className="w-full justify-between bg-card">
                <a href="/store" target="_blank" rel="noreferrer">View website store <ExternalLink /></a>
              </Button>
              <RoleSwitcher />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New order</DialogTitle>
            <DialogDescription>Where is the customer buying from?</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {[
              { href: "/pos", icon: ShoppingBag, title: "In-store sale", text: "Bill at the counter with POS", permission: "pos:use" as const },
              { href: "/whatsapp", icon: MessageCircle, title: "WhatsApp order", text: "Hold sarees and send a payment request", permission: "whatsapp:use" as const },
            ]
              .filter((o) => hasPermission(role, o.permission))
              .map((o) => (
                <button
                  key={o.href}
                  type="button"
                  onClick={() => {
                    setNewOrderOpen(false);
                    router.push(o.href);
                  }}
                  className="flex items-center gap-3 rounded-xl border p-3 text-left hover:border-primary/40 hover:bg-accent"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-wine-50 text-primary"><o.icon className="size-5" /></div>
                  <div>
                    <div className="font-medium">{o.title}</div>
                    <div className="text-sm text-muted-foreground">{o.text}</div>
                  </div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            {[
              ["/", "Global search"],
              ["N", "New order"],
              ["P", "Open POS"],
              ["I", "Open inventory"],
              ["Esc", "Close dialog"],
              ["?", "Show shortcuts"],
            ].map(([k, label]) => (
              <div key={k} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{label}</dt>
                <dd><Kbd>{k}</Kbd></dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
