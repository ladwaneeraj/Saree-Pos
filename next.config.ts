import type { NextConfig } from "next";

/**
 * Static export: the app is frontend-only (all data lives in IndexedDB), so it builds to
 * plain files that GitHub Pages can serve. NEXT_PUBLIC_BASE_PATH is set by the Pages
 * workflow to the repository sub-path (e.g. /Saree-Pos) and is empty locally.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
