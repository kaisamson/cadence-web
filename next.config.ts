import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    // The app collapsed to a single dashboard; keep old bookmarks and any
    // Home Screen shortcut pointing somewhere useful.
    return [
      { source: "/today", destination: "/dashboard", permanent: false },
      { source: "/goals", destination: "/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
