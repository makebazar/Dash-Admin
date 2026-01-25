import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Completely disable static optimization
  experimental: {
    // Optimize for Docker/production builds
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  // Force dynamic rendering for all routes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
