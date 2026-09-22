"use client";

import { Suspense } from "react";
import { useQueryParam } from "@/hooks/use-query-param";

import { useCatalog } from "@/hooks/use-catalog";
import { ProductListing } from "@/components/store/product-listing";

function CollectionPageView() {
  const slug = useQueryParam("slug");
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

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionPageView />
    </Suspense>
  );
}
