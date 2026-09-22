"use client";

import { ArrowLeft, Bot, PanelRight, SendHorizontal, Smile } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { sendText, simulateCustomerMessage, type getConversation } from "@/services/whatsapp";
import { WaAvatar } from "./conversation-list";
import { MessageBubble } from "./message-bubble";
import { WA_WALLPAPER, dayLabel } from "./wa-theme";
import { withOk } from "./with-ok";

export type ConversationData = NonNullable<Awaited<ReturnType<typeof getConversation>>>;

const send_ = withOk(sendText);
const simulate = withOk(simulateCustomerMessage);

const QUICK_REPLIES = ["Namaskara! How can I help you?", "Yes, it is available", "Sharing the payment link", "Your order has been dispatched"];
const CUSTOMER_PRESETS = ["Is this saree available?", "Please hold it for me", "Payment done ✅", "Can you share more colours?"];

export function ChatView({ data, onBack, onOpenDetails, className }: { data: ConversationData | null | undefined; onBack: () => void; onOpenDetails: () => void; className?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;
  const conversationId = data?.conversation.id;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: count ? "smooth" : "auto" });
  }, [count, conversationId]);

  if (data === null) return null;

  const orderById = new Map(data?.orders.map((o) => [o.id, o]) ?? []);

  return (
    <section className={cn("flex min-h-0 min-w-0 flex-col", className)} aria-label="Chat">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-[#f0f2f5] px-3">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Back to chats"><ArrowLeft /></Button>
        {data ? (
          <>
            <WaAvatar name={data.conversation.name} className="size-10" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate font-medium text-[#111b21]">{data.conversation.name}</div>
              <div className="truncate text-xs text-[#667781]">+91 {data.conversation.phone.replace(/(\d{5})(\d{5})/, "$1 $2")}</div>
            </div>
          </>
        ) : (
          <Skeleton className="h-9 w-48" />
        )}
        <Button variant="ghost" size="sm" className="ml-auto text-[#54656f] xl:hidden" onClick={onOpenDetails}>
          <PanelRight /> <span className="hidden sm:inline">Customer & catalogue</span>
        </Button>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto bg-[#efeae2] px-3 py-3 sm:px-[6%]" style={WA_WALLPAPER} data-testid="wa-messages">
        {!data ? (
          <div className="space-y-3">{[40, 60, 30, 55].map((w, i) => <Skeleton key={i} className={cn("h-10", i % 2 ? "ml-auto" : "")} style={{ width: `${w}%` }} />)}</div>
        ) : (
          <div className="space-y-1.5">
            <div className="mx-auto mb-3 max-w-md rounded-lg bg-[#ffeecd] px-3 py-2 text-center text-xs text-[#54656f]">
              Simulated chat. Messages stay in this demo and connect to the WhatsApp Business API later.
            </div>
            {data.messages.map((m, i) => {
              const prev = data.messages[i - 1];
              const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(m.createdAt);
              return (
                <Fragment key={m.id}>
                  {newDay && (
                    <div className="flex justify-center py-2">
                      <span className="rounded-lg bg-white px-3 py-1 text-xs text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">{dayLabel(m.createdAt)}</span>
                    </div>
                  )}
                  <div data-testid={`wa-msg-${m.kind.toLowerCase()}`}>
                    <MessageBubble message={m} product={m.designId ? data.products[m.designId] : undefined} order={m.orderId ? orderById.get(m.orderId) : undefined} />
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {data && <Composer conversationId={data.conversation.id} />}
    </section>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const send = useAction(send_);
  const submit = async (value: string) => {
    if (!value.trim()) return;
    const ok = await send.run(conversationId, value);
    if (ok !== undefined) setText("");
  };
  return (
    <div className="shrink-0 border-t bg-[#f0f2f5] px-3 pt-2 pb-2.5">
      <div className="scrollbar-none mb-2 flex gap-1.5 overflow-x-auto">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" onClick={() => submit(q)} className="h-7 shrink-0 rounded-full border border-[#d1d7db] bg-white px-3 text-[13px] text-[#008069] transition-colors hover:bg-[#e7fce3]">
            {q}
          </button>
        ))}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(text);
        }}
      >
        <SimulateReply conversationId={conversationId} />
        <div className="relative flex-1">
          <Smile className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-[#54656f]" />
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" className="h-10 rounded-lg border-0 bg-white pl-10 shadow-none" aria-label="Type a message" />
        </div>
        <Button type="submit" size="icon" disabled={!text.trim() || send.pending} className="size-10 rounded-full bg-[#00a884] text-white hover:bg-[#008f72]" aria-label="Send">
          <SendHorizontal />
        </Button>
      </form>
    </div>
  );
}

function SimulateReply({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const sim = useAction(simulate);
  const say = async (text: string) => {
    if ((await sim.run(conversationId, text)) !== undefined) {
      setCustom("");
      setOpen(false);
    }
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 rounded-full text-[#54656f]" aria-label="Simulate customer reply" title="Simulate customer reply (demo)">
          <Bot className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 space-y-2 p-3">
        <div>
          <div className="text-sm font-medium">Simulate customer reply</div>
          <div className="text-xs text-muted-foreground">Demo only. Appears as if the customer typed it.</div>
        </div>
        <div className="grid gap-1">
          {CUSTOMER_PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => say(p)} disabled={sim.pending} className="rounded-md bg-muted px-2.5 py-1.5 text-left text-sm hover:bg-accent">
              {p}
            </button>
          ))}
        </div>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void say(custom);
          }}
        >
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Custom message" className="h-8" aria-label="Custom customer message" />
          <Button type="submit" size="sm" disabled={!custom.trim()}>Send</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
