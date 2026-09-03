import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Excluir paquetes server-only del bundling del client
  serverExternalPackages: ['pdfkit', 'fontkit', 'ioredis'],

  // Performance optimizations
  //
  // optimizeCss (critters) queda DESACTIVADO: recorre las 139 páginas del build
  // extrayendo CSS crítico por página, y ese trabajo de I/O intensivo se vuelve
  // brutalmente lento dentro del filesystem virtualizado de Docker Desktop en
  // macOS (VirtioFS/overlay de la VM Linux) — un `npm run build` que en Linux
  // nativo tarda unos minutos se estiraba a 40+ min o parecía colgado en Mac.
  // El beneficio (CSS crítico inline) es marginal para un dashboard autenticado
  // como este; no aplica a una landing pública donde sí importaría el first paint.
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'recharts', 'date-fns'],
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
        hostname: '**',
      },
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
            value: 'on',
          },
          {
            // SAMEORIGIN en vez de DENY — permite iframes del mismo origen (vista previa de PDFs)
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      // Rutas de archivos para vista previa — no restringir frames del mismo origen
      {
        source: '/api/forms/:id/file',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/admin/forms/:id/attachments/:attachmentId/file',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/news/:id/attachments/:attachmentId/file',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/admin/news/:id/attachments/:attachmentId/file',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/attachments/:id',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/tickets/:ticketId/attachments/:attachmentId',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/inventory/acts/:id/preview',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache',
          },
        ],
      },
      // Enhanced static asset caching
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Font optimization
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin',
          },
        ],
      },
      // CSS and JS optimization
      {
        source: '/:path*\\.(css|js)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      // Service Worker
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
    ]
  },

  // Redirects for performance
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/',
        permanent: false,
      },
      // QR codes apuntan a esta ruta — redirigir a la página pública fuera del layout de inventario
      {
        source: '/inventory/equipment/:id/verify',
        destination: '/verify/equipment/:id',
        permanent: false,
      },
      // Compatibilidad con URLs antiguas de la página pública
      {
        source: '/inventory/equipment/public/:id',
        destination: '/verify/equipment/:id',
        permanent: false,
      },
      // Consumibles / MRO → Suministros (UI)
      {
        source: '/inventory/mro/:id',
        destination: '/inventory/suministros/:id',
        permanent: true,
      },
      {
        source: '/inventory/mro/:id/edit',
        destination: '/inventory/suministros/:id/edit',
        permanent: true,
      },
    ]
  },

  // Rewrites for CDN integration
  async rewrites() {
    const rewrites = []

    // CDN rewrites if enabled
    if (process.env.CDN_ENABLED === 'true' && process.env.CDN_BASE_URL) {
      rewrites.push({
        source: '/cdn-assets/:path*',
        destination: `${process.env.CDN_BASE_URL}/:path*`,
      })
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
    ignoreBuildErrors: true, // Temporalmente ignorar errores para build
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
            },
          },
        },
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
    NEXT_PUBLIC_VAPID_KEY: process.env.VAPID_PUBLIC_KEY || '',
  },
}

export default nextConfig
