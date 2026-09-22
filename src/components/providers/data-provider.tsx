"use client";

import { useEffect, useState, type ReactNode } from "react";
import { errorMessage } from "@/domain/errors";
import { setActorResolver } from "@/services/context";
import { ensureSeeded } from "@/services/demo";
import { sweepExpiredReservations } from "@/services/maintenance";
import { sessionActor } from "@/stores/session";
import { BrandMark } from "@/components/shared/brand";

const SWEEP_INTERVAL_MS = 20_000;

/**
 * Opens the local database, seeds it on first launch and keeps reservations tidy.
 * Renders nothing but a boot screen until the data is ready, which also keeps
 * server and first client render identical (no hydration mismatch).
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"booting" | "ready" | "error">("booting");
  const [stage, setStage] = useState("Opening local database");
  const [error, setError] = useState("");

  useEffect(() => {
    setActorResolver(sessionActor);
    if (typeof indexedDB === "undefined") {
      setError("This browser does not allow local storage (IndexedDB). Open the demo in a regular Chrome, Edge or Safari window.");
      setState("error");
      return;
    }
    ensureSeeded(setStage)
      .then(() => setState("ready"))
      .catch((e) => {
        setError(errorMessage(e));
        setState("error");
      });
  }, []);

  useEffect(() => {
    if (state !== "ready") return;
    const sweep = () => void sweepExpiredReservations().catch(() => undefined);
    sweep();
    const id = setInterval(sweep, SWEEP_INTERVAL_MS);
    const onVisible = () => document.visibilityState === "visible" && sweep();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state]);

  if (state === "ready") return <>{children}</>;
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <BrandMark className="size-12" />
      {state === "error" ? (
        <div className="max-w-sm space-y-2">
          <p className="font-medium">Could not open the demo database</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-display text-3xl">Dhanvi Silks</p>
          <p className="text-sm text-muted-foreground">{stage}…</p>
          <div className="mx-auto h-1 w-40 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 animate-[boot_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
