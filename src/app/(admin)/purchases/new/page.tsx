"use client";

import { PageHeader } from "@/components/shared/page-header";
import { PurchaseForm } from "@/components/purchases/purchase-form";

export default function NewPurchasePage() {
  return (
    <>
      <PageHeader title="New purchase" description="Enter the supplier invoice. Receive now to create SKUs and print labels straight away." back={{ href: "/purchases", label: "Purchases" }} />
      <PurchaseForm />
    </>
  );
}
