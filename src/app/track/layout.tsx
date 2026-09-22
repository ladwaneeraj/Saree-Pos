"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/shared/brand";
import { whatsappLink } from "@/components/store/constants";
import { useSettings } from "@/hooks/use-catalog";

/** Minimal branded frame for shareable tracking links (no store navigation). */
export default function TrackLayout({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const b = settings?.business;
  return (
    <div className="flex min-h-dvh flex-col bg-[oklch(0.975_0.005_70)]">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Link href="/store" className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="font-display text-2xl">{b?.name ?? "Dhanvi Silks"}</span>
          </Link>
          {b && (
            <a href={whatsappLink(b.whatsapp, `Hi ${b.name}, I need help with my order.`)} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#1faa53] px-3.5 text-xs font-medium text-white">
              <MessageCircle className="size-4" /> Help
            </a>
          )}
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="py-8 text-center text-xs text-muted-foreground">
        {b && <p>{b.name} · {b.city}, {b.state}</p>}
        <p className="mt-1">Powered by Dhanvi Silks Commerce</p>
      </footer>
    </div>
  );
}
