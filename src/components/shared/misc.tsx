"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { copyText } from "@/lib/files";
import { cn } from "@/lib/utils";

export function ColourDot({ hex, className, title }: { hex: string; className?: string; title?: string }) {
  return <span title={title} className={cn("inline-block size-3 shrink-0 rounded-full ring-1 ring-black/10", className)} style={{ background: hex }} />;
}

export function CopyButton({ text, label = "Copy", size = "sm", variant = "outline", className }: { text: string; label?: string; size?: "sm" | "default" | "icon-sm"; variant?: "outline" | "ghost" | "secondary" | "default"; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={async () => {
        await copyText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {size !== "icon-sm" && (copied ? "Copied" : label)}
    </Button>
  );
}

export function SearchInput({ value, onChange, placeholder, className, autoFocus, inputRef }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string; autoFocus?: boolean; inputRef?: React.Ref<HTMLInputElement> }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="bg-card pl-9" />
    </div>
  );
}

export function KeyValue({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
