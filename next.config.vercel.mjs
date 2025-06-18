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
  // Simplify the JavaScript bundling to avoid initialization errors
  swcMinify: false, // Disable SWC minification to avoid variable hoisting issues
  webpack: (config, { isServer }) => {
    // Force webpack to use the 'var' variable declaration style
    // which is hoisted and prevents "cannot access before initialization" errors
    if (!isServer) {
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            ecma: 5, // Use ES5 instead of ES6+
            safari10: true, // Workaround for older browsers
            keep_classnames: true,
            keep_fnames: true,
            compress: {
              ...minimizer.options.terserOptions?.compress,
              arrows: false, // Disable arrow function optimization
              arguments: false, // Disable optimization of function arguments
              ecma: 5 // Use ES5 syntax for compression
            },
            output: {
              ...minimizer.options.terserOptions?.output,
              ecma: 5 // Use ES5 syntax for output
            },
            // Force use of 'var' to avoid 'const'/'let' TDZ issues
            parse: {
              ...minimizer.options.terserOptions?.parse,
              ecma: 5 // Parse as ES5
            }
          };
        }
      });
    }
    return config;
  },
  // Disable all experimental features that might cause bundling issues
  experimental: {
    webpackBuildWorker: false,
    parallelServerBuildTraces: false,
    parallelServerCompiles: false,
    serverComponents: false
  },
  // Skip middleware completely for Vercel deployments
  skipMiddlewareUrlNormalize: true,
  skipTrailingSlashRedirect: true,
  // Disable browser source maps in production
  productionBrowserSourceMaps: false,
  // Use the most compatible output mode
  output: 'standalone',
}

export default nextConfig
