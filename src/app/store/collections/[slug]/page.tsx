"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useCatalog } from "@/hooks/use-catalog";
import { ProductListing } from "@/components/store/product-listing";

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const catalog = useCatalog();
  const collection = catalog?.collections.find((c) => c.slug === slug);
  return (
    <Suspense>
      <ProductListing
        key={slug}
        fixedCollection={slug}
        title={collection?.name ?? (catalog ? "Collection" : "")}
        description={collection?.description ?? (catalog ? "This collection could not be found." : undefined)}
      />
    </Suspense>
  );
}
