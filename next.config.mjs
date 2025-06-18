/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  // Skip middleware completely for Vercel deployments
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  // Production mode
  productionBrowserSourceMaps: false,
}

export default nextConfig
