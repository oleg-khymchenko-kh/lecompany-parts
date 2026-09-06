import type { NextConfig } from 'next';
import path from 'node:path';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:3011';

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server with a pruned
  // node_modules. This is what gets rsynced to production; no sources ship.
  output: 'standalone',
  // In a monorepo the standalone tracer must start at the repo root,
  // otherwise hoisted dependencies are left out of the bundle.
  outputFileTracingRoot: path.join(process.cwd(), '../../'),
  poweredByHeader: false,
  reactStrictMode: true,

  // In development the browser talks to /api on the Next port and this
  // forwards it. In production nginx does the same job.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
