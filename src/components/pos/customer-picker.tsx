"use client";

import { Check, ChevronsUpDown, Phone, UserPlus, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isValidIndianMobile, normalizePhone } from "@/domain/rules/customers";
import { useLive } from "@/hooks/use-live";
import { formatINR, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { listCustomers } from "@/services/customers";
import { CustomerTypeBadge } from "@/components/shared/status-badge";
import { usePosDraft } from "./pos-store";

/** Walk-in by default. Search by phone or name, or add a new customer inline. */
export function CustomerPicker() {
  const customer = usePosDraft((s) => s.customer);
  const setCustomer = usePosDraft((s) => s.setCustomer);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const { data: rows } = useLive(() => (open ? listCustomers() : Promise.resolve(undefined)), [open]);

  const term = q.trim().toLowerCase();
  const digits = normalizePhone(q);
  const matches = useMemo(() => {
    if (!rows) return [];
    if (!term) return rows.slice(0, 6);
    return rows
      .filter((r) => (digits.length >= 3 && r.customer.phone.includes(digits)) || r.customer.name.toLowerCase().includes(term))
      .slice(0, 6);
  }, [rows, term, digits]);
  const exact = rows?.some((r) => r.customer.phone === digits);
  const canCreate = isValidIndianMobile(digits) && !exact;

  const close = () => {
    setOpen(false);
    setQ("");
    setNewName("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <div className="flex items-center gap-2">
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card px-3 text-left shadow-xs transition-colors hover:border-primary/30"
            data-testid="pos-customer"
          >
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold", customer ? "bg-wine-50 text-primary" : "bg-muted text-muted-foreground")}>
              {customer ? initials(customer.name) : <UserRound className="size-4" />}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium">{customer ? customer.name : "Walk-in customer"}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {customer ? `+91 ${customer.phone}${customer.kind === "new" ? " · new customer" : ""}` : "Add phone to send the bill on WhatsApp"}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {customer && (
          <Button variant="ghost" size="icon-sm" onClick={() => setCustomer(null)} aria-label="Remove customer"><X /></Button>
        )}
      </div>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-80 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mobile number or name" className="pl-9" inputMode="search" aria-label="Find customer" />
          </div>
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          <li>
            <button type="button" onClick={() => { setCustomer(null); close(); }} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent">
              <span className="flex size-7 items-center justify-center rounded-full bg-muted"><UserRound className="size-3.5 text-muted-foreground" /></span>
              <span className="flex-1">Walk-in customer</span>
              {!customer && <Check className="size-4 text-primary" />}
            </button>
          </li>
          {matches.map(({ customer: c, type }) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { setCustomer({ kind: "existing", id: c.id, name: c.name, phone: c.phone }); close(); }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wine-50 text-[11px] font-semibold text-primary">{initials(c.name)}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block text-xs text-muted-foreground tabular">+91 {c.phone} · {c.stats.orderCount} order{c.stats.orderCount === 1 ? "" : "s"} · {formatINR(c.stats.totalSpend)}</span>
                </span>
                <CustomerTypeBadge type={type} />
              </button>
            </li>
          ))}
          {rows && term && matches.length === 0 && !canCreate && (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">No customer found. Type a 10-digit mobile number to add one.</li>
          )}
        </ul>
        {canCreate && (
          <form
            className="space-y-2 border-t bg-muted/40 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              setCustomer({ kind: "new", name: newName.trim(), phone: digits });
              close();
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium"><UserPlus className="size-4 text-primary" /> New customer · +91 {digits}</div>
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Customer name" aria-label="New customer name" className="bg-card" />
              <Button type="submit" disabled={!newName.trim()}>Add</Button>
            </div>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
}
