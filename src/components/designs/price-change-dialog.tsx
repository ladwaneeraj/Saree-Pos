"use client";

import { ArrowRight, Barcode, Check, Loader2, Lock, ShoppingCart, Tag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Design } from "@/domain/types";
import { errorMessage } from "@/domain/errors";
import { discountPercent } from "@/domain/rules/pricing";
import { formatINR, pluralize } from "@/lib/format";
import { applyDesignPriceChange, previewDesignPriceChange, type PriceChangePreview } from "@/services/pricing";

/**
 * Global price update: edit, preview what it touches, then confirm. Every channel reads the
 * price from the design, so POS, website and WhatsApp change together.
 */
export function PriceChangeDialog({ design, open, onOpenChange }: { design: Design; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [preview, setPreview] = useState<PriceChangePreview | null>(null);
  const [clearOverrides, setClearOverrides] = useState(false);
  const [busy, setBusy] = useState(false);

  const nextPrice = Number(price || design.price);
  const nextMrp = Number(mrp || design.mrp);
  const error = nextPrice <= 0 ? "Enter a selling price" : nextPrice > nextMrp ? `Selling price cannot be above MRP (${formatINR(nextMrp)})` : "";
  const unchanged = nextPrice === design.price && nextMrp === design.mrp;

  const reset = () => {
    setPrice("");
    setMrp("");
    setPreview(null);
    setClearOverrides(false);
  };
  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const review = async () => {
    setBusy(true);
    try {
      setPreview(await previewDesignPriceChange(design.id, nextPrice));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const { piecesUpdated } = await applyDesignPriceChange(design.id, { price: nextPrice, mrp: nextMrp, clearOverrides });
      toast.success(`${design.name} is now ${formatINR(nextPrice)}`, { description: `${pluralize(piecesUpdated, "piece")} updated on POS, website and WhatsApp. No labels to reprint.` });
      close(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const change = design.price ? Math.round(((nextPrice - design.price) / design.price) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        {!preview ? (
          <>
            <DialogHeader>
              <DialogTitle>Change price for {design.name}</DialogTitle>
              <DialogDescription>Updates the current selling price everywhere this design is sold. You will see exactly what changes before confirming.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pc-price">New selling price (₹)</Label>
                <Input id="pc-price" autoFocus inputMode="numeric" className="text-lg font-semibold tabular" placeholder={String(design.price)} value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && !error && !unchanged && review()} />
                <p className="text-xs text-muted-foreground">Currently {formatINR(design.price)}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pc-mrp">MRP (₹)</Label>
                <Input id="pc-mrp" inputMode="numeric" className="text-lg tabular" placeholder={String(design.mrp)} value={mrp} onChange={(e) => setMrp(e.target.value.replace(/\D/g, ""))} />
                <p className="text-xs text-muted-foreground">
                  {discountPercent(nextMrp, nextPrice) > 0 ? `${discountPercent(nextMrp, nextPrice)}% off MRP` : "No discount shown"}
                </p>
              </div>
            </div>
            {error && price && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button onClick={review} disabled={!!error || unchanged || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />} Review change
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Update the price to {formatINR(nextPrice)}?</DialogTitle>
              <DialogDescription className="text-foreground">
                This will update the current selling price for <span className="font-semibold">{pluralize(preview.availableAffected, "available piece")}</span> and connected sales channels.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-4 rounded-xl bg-muted/50 py-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Now</div>
                <div className="text-xl text-muted-foreground line-through tabular">{formatINR(design.price)}</div>
              </div>
              <ArrowRight className="size-5 text-muted-foreground" />
              <div className="text-center">
                <div className="text-xs text-muted-foreground">New</div>
                <div className="text-2xl font-semibold tabular">{formatINR(nextPrice)}</div>
              </div>
              {change !== 0 && (
                <span className={change < 0 ? "rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success" : "rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-[oklch(0.5_0.12_65)]"}>
                  {change > 0 ? "+" : ""}
                  {change}%
                </span>
              )}
            </div>

            <ul className="space-y-2.5 text-sm">
              <Detail icon={Check} tone="text-success">
                POS, website and WhatsApp show {formatINR(nextPrice)} immediately.
              </Detail>
              {preview.heldAffected > 0 && (
                <Detail icon={ShoppingCart}>
                  {pluralize(preview.heldAffected, "piece")} held in carts or on hold will be charged the new price at checkout.
                </Detail>
              )}
              {preview.overrides > 0 && (
                <li className="flex gap-2.5">
                  <Tag className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div className="space-y-2">
                    <p>{pluralize(preview.overrides, "piece")} with individual prices keep them unless you clear them.</p>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox checked={clearOverrides} onCheckedChange={(c) => setClearOverrides(c === true)} />
                      Also clear individual prices
                    </label>
                  </div>
                </li>
              )}
              {preview.lockedInOrders > 0 && (
                <Detail icon={Lock}>{pluralize(preview.lockedInOrders, "piece")} already in orders keep their order price.</Detail>
              )}
              <Detail icon={Barcode}>SKU and barcode do not change. No labels need reprinting.</Detail>
            </ul>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={busy}>Back</Button>
              <Button variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
              <Button onClick={confirm} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} Confirm price change
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ icon: Icon, tone = "text-muted-foreground", children }: { icon: typeof Check; tone?: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <p>{children}</p>
    </li>
  );
}
