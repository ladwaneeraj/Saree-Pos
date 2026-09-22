"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackageSearch, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findOrderForTracking } from "@/services/storefront";
import { Container } from "@/components/store/sections";
import { StockImage } from "@/components/store/stock-image";

const schema = z.object({
  orderNumber: z.string().trim().regex(/^#?\s*\d{3,}$/, "Enter your order number, for example 10452"),
  phone: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{4}\s?\d{5}$/, "Enter the 10-digit mobile number used at checkout"),
});
type Values = z.infer<typeof schema>;

export default function TrackLookupPage() {
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { orderNumber: "", phone: "" } });
  const errors = formState.errors;

  const onSubmit = async (v: Values) => {
    setNotFound(false);
    const id = await findOrderForTracking(v.orderNumber, v.phone);
    if (id) router.push(`/track/${id}`);
    else setNotFound(true);
  };

  return (
    <Container className="pt-8 sm:pt-12">
      <div className="grid overflow-hidden rounded-2xl border bg-card lg:grid-cols-2">
        <StockImage photo="fabricStack" alt="Folded silk sarees" width={1000} className="hidden min-h-[480px] lg:block" />
        <div className="p-6 sm:p-10 lg:p-14">
          <span className="flex size-12 items-center justify-center rounded-full bg-wine-50 text-primary">
            <PackageSearch className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-4xl sm:text-5xl">Track your order</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter the order number from your WhatsApp confirmation and the mobile number you used at checkout.</p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="orderNumber">Order number</Label>
              <Input id="orderNumber" inputMode="numeric" placeholder="10452" className="h-12 bg-background text-base" aria-invalid={!!errors.orderNumber} {...register("orderNumber")} />
              {errors.orderNumber && <p className="text-xs text-destructive">{errors.orderNumber.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <Input id="phone" inputMode="numeric" placeholder="98450 12345" className="h-12 bg-background text-base" aria-invalid={!!errors.phone} {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            {notFound && (
              <p className="rounded-md bg-danger-soft px-3 py-2.5 text-sm text-destructive" role="alert">
                We could not find an order with that number and mobile. Please check both and try again.
              </p>
            )}
            <Button type="submit" size="lg" className="h-12 w-full" disabled={formState.isSubmitting}>
              <Search /> Track order
            </Button>
          </form>
        </div>
      </div>
    </Container>
  );
}
