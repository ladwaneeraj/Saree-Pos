"use client";

import { Bell, MessageCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Notification } from "@/domain/types";
import { useLive } from "@/hooks/use-live";
import { formatRelative } from "@/lib/format";
import { listRecentNotifications } from "@/services/notifications";

/**
 * Outbox of simulated customer messages. New messages created after the page loaded (in any
 * tab) pop up as a toast so the demo audience sees the customer notification happen.
 */
export function NotificationCenter() {
  const { data } = useLive(() => listRecentNotifications(40), []);
  const mountedAt = useRef(Date.now());
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!data) return;
    for (const n of [...data].reverse()) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (n.createdAt >= mountedAt.current) showToast(n);
    }
  }, [data]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Customer messages">
          <Bell />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">Customer messages</div>
          <div className="text-xs text-muted-foreground">Simulated WhatsApp notifications. Nothing is actually sent.</div>
        </div>
        <ScrollArea className="h-96">
          <ul className="divide-y">
            {data?.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{n.recipientName}</span>
                  <span>{formatRelative(n.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-sm">{n.message}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function showToast(n: Notification) {
  toast(`WhatsApp to ${n.recipientName.split(" ")[0]}`, {
    description: n.message,
    icon: <MessageCircle className="size-4 text-success" />,
    duration: 6000,
  });
}
