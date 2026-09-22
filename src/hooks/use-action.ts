"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/domain/errors";

/**
 * Wraps a service call with pending state and error toasts. Returns the result, or undefined
 * when the call failed (the error has already been shown). Services that return nothing
 * resolve to `true` on success so callers can always test `result !== undefined`.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: { success?: string | ((r: R) => string) } = {}) {
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setPending(true);
      try {
        const result = await fn(...args);
        if (options.success) toast.success(typeof options.success === "function" ? options.success(result) : options.success);
        return (result === undefined ? true : result) as R;
      } catch (e) {
        toast.error(errorMessage(e));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn],
  );
  return { run, pending };
}
