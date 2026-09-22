"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import type { AppSettings } from "@/domain/types";
import { errorMessage } from "@/domain/errors";
import { useSettings } from "@/hooks/use-catalog";
import { useLive } from "@/hooks/use-live";
import { getCart } from "@/services/storefront";
import { listWishlistDesignIds, toggleWishlist } from "@/services/wishlist";
import { useShopperId } from "@/stores/shopper";

type Cart = Awaited<ReturnType<typeof getCart>>;

interface StoreContextValue {
  shopperId: string;
  settings: AppSettings | undefined;
  cart: Cart | undefined;
  wishlist: Set<string>;
  toggleSaved: (designId: string, name?: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** Shopper-scoped live state shared by every storefront page: cart, wishlist and settings. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const shopperId = useShopperId();
  const settings = useSettings();
  const { data: cart } = useLive(() => getCart(shopperId), [shopperId]);
  const { data: saved } = useLive(() => listWishlistDesignIds(shopperId), [shopperId]);
  const wishlist = useMemo(() => new Set(saved ?? []), [saved]);

  const toggleSaved = useCallback(
    async (designId: string, name?: string) => {
      try {
        const added = await toggleWishlist(shopperId, designId);
        toast.success(added ? "Saved to your wishlist" : "Removed from wishlist", { description: name });
      } catch (e) {
        toast.error(errorMessage(e));
      }
    },
    [shopperId],
  );

  const value = useMemo(() => ({ shopperId, settings, cart, wishlist, toggleSaved }), [shopperId, settings, cart, wishlist, toggleSaved]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
