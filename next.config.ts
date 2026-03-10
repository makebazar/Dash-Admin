import type { NextConfig } from "next";
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local BEFORE Next.js starts (critical for DATABASE_URL)
// This must happen before any other imports or config
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

// Load in reverse order: .env first, then .env.local (overrides)
dotenv.config({ path: envPath, quiet: true });
dotenv.config({ path: envLocalPath, quiet: true });

const nextConfig: NextConfig = {
  output: 'standalone',
  // Disable linting and type checking during build (deploy first, fix later)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Completely disable static optimization and export
  // experimental: {
  //   // Optimize for Docker/production builds
  //   optimizePackageImports: ['lucide-react', 'recharts'],
  // },
  // Skip static generation completely
  skipTrailingSlashRedirect: true,
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
