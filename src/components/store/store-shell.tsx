"use client";

import { Heart, Home, MapPin, MessageCircle, Package, Search, ShieldCheck, ShoppingBag, Store, Truck, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/shared/brand";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useShopper } from "@/stores/shopper";
import { STORE_NAV, whatsappLink } from "./constants";
import { StoreProvider, useStore } from "./store-context";

export function StoreShell({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <StoreHeader />
        <main className="flex-1">{children}</main>
        <StoreFooter />
        <MobileBottomNav />
      </div>
    </StoreProvider>
  );
}

function StoreBrand() {
  const { settings } = useStore();
  const name = settings?.business.name ?? "Dhanvi Silks";
  return (
    <Link href="/store" className="flex min-w-0 items-center gap-2.5 lg:shrink-0" aria-label={`${name} home`}>
      <BrandMark className="size-8 shrink-0" />
      <div className="min-w-0 leading-none">
        <div className="truncate font-display text-[22px] sm:text-[26px]">{name}</div>
        <div className="mt-1 hidden truncate text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:block">{settings?.business.tagline || "Handwoven silks since 1998"}</div>
      </div>
    </Link>
  );
}

function DemoShopperPill() {
  const active = useShopper((s) => s.active);
  const switchShopper = useShopper((s) => s.switchShopper);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="demo-pill"
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-gold/60 bg-gold/10 px-2.5 text-[10px] font-semibold tracking-[0.1em] text-gold-foreground uppercase"
        >
          <span className="size-1.5 rounded-full bg-gold" />
          Demo<span className="hidden sm:inline"> mode</span> · {active}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="text-sm font-medium">Switch demo shopper</p>
        <p className="mt-1 text-xs text-muted-foreground">Each shopper has their own cart. A saree in Shopper A&apos;s cart is reserved and cannot be bought by Shopper B.</p>
        <div className="mt-3 grid gap-2">
          {(["A", "B"] as const).map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`shopper-${s}`}
              onClick={() => switchShopper(s)}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition",
                active === s ? "border-primary bg-wine-50" : "hover:bg-accent",
              )}
            >
              <span className={cn("flex size-8 items-center justify-center rounded-full text-xs font-semibold", active === s ? "bg-primary text-primary-foreground" : "bg-muted")}>{s}</span>
              <span className="flex-1">Shopping as Shopper {s}</span>
              {active === s && <span className="text-[11px] font-medium text-primary">Active</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular">
      {count}
    </span>
  );
}

function StoreHeader() {
  const { cart, wishlist, settings } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const submit = (value: string) => {
    setSearchOpen(false);
    router.push(value.trim() ? `/store/sarees?q=${encodeURIComponent(value.trim())}` : "/store/sarees");
  };
  const cartCount = cart?.lines.length ?? 0;
  const freeAbove = settings?.shipping.freeAbove ?? 2999;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
      <div className="hidden bg-primary text-center text-[11px] tracking-[0.08em] text-primary-foreground/90 sm:block">
        <p className="py-1.5">Free shipping on orders above {formatINR(freeAbove)} · 7-day easy returns · Every saree is one of a kind</p>
      </div>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <StoreBrand />
        <nav className="ml-6 hidden items-center gap-5 lg:flex xl:ml-10 xl:gap-7">
          {STORE_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "text-[13px] font-medium tracking-wide whitespace-nowrap text-foreground/75 transition hover:text-foreground",
                pathname === item.href.split("?")[0] && item.label !== "New Arrivals" && "text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <form
            className="relative hidden xl:block"
            onSubmit={(e) => {
              e.preventDefault();
              submit(q);
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sarees" className="h-9 w-48 rounded-full bg-card pl-9 xl:w-60" aria-label="Search sarees" />
          </form>
          <DemoShopperPill />
          <button type="button" className="relative flex size-10 items-center justify-center rounded-full hover:bg-accent xl:hidden" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search className="size-5" />
          </button>
          <Link href="/store/wishlist" className="relative hidden size-10 items-center justify-center rounded-full hover:bg-accent md:flex" aria-label="Wishlist">
            <Heart className="size-5" />
            <CountBadge count={wishlist.size} />
          </Link>
          <Link href="/store/cart" className="relative flex size-10 items-center justify-center rounded-full hover:bg-accent" aria-label={`Cart, ${cartCount} items`} data-testid="header-cart">
            <ShoppingBag className="size-5" />
            <CountBadge count={cartCount} />
          </Link>
        </div>
      </div>
      <nav className="scrollbar-none -mt-1 flex gap-5 overflow-x-auto px-4 pb-2.5 text-[13px] font-medium whitespace-nowrap text-foreground/75 sm:px-6 lg:hidden">
        {STORE_NAV.map((item) => (
          <Link key={item.label} href={item.href} className="py-1 hover:text-foreground">
            {item.label}
          </Link>
        ))}
      </nav>
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="px-4 pt-4 pb-6">
          <SheetHeader className="p-0">
            <SheetTitle className="font-display text-2xl font-normal">Search</SheetTitle>
          </SheetHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(q);
            }}
            className="relative"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kanchipuram, red, wedding..." className="h-12 rounded-full pl-10 text-base" />
          </form>
          <div className="flex flex-wrap gap-2">
            {["Kanchipuram", "Banarasi", "Wedding", "Cotton", "Red"].map((s) => (
              <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-accent">
                {s}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

const BOTTOM_NAV = [
  { href: "/store", label: "Home", icon: Home, match: (p: string) => p === "/store" },
  { href: "/store/sarees", label: "Shop", icon: Store, match: (p: string) => p.startsWith("/store/sarees") || p.startsWith("/store/collections") || p.startsWith("/store/p") },
  { href: "/store/wishlist", label: "Wishlist", icon: Heart, match: (p: string) => p.startsWith("/store/wishlist") },
  { href: "/store/cart", label: "Cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/store/cart") || p.startsWith("/store/checkout") },
  { href: "/store/track", label: "Track", icon: Truck, match: (p: string) => p.startsWith("/store/track") || p.startsWith("/store/order") },
];

function MobileBottomNav() {
  const pathname = usePathname();
  const { cart, wishlist } = useStore();
  const counts: Record<string, number> = { Cart: cart?.lines.length ?? 0, Wishlist: wishlist.size };
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden" aria-label="Store">
      <div className="grid grid-cols-5">
        {BOTTOM_NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.label} href={item.href} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
              <span className="relative">
                <item.icon className={cn("size-[22px]", active && "fill-primary/10")} />
                <CountBadge count={counts[item.label] ?? 0} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function TrustStrip({ className }: { className?: string }) {
  const { settings } = useStore();
  const items = [
    { icon: Package, title: "Free shipping", text: `On orders above ${formatINR(settings?.shipping.freeAbove ?? 2999)}` },
    { icon: RotateCcw, title: `${settings?.store.returnWindowDays ?? 7}-day returns`, text: "Easy returns and exchanges" },
    { icon: ShieldCheck, title: "Secure payments", text: "UPI, cards and net banking" },
    { icon: MessageCircle, title: "WhatsApp support", text: "Talk to us, we reply fast" },
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4", className)}>
      {items.map((i) => (
        <div key={i.title} className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wine-50 text-primary">
            <i.icon className="size-[18px]" />
          </span>
          <div>
            <p className="text-sm font-medium">{i.title}</p>
            <p className="text-xs text-muted-foreground">{i.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StoreFooter() {
  const { settings } = useStore();
  const b = settings?.business;
  return (
    <footer className="mt-20 border-t bg-[oklch(0.97_0.006_70)] pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="font-display text-2xl">{b?.name ?? "Dhanvi Silks"}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">{b?.tagline || "Handpicked silks and handloom sarees, each one a single piece woven for you."}</p>
          {b && (
            <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>
                {b.address}, {b.city}, {b.state} {b.pincode}
              </span>
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            {STORE_NAV.slice(0, 4).map((n) => (
              <li key={n.label}>
                <Link href={n.href} className="hover:text-primary">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">Help</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/store/track" className="hover:text-primary">Track your order</Link></li>
            <li><Link href="/store/wishlist" className="hover:text-primary">Your wishlist</Link></li>
            {b && (
              <li>
                <a href={whatsappLink(b.whatsapp, `Hi ${b.name}, I have a question.`)} target="_blank" rel="noreferrer" className="hover:text-primary">
                  WhatsApp {b.whatsapp}
                </a>
              </li>
            )}
            {b && <li><a href={`mailto:${b.email}`} className="hover:text-primary">{b.email}</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} {b?.legalName || b?.name || "Dhanvi Silks"}. All rights reserved.</span>
          <span className="flex items-center gap-1.5"><Users className="size-3.5" /> Powered by Dhanvi Silks Commerce</span>
        </div>
      </div>
    </footer>
  );
}
