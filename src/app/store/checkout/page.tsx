"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Check, CreditCard, Lock, ShoppingBag, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/shared/empty-state";
import { MediaImage } from "@/components/shared/media-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/domain/errors";
import { isValidIndianMobile } from "@/domain/rules/customers";
import { useNow } from "@/hooks/use-now";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { placeWebsiteOrder, type CheckoutInput } from "@/services/storefront";
import { ReservationTimer, SummaryRows } from "@/components/store/cart-bits";
import { INDIAN_STATES } from "@/components/store/constants";
import { Container } from "@/components/store/sections";
import { useStore } from "@/components/store/store-context";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  phone: z.string().trim().refine(isValidIndianMobile, "Enter a valid 10-digit mobile number"),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  line1: z.string().trim().min(4, "Enter your house number and street"),
  line2: z.string().trim(),
  city: z.string().trim().min(2, "Enter your city"),
  state: z.string().min(1, "Choose your state"),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
});
type FormValues = z.infer<typeof schema>;
type Method = CheckoutInput["paymentMethod"];

const METHODS: { value: Method; label: string; hint: string; icon: typeof Smartphone }[] = [
  { value: "UPI", label: "UPI", hint: "GPay, PhonePe, Paytm", icon: Smartphone },
  { value: "CARD", label: "Card", hint: "Credit or debit card", icon: CreditCard },
  { value: "NETBANKING", label: "Net banking", hint: "All major banks", icon: Building2 },
];

const STEPS = ["Connecting to payment gateway", "Authorising payment", "Payment successful, confirming order"];

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, shopperId, settings } = useStore();
  const now = useNow(1000);
  const [method, setMethod] = useState<Method>("UPI");
  const [step, setStep] = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "", pincode: "" },
  });
  const { register, handleSubmit, control, formState } = form;
  const errors = formState.errors;

  const lines = cart?.lines.filter((l) => !l.expiresAt || l.expiresAt > now);

  const onSubmit = async (v: FormValues) => {
    setStep(0);
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      await wait(700);
      setStep(1);
      await wait(900);
      const order = await placeWebsiteOrder(shopperId, {
        name: v.name,
        phone: v.phone,
        email: v.email,
        address: { line1: v.line1, line2: v.line2, city: v.city, state: v.state, pincode: v.pincode },
        paymentMethod: method,
      });
      setStep(2);
      await wait(600);
      router.replace(`/store/order/${order.id}`);
    } catch (e) {
      setStep(null);
      toast.error(errorMessage(e));
    }
  };

  if (step === null && lines && lines.length === 0) {
    return (
      <Container className="py-12">
        <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Your reservations may have expired. Add a saree to check out." action={<Button asChild><Link href="/store/sarees">Shop sarees</Link></Button>} />
      </Container>
    );
  }

  const subtotal = lines?.reduce((s, l) => s + l.price, 0) ?? 0;
  const freeAbove = settings?.shipping.freeAbove ?? 2999;
  const shippingFee = subtotal === 0 || subtotal >= freeAbove ? 0 : settings?.shipping.flatFee ?? 0;
  const total = subtotal + shippingFee;

  const field = (name: keyof FormValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} className="h-11 bg-card text-base sm:text-sm" aria-invalid={!!errors[name]} {...register(name)} {...props} />
      {errors[name] && <p className="text-xs text-destructive">{errors[name]?.message}</p>}
    </div>
  );

  return (
    <Container className="pt-8 sm:pt-12">
      <h1 className="font-display text-4xl sm:text-6xl">Checkout</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-12" noValidate>
        <div className="space-y-10">
          <section>
            <h2 className="font-display text-2xl">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field("name", "Full name", { autoComplete: "name", placeholder: "Priya Raghavan" })}</div>
              {field("phone", "Mobile number", { inputMode: "numeric", autoComplete: "tel", placeholder: "98450 12345", maxLength: 14 })}
              {field("email", "Email (optional)", { type: "email", autoComplete: "email", placeholder: "priya@example.com" })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">We will send your order confirmation and tracking link on WhatsApp.</p>
          </section>

          <section>
            <h2 className="font-display text-2xl">Delivery address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field("line1", "House number, street", { autoComplete: "address-line1", placeholder: "No. 12, 3rd Cross, Jayanagar" })}</div>
              <div className="sm:col-span-2">{field("line2", "Landmark or area (optional)", { autoComplete: "address-line2", placeholder: "Near Ashoka Pillar" })}</div>
              {field("city", "City", { autoComplete: "address-level2", placeholder: "Bengaluru" })}
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Controller
                  control={control}
                  name="state"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger id="state" className="h-11 w-full bg-card" aria-invalid={!!errors.state}>
                        <SelectValue placeholder="Choose state" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
              </div>
              {field("pincode", "Pincode", { inputMode: "numeric", autoComplete: "postal-code", placeholder: "560011", maxLength: 6 })}
            </div>
          </section>

          <section>
            <h2 className="font-display text-2xl">Payment</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Payment method">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={method === m.value}
                  onClick={() => setMethod(m.value)}
                  className={cn("flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition sm:flex-col sm:items-start", method === m.value ? "border-primary ring-1 ring-primary" : "hover:bg-accent")}
                >
                  <m.icon className={cn("size-5", method === m.value ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.hint}</p>
                  </div>
                  {method === m.value && <Check className="size-4 text-primary sm:hidden" />}
                </button>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3" /> Demo checkout: payment is simulated and always succeeds.
            </p>
          </section>
        </div>

        <aside className="h-fit rounded-xl border bg-card p-5 sm:p-6 lg:sticky lg:top-32">
          <h2 className="font-display text-2xl">Order summary</h2>
          <ul className="mt-4 space-y-4">
            {lines?.map((l) => (
              <li key={l.item.id} className="flex gap-3">
                <MediaImage id={l.imageId} alt={l.design.name} thumb rounded="rounded" className="w-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug">{l.design.name}</p>
                  <p className="text-xs text-muted-foreground">{l.colour?.name}</p>
                  <ReservationTimer expiresAt={l.expiresAt} now={now} className="mt-1.5 px-2 py-0.5 text-[11px]" />
                </div>
                <p className="text-sm font-medium tabular">{formatINR(l.price)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t pt-5">
            <SummaryRows subtotal={subtotal} shippingFee={shippingFee} total={total} count={lines?.length ?? 0} freeAbove={freeAbove} />
          </div>
          <Button type="submit" size="lg" className="mt-6 h-12 w-full text-base" disabled={step !== null || !lines} data-testid="pay">
            <Lock /> Pay {formatINR(total)}
          </Button>
        </aside>
      </form>

      <Dialog open={step !== null}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">Processing payment</DialogTitle>
          <DialogDescription className="sr-only">Please wait while we confirm your payment.</DialogDescription>
          <div className="flex flex-col items-center py-4 text-center">
            <div className={cn("flex size-16 items-center justify-center rounded-full", step === 2 ? "bg-success-soft text-success" : "bg-wine-50 text-primary")}>
              {step === 2 ? <Check className="size-8" /> : <Spinner className="size-7" />}
            </div>
            <p className="mt-5 font-display text-2xl">{step === 2 ? "Payment received" : `Paying ${formatINR(total)}`}</p>
            <p className="mt-1 text-sm text-muted-foreground">via {METHODS.find((m) => m.value === method)?.label}</p>
            <ol className="mt-6 w-full space-y-2.5 text-left text-sm">
              {STEPS.map((s, i) => (
                <li key={s} className={cn("flex items-center gap-2.5", step !== null && i <= step ? "text-foreground" : "text-muted-foreground/60")}>
                  {step !== null && (i < step || step === 2) ? <Check className="size-4 text-success" /> : i === step ? <Spinner className="size-4" /> : <span className="size-4 rounded-full border" />}
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
