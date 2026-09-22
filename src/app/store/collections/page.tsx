"use client";

import { useLive } from "@/hooks/use-live";
import { getStoreHome } from "@/services/storefront";
import { CollectionTiles, Container, Eyebrow } from "@/components/store/sections";

export default function CollectionsPage() {
  const { data: home } = useLive(getStoreHome, []);
  return (
    <Container className="pt-8 sm:pt-12">
      <Eyebrow>Curated edits</Eyebrow>
      <h1 className="mt-2 font-display text-4xl leading-none sm:text-6xl">Collections</h1>
      <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">From heirloom bridal silks to breathable everyday cottons, browse sarees chosen for the moment.</p>
      <div className="mt-8 sm:mt-10">
        <CollectionTiles collections={home?.collections} />
      </div>
    </Container>
  );
}
