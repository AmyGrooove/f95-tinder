import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  output: 'standalone',
  reactStrictMode: true,
  typedRoutes: true,
}

export default nextConfig
