"use client";

import { Suspense } from "react";
import { LabelsView } from "@/components/inventory/labels-view";

export default function LabelsPage() {
  return (
    <Suspense>
      <LabelsView />
    </Suspense>
  );
}
