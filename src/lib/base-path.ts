/** Sub-path the app is served from (e.g. "/Saree-Pos" on GitHub Pages). Empty in development. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes an app path for plain <a> tags and absolute URLs. next/link and the router add it automatically. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
