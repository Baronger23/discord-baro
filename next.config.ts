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
        hostname: '69bd2e482a477922072f2fc2610f9bbe.r2.cloudflarestorage.com',
        pathname: '/discord-app/**',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
        pathname: '/**',
      },
      // Giữ lại từ nhánh feat/Pinned-messages
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.giphy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.giphy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media0.giphy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media1.giphy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media2.giphy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media3.giphy.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media4.giphy.com',
        pathname: '/**',
      }
    ],
  },
  
  // Tối ưu bundle size và code splitting
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-icons',
      'emoji-picker-react',
      '@livekit/components-react'
    ],
  },
  
  // Webpack optimization
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Tối ưu client-side bundle
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Tách vendor libraries lớn thành chunks riêng
            livekit: {
              test: /[\\/]node_modules[\\/](@livekit|livekit)[\\/]/,
              name: 'livekit',
              priority: 10,
            },
            emoji: {
              test: /[\\/]node_modules[\\/]emoji-picker-react[\\/]/,
              name: 'emoji-picker',
              priority: 10,
            },
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 9,
            },
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: 'commons',
              priority: 5,
            },
          },
        },
      };
    }
    return config;
  },

};

export default nextConfig;
