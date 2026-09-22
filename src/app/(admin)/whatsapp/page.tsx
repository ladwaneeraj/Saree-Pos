"use client";

import { LayoutGrid, MessageCircle, MessagesSquare } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useLive } from "@/hooks/use-live";
import { cn } from "@/lib/utils";
import { getConversation, listConversations, markConversationRead } from "@/services/whatsapp";
import { CatalogueGrid } from "@/components/whatsapp/catalogue-grid";
import { ChatView } from "@/components/whatsapp/chat-view";
import { ConversationList } from "@/components/whatsapp/conversation-list";
import { NewChatDialog } from "@/components/whatsapp/new-chat-dialog";
import { SidePanel } from "@/components/whatsapp/side-panel";

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

type Tab = "chats" | "catalogue";

export default function WhatsAppPage() {
  const wide = useMediaQuery("(min-width: 768px)");
  const [tab, setTab] = useState<Tab>("chats");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const { data: conversations } = useLive(listConversations, []);
  const activeId = selectedId ?? (wide ? (conversations?.[0]?.id ?? null) : null);
  const { data } = useLive(() => (activeId ? getConversation(activeId) : Promise.resolve(undefined)), [activeId]);
  const active = conversations?.find((c) => c.id === activeId);

  useEffect(() => {
    if (activeId && active && active.unreadCount > 0) void markConversationRead(activeId);
  }, [activeId, active, active?.unreadCount]);

  const showChat = !!activeId;

  return (
    <div className="flex h-[calc(100dvh-7rem)] flex-col -mb-24 lg:-mb-8 lg:h-[calc(100dvh-3.5rem)]">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-3 sm:px-4">
        <span className="flex size-7 items-center justify-center rounded-full bg-[#25d366] text-white"><MessageCircle className="size-4" /></span>
        <h1 className="hidden font-semibold sm:block">WhatsApp sales desk</h1>
        <span className="hidden truncate rounded-full border border-gold/40 bg-[oklch(0.97_0.035_85)] px-2.5 py-0.5 text-[11px] font-medium text-gold-foreground md:inline">
          Simulated. Connects to WhatsApp Business API later.
        </span>
        <div className="ml-auto grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5" role="tablist">
          {([
            { v: "chats", label: "Chats", icon: MessagesSquare },
            { v: "catalogue", label: "Catalogue", icon: LayoutGrid },
          ] as const).map((t) => (
            <button
              key={t.v}
              type="button"
              role="tab"
              aria-selected={tab === t.v}
              onClick={() => setTab(t.v)}
              className={cn("flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium", tab === t.v ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ConversationList
          conversations={conversations}
          selectedId={activeId}
          onSelect={(id) => {
            setSelectedId(id);
            setTab("chats");
          }}
          onNewChat={() => setNewChatOpen(true)}
          className={cn("w-full md:w-[300px] md:shrink-0 2xl:w-[360px]", (showChat || tab === "catalogue") && "hidden md:flex")}
        />
        {tab === "catalogue" ? (
          <CatalogueGrid conversation={active ? { id: active.id, name: active.name } : null} className="min-w-0 flex-1" />
        ) : (
          <>
            {showChat ? (
              <ChatView data={data} onBack={() => setSelectedId(null)} onOpenDetails={() => setDetailsOpen(true)} className="flex-1" />
            ) : (
              <div className="hidden flex-1 flex-col items-center justify-center gap-3 bg-[#f0f2f5] text-center md:flex">
                <MessageCircle className="size-12 text-[#25d366]" />
                <p className="text-lg font-light text-[#41525d]">Dhanvi Silks on WhatsApp</p>
                <p className="max-w-sm text-sm text-[#667781]">Pick a chat to send sarees, hold pieces for the customer and collect payment.</p>
              </div>
            )}
            {showChat && <SidePanel data={data ?? undefined} className="hidden w-[340px] shrink-0 border-l xl:block 2xl:w-[380px]" />}
          </>
        )}
      </div>

      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetTitle className="sr-only">Customer and catalogue</SheetTitle>
          <SidePanel data={data ?? undefined} className="h-full pt-8" />
        </SheetContent>
      </Sheet>
      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} onStarted={(id) => { setSelectedId(id); setTab("chats"); }} />
    </div>
  );
}
