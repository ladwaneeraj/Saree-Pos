"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "./store-context";

export function WishlistButton({ designId, name, className, variant = "floating" }: { designId: string; name: string; className?: string; variant?: "floating" | "outline" }) {
  const { wishlist, toggleSaved } = useStore();
  const saved = wishlist.has(designId);
  return (
    <button
      type="button"
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleSaved(designId, name);
      }}
      className={cn(
        "inline-flex items-center justify-center transition active:scale-90",
        variant === "floating"
          ? "size-9 rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur hover:bg-white"
          : "size-11 rounded-md border bg-background hover:bg-accent",
        className,
      )}
    >
      <Heart className={cn("size-[18px]", saved && "fill-primary text-primary")} />
    </button>
  );
}
