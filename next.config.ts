import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable static optimization to prevent prerendering errors
  experimental: {
    // Optimize for Docker/production builds
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};
