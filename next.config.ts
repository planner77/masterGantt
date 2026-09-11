import type { NextConfig } from "next";

const requestedDistDir = process.env.NEXT_DIST_DIR;
if (requestedDistDir && !/^\.next-[a-z0-9-]+$/.test(requestedDistDir)) {
  throw new Error("NEXT_DIST_DIR must match .next-<lowercase-name>.");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(requestedDistDir ? { distDir: requestedDistDir } : {}),
};

export default nextConfig;
