import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/discord-files/**',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      }
    ],
  },
  
  // ✅ OPTIMIZATION: Webpack & Code Splitting Configuration
  webpack: (config, { dev, isServer }) => {
    // Production optimizations only
    if (!dev && !isServer) {
      // Split vendor chunks for better caching
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // React & Next.js core (changes rarely)
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              name: 'framework',
              priority: 40,
              reuseExistingChunk: true,
            },
            // Clerk authentication (independent updates)
            clerk: {
              test: /[\\/]node_modules[\\/]@clerk[\\/]/,
              name: 'clerk',
              priority: 35,
              reuseExistingChunk: true,
            },
            // LiveKit video (300KB+ - lazy loaded)
            livekit: {
              test: /[\\/]node_modules[\\/](@livekit|livekit-)[\\/]/,
              name: 'livekit',
              priority: 30,
              reuseExistingChunk: true,
            },
            // Socket.IO (critical for real-time)
            socket: {
              test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
              name: 'socket',
              priority: 28,
              reuseExistingChunk: true,
            },
            // UI libraries (Radix, Lucide icons)
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react)[\\/]/,
              name: 'ui-libs',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Heavy dependencies (emoji-picker, dropzone)
            heavy: {
              test: /[\\/]node_modules[\\/](emoji-picker-react|react-dropzone)[\\/]/,
              name: 'heavy-deps',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Other vendor code
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    
    return config;
  },

  // ✅ PERFORMANCE: Experimental features
  experimental: {
    // Enable optimistic client cache for instant navigations
    optimisticClientCache: true,
    // Optimize package imports for smaller bundles
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-tooltip',
    ],
  },

  // ✅ COMPILER: SWC optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // ✅ PRODUCTION: Build optimizations
  productionBrowserSourceMaps: false, // Disable source maps for smaller builds
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
};

export default nextConfig;
