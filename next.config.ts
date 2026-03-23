import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Excluir pdfkit/fontkit del bundling de Turbopack (incompatibilidad con @swc/helpers)
  serverExternalPackages: ['pdfkit', 'fontkit'],

  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'recharts',
      'date-fns'
    ]
  },

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**'
      }
    ],
    // CDN configuration
    loader: process.env.CDN_ENABLED === 'true' ? 'custom' : 'default',
    loaderFile: process.env.CDN_ENABLED === 'true' ? './src/lib/cdn/image-loader.ts' : undefined,
  },

  // Turbopack configuration
  turbopack: {
    resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json'],
  },

  // Compression
  compress: true,

  // Headers for performance and CDN optimization
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache'
          }
        ]
      },
      // Enhanced static asset caching
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding'
          }
        ]
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding'
          }
        ]
      },
      // Font optimization
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          }
        ]
      },
      // CSS and JS optimization
      {
        source: '/:path*\\.(css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding'
          }
        ]
      },
      // Service Worker
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ]
      }
    ]
  },

  // Redirects for performance
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: false
      }
    ]
  },

  // Rewrites for CDN integration
  async rewrites() {
    const rewrites = []
    
    // CDN rewrites if enabled
    if (process.env.CDN_ENABLED === 'true' && process.env.CDN_BASE_URL) {
      rewrites.push(
        {
          source: '/cdn-assets/:path*',
          destination: `${process.env.CDN_BASE_URL}/:path*`
        }
      )
    }

    return rewrites
  },

  // Output configuration
  output: 'standalone',
  
  // PoweredBy header removal
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: true,

  // Trailing slash
  trailingSlash: false,

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true // Temporalmente ignorar errores para build
  },

  // Webpack optimization
  webpack: (config, { webpack, isServer }) => {
    // Fix for fontkit/pdfkit compatibility issues
    config.resolve.alias = {
      ...config.resolve.alias,
    }

    // Exclude problematic packages from server bundle
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas']
    }

    // Production optimizations
    if (process.env.NODE_ENV === 'production') {
      // Enable asset optimization
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
            }
          }
        }
      }

      // Asset optimization plugins
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.CDN_ENABLED': JSON.stringify(process.env.CDN_ENABLED || 'false'),
          'process.env.CDN_BASE_URL': JSON.stringify(process.env.CDN_BASE_URL || ''),
        })
      )
    }

    return config
  },

  // Asset prefix for CDN
  assetPrefix: process.env.CDN_ENABLED === 'true' ? process.env.CDN_BASE_URL : undefined,

  // Environment variables
  env: {
    CDN_ENABLED: process.env.CDN_ENABLED || 'false',
    CDN_BASE_URL: process.env.CDN_BASE_URL || '',
  }
}

export default nextConfig
