/**
 * useAction returns undefined both on failure and for services that return nothing.
 * Wrapping a void service makes success observable as `true`.
 */
export function withOk<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A): Promise<true> => {
    await fn(...args);
    return true;
  };
}
