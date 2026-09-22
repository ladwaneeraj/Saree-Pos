"use client";

import { useEffect, useRef, useState } from "react";
import { dataStore } from "@/data";
import { errorMessage } from "@/domain/errors";

export interface LiveResult<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

/**
 * Subscribes to a query and re-renders whenever the data it read changes, including changes
 * made in other tabs. Keeps the previous result while a new one loads to avoid flicker.
 * The query must only read through services/repositories (no network or timers).
 */
export function useLive<T>(query: () => Promise<T>, deps: readonly unknown[]): LiveResult<T> {
  const [state, setState] = useState<LiveResult<T>>({ data: undefined, error: null, loading: true });
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true }));
    const sub = dataStore()
      .observe(() => queryRef.current())
      .subscribe({
        next: (data) => active && setState({ data, error: null, loading: false }),
        error: (e) => active && setState((s) => ({ ...s, error: errorMessage(e), loading: false })),
      });
    return () => {
      active = false;
      sub.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
