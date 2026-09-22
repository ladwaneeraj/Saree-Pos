"use client";

import { Suspense } from "react";
import { ProductListing } from "@/components/store/product-listing";

export default function SareesPage() {
  return (
    <Suspense>
      <ProductListing title="All Sarees" description="Every saree is a single piece. When it is gone, it is gone." />
    </Suspense>
  );
}
