"use client";

import { Check, RotateCcw, Star } from "lucide-react";
import { useState } from "react";
import { MediaImage } from "@/components/shared/media-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { requestReturn } from "@/services/returns";
import { submitReview, type TrackingView } from "@/services/storefront";

type Line = TrackingView["lines"][number];

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ["", "Not for me", "Could be better", "Good", "Loved it", "Absolutely beautiful"];
  return (
    <div>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)} className="p-1 transition active:scale-90">
            <Star className={cn("size-8", n <= (hover || value) ? "fill-gold text-gold" : "text-border")} />
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 text-xs text-muted-foreground">{labels[hover || value]}</p>
    </div>
  );
}

function ReviewItem({ orderId, line }: { orderId: string; line: Line }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const { run, pending } = useAction(submitReview, { success: "Thank you for your review!" });
  return (
    <div className="flex gap-4 rounded-lg border bg-background p-4">
      <MediaImage id={line.imageId} alt={line.designName} thumb rounded="rounded" className="w-16 shrink-0 self-start" />
      <form
        className="min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          void run(orderId, line.designId, rating, body);
        }}
      >
        <p className="text-sm font-medium">{line.designName}</p>
        <StarPicker value={rating} onChange={setRating} />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How did it drape? How was the colour in person?" className="mt-2 min-h-20 bg-card text-base sm:text-sm" maxLength={600} />
        <Button type="submit" className="mt-3 h-11" disabled={pending || rating === 0}>Submit review</Button>
      </form>
    </div>
  );
}

export function ReviewSection({ view }: { view: TrackingView }) {
  const pending = view.lines.filter((l) => l.status === "ACTIVE" && !view.reviewedDesignIds.includes(l.designId));
  return (
    <section id="review" className="scroll-mt-24 rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="font-display text-3xl">How did you like your saree?</h2>
      {pending.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-success"><Check className="size-4" /> Thank you, your review has been shared with our weavers.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Your review helps other women choose with confidence.</p>
          <div className="mt-5 space-y-3">
            {pending.map((l) => <ReviewItem key={l.orderItemId} orderId={view.order.id} line={l} />)}
          </div>
        </>
      )}
    </section>
  );
}

const REASONS = ["Colour different from photos", "Damaged or defect in weave", "Received a different saree", "Did not like the fabric or drape", "Ordered for an occasion that got cancelled", "Other"];

export function ReturnSection({ view }: { view: TrackingView }) {
  const lines = view.lines.filter((l) => l.status === "ACTIVE");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(lines.length === 1 ? [lines[0]!.orderItemId] : []);
  const [type, setType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const { run, pending } = useAction(requestReturn, { success: (r) => `${r.type === "EXCHANGE" ? "Exchange" : "Return"} request ${r.number} received` });

  if (!open)
    return (
      <section className="flex flex-col items-start gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6">
        <RotateCcw className="size-5 text-muted-foreground" />
        <div className="flex-1">
          <p className="font-medium">Need to return or exchange?</p>
          <p className="text-sm text-muted-foreground">You can request within {view.returnWindowDays} days of delivery. We arrange a free pickup.</p>
        </div>
        <Button variant="outline" className="h-11" onClick={() => setOpen(true)}>Request return / exchange</Button>
      </section>
    );

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="font-display text-2xl">Request a return or exchange</h2>
      <form
        className="mt-5 space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const fullReason = [reason, details.trim()].filter(Boolean).join(": ");
          const ok = await run({ orderId: view.order.id, orderItemIds: selected, type, reason: fullReason }, true);
          if (ok) setOpen(false);
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {(["RETURN", "EXCHANGE"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setType(t)} className={cn("h-12 rounded-lg border text-sm font-medium transition", type === t ? "border-primary bg-wine-50 text-primary" : "hover:bg-accent")}>
              {t === "RETURN" ? "Return for refund" : "Exchange"}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Which saree?</Label>
          {lines.map((l) => (
            <label key={l.orderItemId} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={selected.includes(l.orderItemId)} onCheckedChange={(v) => setSelected(v ? [...selected, l.orderItemId] : selected.filter((x) => x !== l.orderItemId))} />
              <MediaImage id={l.imageId} alt="" thumb rounded="rounded" className="w-10" />
              <span className="text-sm">{l.designName}</span>
            </label>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose a reason" /></SelectTrigger>
            <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder={type === "EXCHANGE" ? "Tell us what you would like instead (colour, design)" : "Anything else we should know?"} className="min-h-20 text-base sm:text-sm" />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" className="h-11 flex-1" disabled={pending || selected.length === 0 || !reason}>Submit request</Button>
        </div>
      </form>
    </section>
  );
}
