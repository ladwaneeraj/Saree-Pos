"use client";

import { Suspense } from "react";
import { QuickAddForm } from "@/components/inventory/quick-add-form";

export default function QuickAddPage() {
  return (
    <Suspense>
      <QuickAddForm />
    </Suspense>
  );
}
