"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/hooks/use-action";
import { startConversation } from "@/services/whatsapp";

export function NewChatDialog({ open, onOpenChange, onStarted }: { open: boolean; onOpenChange: (o: boolean) => void; onStarted: (id: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const start = useAction(startConversation);
  const submit = async () => {
    const c = await start.run(name, phone);
    if (c) {
      setName("");
      setPhone("");
      onOpenChange(false);
      onStarted(c.id);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New chat</DialogTitle>
          <DialogDescription>Start a WhatsApp conversation with a customer. An existing chat with the same number opens instead.</DialogDescription>
        </DialogHeader>
        <form
          id="wa-new-chat"
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="wa-new-name">Name</Label>
            <Input id="wa-new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shwetha Kulkarni" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-new-phone">Mobile number</Label>
            <div className="flex">
              <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">+91</span>
              <Input id="wa-new-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} placeholder="98450 12345" className="rounded-l-none" />
            </div>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="wa-new-chat" disabled={!name.trim() || phone.replace(/\D/g, "").length < 10 || start.pending}>Start chat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
