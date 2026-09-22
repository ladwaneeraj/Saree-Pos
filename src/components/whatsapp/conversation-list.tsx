"use client";

import { MessageSquarePlus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { WaConversation } from "@/domain/types";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { avatarTone, listTime } from "./wa-theme";

export function WaAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold", avatarTone(name), className)}>
      {initials(name) || "?"}
    </span>
  );
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNewChat,
  className,
}: {
  conversations: WaConversation[] | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const rows = conversations?.filter((c) => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term.replace(/\D/g, "") || "@@") || c.lastMessagePreview.toLowerCase().includes(term));
  const unread = conversations?.reduce((s, c) => s + (c.unreadCount > 0 ? 1 : 0), 0) ?? 0;

  return (
    <aside className={cn("flex min-h-0 flex-col border-r bg-white", className)} aria-label="Chats">
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <h2 className="text-lg font-semibold text-[#111b21]">Chats</h2>
        {unread > 0 && <span className="rounded-full bg-[#25d366] px-2 py-0.5 text-[11px] font-semibold text-white">{unread} unread</span>}
        <Button variant="ghost" size="icon" className="ml-auto text-[#54656f]" onClick={onNewChat} aria-label="New chat" title="New chat">
          <MessageSquarePlus className="size-5" />
        </Button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#54656f]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, number or message" className="h-9 rounded-lg border-0 bg-[#f0f2f5] pl-9 shadow-none" aria-label="Search chats" />
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {!rows
          ? Array.from({ length: 7 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3"><Skeleton className="size-11 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-3/4" /></div></li>
            ))
          : rows.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  data-testid="wa-conversation"
                  className={cn("flex w-full items-center gap-3 px-3 text-left transition-colors hover:bg-[#f5f6f6]", selectedId === c.id && "bg-[#f0f2f5] hover:bg-[#f0f2f5]")}
                >
                  <WaAvatar name={c.name} />
                  <div className="min-w-0 flex-1 border-b border-[#e9edef] py-3 pr-1">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] text-[#111b21]">{c.name}</span>
                      <span className={cn("shrink-0 text-xs", c.unreadCount ? "font-medium text-[#1fa855]" : "text-[#667781]")}>{listTime(c.lastMessageAt)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[#667781]">{c.lastMessagePreview.replace(/\*/g, "")}</span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-white" data-testid="wa-unread">{c.unreadCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
        {rows && rows.length === 0 && <li className="px-6 py-10 text-center text-sm text-[#667781]">No chats match &ldquo;{q}&rdquo;</li>}
      </ul>
    </aside>
  );
}
