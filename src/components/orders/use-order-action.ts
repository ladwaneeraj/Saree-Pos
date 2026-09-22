"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useAction } from "@/hooks/use-action";
import { orderNotificationsSince } from "@/services/orders";

const CHANNEL_WORD = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" } as const;

/** Shows a success toast that echoes the customer messages the action just recorded. */
export async function toastWithMessages(orderId: string, since: number, title: string): Promise<void> {
  const messages = await orderNotificationsSince(orderId, since);
  if (messages.length === 0) {
    toast.success(title);
    return;
  }
  toast.success(title, {
    description: messages.map((m) => `${CHANNEL_WORD[m.channel]} to ${m.recipientName.split(" ")[0]}: "${m.message}"`).join("\n\n"),
    duration: 8000,
  });
}

/**
 * Runs an order mutation (first argument is the order id). Errors are toasted by useAction; on
 * success the toast shows the notification text that was sent to the customer.
 */
export function useOrderAction<A extends [string, ...unknown[]], R>(fn: (...args: A) => Promise<R>, title: string | ((result: R) => string)) {
  const wrapped = useCallback(async (...args: A) => ({ result: await fn(...args) }), [fn]);
  const { run, pending } = useAction(wrapped);
  const exec = useCallback(
    async (...args: A): Promise<boolean> => {
      const since = Date.now();
      const out = await run(...args);
      if (!out) return false;
      await toastWithMessages(args[0], since, typeof title === "function" ? title(out.result) : title);
      return true;
    },
    [run, title],
  );
  return { run: exec, pending };
}
