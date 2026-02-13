/**
 * Static Asset Middleware
 * 
 * Handles optimization and caching for static assets
 */

import { NextRequest, NextResponse } from 'next/server'
import { AssetOptimizer } from './asset-optimizer'
import { ApplicationLogger } from '@/lib/logging'

export interface StaticAssetConfig {
  enableCompression: boolean
  enableCaching: boolean
  enableOptimization: boolean
  maxAge: number
  compressionThreshold: number // bytes
}

const DEFAULT_CONFIG: StaticAssetConfig = {
  enableCompression: true,
  enableCaching: true,
  enableOptimization: true,
  maxAge: 31536000, // 1 year
  compressionThreshold: 1024, // 1KB
}

export class StaticAssetMiddleware {
  private config: StaticAssetConfig

  constructor(config: Partial<StaticAssetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Handle static asset requests
   */
  async handleAssetRequest(request: NextRequest): Promise<NextResponse | null> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Check if this is a static asset
    if (!this.isStaticAsset(pathname)) {
      return null // Not a static asset, continue to next handler
    }

    const timer = ApplicationLogger.timer('handle_static_asset', {
      component: 'static-asset-middleware',
      metadata: { pathname }
    })

    try {
      // Generate optimized response
      const response = await this.generateOptimizedResponse(request, pathname)
      
      timer.end('Static asset served successfully')
      return response

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.systemHealth('static-asset-middleware', 'degraded', {
        error: err.message,
        pathname
      })
      timer.end('Failed to serve static asset')
      return null // Let Next.js handle it
    }
  }

  /**
   * Generate optimized response for static assets
   */
  private async generateOptimizedResponse(
    request: NextRequest, 
    pathname: string
  ): Promise<NextResponse> {
    const headers = new Headers()

    // Add cache headers
    if (this.config.enableCaching) {
      const cacheHeaders = AssetOptimizer.getCacheHeaders(pathname)
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        headers.set(key, value)
      })
    }

    // Add compression headers
    if (this.config.enableCompression) {
      const acceptEncoding = request.headers.get('accept-encoding') || ''
      
      if (acceptEncoding.includes('br')) {
        headers.set('Content-Encoding', 'br')
      } else if (acceptEncoding.includes('gzip')) {
        headers.set('Content-Encoding', 'gzip')
      }
    }

    // Add performance headers
    headers.set('X-Asset-Optimized', 'true')
    headers.set('X-Cache-Status', 'HIT')

    // Security headers for assets
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin')
    headers.set('Access-Control-Allow-Origin', '*')

    // Log asset serving
    ApplicationLogger.cacheOperation('hit', pathname, {
      metadata: {
        cacheEnabled: this.config.enableCaching,
        compressionEnabled: this.config.enableCompression
      }
    })

    // Create response (in real implementation, you'd serve the actual file)
    return new NextResponse(null, {
      status: 200,
      headers
    })
  }

  /**
   * Check if path is a static asset
   */
  private isStaticAsset(pathname: string): boolean {
    const staticPaths = [
      '/_next/static/',
      '/images/',
      '/icons/',
      '/fonts/',
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml'
    ]

    const staticExtensions = [
      '.css', '.js', '.map',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg',
      '.woff', '.woff2', '.ttf', '.otf',
      '.ico', '.xml', '.txt'
    ]

    return staticPaths.some(path => pathname.startsWith(path)) ||
           staticExtensions.some(ext => pathname.endsWith(ext))
  }

  /**
   * Generate service worker for asset caching
   */
  static generateServiceWorker(): string {
    return `
// Asset Optimization Service Worker
const CACHE_NAME = 'static-assets-v1';
const CACHE_URLS = [
  '/_next/static/',
  '/images/',
  '/icons/',
  '/fonts/'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Asset cache opened');
      return cache.addAll(['/']); // Add critical assets here
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Only cache static assets
  if (CACHE_URLS.some(path => url.pathname.startsWith(path))) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request).then((fetchResponse) => {
          // Cache the new response
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return fetchResponse;
        });
      })
    );
  }
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`
  }
}

/**
 * Middleware function for Next.js
 */
export function createAssetMiddleware(config?: Partial<StaticAssetConfig>) {
  const middleware = new StaticAssetMiddleware(config)
  
  return async (request: NextRequest): Promise<NextResponse | null> => {
    return middleware.handleAssetRequest(request)
  }
}

/**
 * Asset preloading utilities
 */
export class AssetPreloader {
  /**
   * Generate preload headers for critical assets
   */
  static generatePreloadHeaders(criticalAssets: string[]): string {
    const preloadLinks = AssetOptimizer.generatePreloadLinks(criticalAssets)
    return preloadLinks.join(', ')
  }

  /**
   * Generate resource hints
   */
  static generateResourceHints(): {
    dnsPrefetch: string
    preconnect: string
    prefetch: string
  } {
    const hints = AssetOptimizer.generateResourceHints()
    
    return {
      dnsPrefetch: hints.dnsPrefetch.map(domain => `<link rel="dns-prefetch" href="//${domain}">`).join('\n'),
      preconnect: hints.preconnect.map(url => `<link rel="preconnect" href="${url}">`).join('\n'),
      prefetch: hints.prefetch.map(url => `<link rel="prefetch" href="${url}">`).join('\n')
    }
  }

  /**
   * Generate critical CSS inlining
   */
  static async inlineCriticalCSS(html: string, criticalCssPath: string): Promise<string> {
    try {
      // In a real implementation, you would read and inline the critical CSS
      const criticalCSS = '/* Critical CSS would be loaded here */'
      const minifiedCSS = AssetOptimizer.minifyCSS(criticalCSS)
      
      // Inject critical CSS into HTML head
      const injectedHTML = html.replace(
        '</head>',
        `<style>${minifiedCSS}</style></head>`
      )

      ApplicationLogger.businessOperation('inline_critical_css', 'asset-preloader', 'performance', {
        metadata: { 
          cssSize: minifiedCSS.length,
          criticalCssPath 
        }
      })

      return injectedHTML

    } catch (error) {
      ApplicationLogger.systemHealth('asset-preloader', 'degraded', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'critical_css_inlining'
      })
      return html // Return original HTML on error
    }
  }
}