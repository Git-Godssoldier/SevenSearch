/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
