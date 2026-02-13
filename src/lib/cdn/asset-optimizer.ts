/**
 * CDN and Static Asset Optimization Service
 * 
 * Provides comprehensive asset optimization including:
 * - CDN configuration and management
 * - Asset compression and minification
 * - Cache headers optimization
 * - Performance monitoring
 */

import { ApplicationLogger } from '@/lib/logging'

export interface AssetOptimizationConfig {
  cdnEnabled: boolean
  cdnBaseUrl?: string
  compressionEnabled: boolean
  minificationEnabled: boolean
  cacheMaxAge: number
  preloadCriticalAssets: boolean
  lazyLoadImages: boolean
  webpConversion: boolean
  gzipCompression: boolean
  brotliCompression: boolean
}

export interface AssetMetrics {
  originalSize: number
  compressedSize: number
  compressionRatio: number
  loadTime: number
  cacheHitRate?: number
}

export class AssetOptimizer {
  private static getConfig(): AssetOptimizationConfig {
    return {
      cdnEnabled: process.env.CDN_ENABLED === 'true',
      cdnBaseUrl: process.env.CDN_BASE_URL,
      compressionEnabled: true,
      minificationEnabled: process.env.NODE_ENV === 'production',
      cacheMaxAge: 31536000, // 1 year
      preloadCriticalAssets: true,
      lazyLoadImages: true,
      webpConversion: true,
      gzipCompression: true,
      brotliCompression: true,
    }
  }

  /**
   * Get optimized asset URL with CDN support
   */
  static getAssetUrl(assetPath: string, options: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'avif' | 'jpeg' | 'png'
  } = {}): string {
    const config = this.getConfig()
    const timer = ApplicationLogger.timer('get_asset_url', {
      component: 'asset-optimizer',
      metadata: { assetPath, options }
    })

    try {
      let url = assetPath

      // Use CDN if enabled
      if (config.cdnEnabled && config.cdnBaseUrl) {
        url = `${config.cdnBaseUrl}${assetPath}`
        
        ApplicationLogger.cacheOperation('hit', `cdn:${assetPath}`, {
          metadata: { cdnUrl: url }
        })
      }

      // Add optimization parameters for images
      if (this.isImageAsset(assetPath)) {
        url = this.addImageOptimizationParams(url, options)
      }

      timer.end('Asset URL generated successfully')
      return url

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.systemHealth('asset-optimizer', 'degraded', {
        error: err.message,
        assetPath
      })
      timer.end('Failed to generate asset URL')
      
      // Fallback to original path
      return assetPath
    }
  }

  /**
   * Generate cache headers for static assets
   */
  static getCacheHeaders(assetPath: string): Record<string, string> {
    const config = this.getConfig()
    const headers: Record<string, string> = {}

    // Determine cache strategy based on asset type
    if (this.isStaticAsset(assetPath)) {
      // Static assets with hash - long cache
      headers['Cache-Control'] = `public, max-age=${config.cacheMaxAge}, immutable`
      headers['ETag'] = this.generateETag(assetPath)
    } else if (this.isImageAsset(assetPath)) {
      // Images - medium cache with revalidation
      headers['Cache-Control'] = 'public, max-age=86400, stale-while-revalidate=31536000'
    } else {
      // Other assets - short cache
      headers['Cache-Control'] = 'public, max-age=3600'
    }

    // Compression headers
    if (config.gzipCompression) {
      headers['Content-Encoding'] = 'gzip'
    }

    if (config.brotliCompression) {
      headers['Content-Encoding'] = 'br'
    }

    // Security headers for assets
    headers['X-Content-Type-Options'] = 'nosniff'
    headers['Cross-Origin-Resource-Policy'] = 'cross-origin'

    ApplicationLogger.cacheOperation('set', assetPath, {
      metadata: { headers }
    })

    return headers
  }

  /**
   * Preload critical assets
   */
  static generatePreloadLinks(criticalAssets: string[]): string[] {
    const config = this.getConfig()
    const preloadLinks: string[] = []

    if (!config.preloadCriticalAssets) {
      return preloadLinks
    }

    for (const asset of criticalAssets) {
      const assetType = this.getAssetType(asset)
      const optimizedUrl = this.getAssetUrl(asset)

      let preloadLink = `<${optimizedUrl}>; rel=preload`

      switch (assetType) {
        case 'css':
          preloadLink += '; as=style'
          break
        case 'js':
          preloadLink += '; as=script'
          break
        case 'font':
          preloadLink += '; as=font; type=font/woff2; crossorigin'
          break
        case 'image':
          preloadLink += '; as=image'
          break
      }

      preloadLinks.push(preloadLink)
    }

    ApplicationLogger.businessOperation('preload_assets', 'asset-optimizer', 'performance', {
      metadata: { assetCount: criticalAssets.length }
    })

    return preloadLinks
  }

  /**
   * Generate resource hints for performance
   */
  static generateResourceHints(): {
    dnsPrefetch: string[]
    preconnect: string[]
    prefetch: string[]
  } {
    const config = this.getConfig()
    const hints = {
      dnsPrefetch: [] as string[],
      preconnect: [] as string[],
      prefetch: [] as string[]
    }

    // DNS prefetch for CDN
    if (config.cdnEnabled && config.cdnBaseUrl) {
      const cdnDomain = new URL(config.cdnBaseUrl).hostname
      hints.dnsPrefetch.push(cdnDomain)
      hints.preconnect.push(config.cdnBaseUrl)
    }

    // Common external domains
    const externalDomains = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'cdn.jsdelivr.net'
    ]

    hints.dnsPrefetch.push(...externalDomains)

    return hints
  }

  /**
   * Compress asset content
   */
  static async compressAsset(content: Buffer, type: 'gzip' | 'brotli' = 'gzip'): Promise<{
    compressed: Buffer
    metrics: AssetMetrics
  }> {
    const timer = ApplicationLogger.timer('compress_asset', {
      component: 'asset-optimizer',
      metadata: { type, originalSize: content.length }
    })

    try {
      let compressed: Buffer

      if (type === 'gzip') {
        const zlib = await import('zlib')
        compressed = zlib.gzipSync(content, { level: 9 })
      } else {
        const zlib = await import('zlib')
        compressed = zlib.brotliCompressSync(content, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: content.length
          }
        })
      }

      const metrics: AssetMetrics = {
        originalSize: content.length,
        compressedSize: compressed.length,
        compressionRatio: (1 - compressed.length / content.length) * 100,
        loadTime: 0 // Will be measured on client side
      }

      ApplicationLogger.businessOperation('compress_asset', 'asset-optimizer', 'performance', {
        metadata: { 
          type,
          compressionRatio: metrics.compressionRatio.toFixed(2) + '%',
          sizeSaved: content.length - compressed.length,
          duration: timer.end()
        }
      })

      return { compressed, metrics }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      ApplicationLogger.systemHealth('asset-optimizer', 'degraded', {
        error: err.message,
        operation: 'compression'
      })
      timer.end('Asset compression failed')
      throw error
    }
  }

  /**
   * Minify CSS content
   */
  static minifyCSS(css: string): string {
    const config = this.getConfig()
    if (!config.minificationEnabled) {
      return css
    }

    const timer = ApplicationLogger.timer('minify_css', {
      component: 'asset-optimizer'
    })

    try {
      // Basic CSS minification
      const minified = css
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove unnecessary semicolons
        .replace(/\s*{\s*/g, '{') // Clean braces
        .replace(/\s*}\s*/g, '}')
        .replace(/\s*,\s*/g, ',') // Clean commas
        .replace(/\s*:\s*/g, ':') // Clean colons
        .replace(/\s*;\s*/g, ';') // Clean semicolons
        .trim()

      const savings = ((css.length - minified.length) / css.length * 100).toFixed(2)
      
      ApplicationLogger.businessOperation('minify_css', 'asset-optimizer', 'performance', {
        metadata: { 
          originalSize: css.length,
          minifiedSize: minified.length,
          savings: savings + '%',
          duration: timer.end()
        }
      })

      return minified

    } catch (error) {
      ApplicationLogger.systemHealth('asset-optimizer', 'degraded', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'css_minification'
      })
      timer.end('CSS minification failed')
      return css // Return original on error
    }
  }

  /**
   * Generate WebP version of image
   */
  static async generateWebP(imagePath: string): Promise<string | null> {
    const config = this.getConfig()
    if (!config.webpConversion) {
      return null
    }

    const timer = ApplicationLogger.timer('generate_webp', {
      component: 'asset-optimizer',
      metadata: { imagePath }
    })

    try {
      // In a real implementation, you would use Sharp or similar
      // For now, we'll simulate the WebP path generation
      const webpPath = imagePath.replace(/\.(jpg|jpeg|png)$/i, '.webp')
      
      ApplicationLogger.businessOperation('generate_webp', 'asset-optimizer', 'performance', {
        metadata: { originalPath: imagePath, webpPath, duration: timer.end() }
      })

      return webpPath

    } catch (error) {
      ApplicationLogger.systemHealth('asset-optimizer', 'degraded', {
        error: error instanceof Error ? error.message : String(error),
        operation: 'webp_generation'
      })
      timer.end('WebP generation failed')
      return null
    }
  }

  /**
   * Monitor asset performance
   */
  static trackAssetPerformance(assetPath: string, loadTime: number, size: number): void {
    ApplicationLogger.businessOperation('track_asset_performance', 'asset-optimizer', 'performance', {
      metadata: {
        assetPath,
        size,
        sizeKB: (size / 1024).toFixed(2) + 'KB',
        loadTime
      }
    })

    // Track performance thresholds
    if (loadTime > 1000) { // > 1 second
      ApplicationLogger.systemHealth('asset-optimizer', 'degraded', {
        slowAsset: assetPath,
        loadTime,
        threshold: 1000
      })
    }

    if (size > 1024 * 1024) { // > 1MB
      ApplicationLogger.systemHealth('asset-optimizer', 'degraded', {
        largeAsset: assetPath,
        size,
        sizeKB: (size / 1024).toFixed(2) + 'KB'
      })
    }
  }

  // Private helper methods
  private static isImageAsset(path: string): boolean {
    return /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(path)
  }

  private static isStaticAsset(path: string): boolean {
    return path.includes('/_next/static/') || path.includes('.hash.')
  }

  private static getAssetType(path: string): string {
    if (/\.css$/i.test(path)) return 'css'
    if (/\.js$/i.test(path)) return 'js'
    if (/\.(woff|woff2|ttf|otf)$/i.test(path)) return 'font'
    if (this.isImageAsset(path)) return 'image'
    return 'other'
  }

  private static addImageOptimizationParams(url: string, options: {
    width?: number
    height?: number
    quality?: number
    format?: string
  }): string {
    const params = new URLSearchParams()

    if (options.width) params.set('w', options.width.toString())
    if (options.height) params.set('h', options.height.toString())
    if (options.quality) params.set('q', options.quality.toString())
    if (options.format) params.set('f', options.format)

    const separator = url.includes('?') ? '&' : '?'
    return params.toString() ? `${url}${separator}${params.toString()}` : url
  }

  private static generateETag(assetPath: string): string {
    // Simple ETag generation based on path and timestamp
    const hash = Buffer.from(assetPath + Date.now()).toString('base64')
    return `"${hash.substring(0, 16)}"`
  }

  /**
   * Get current configuration (returns fresh config from environment)
   */
  static getCurrentConfig(): AssetOptimizationConfig {
    return this.getConfig()
  }

  /**
   * Update configuration (for testing purposes)
   */
  static updateConfig(newConfig: Partial<AssetOptimizationConfig>): void {
    // For testing, we can temporarily override environment variables
    if (newConfig.cdnEnabled !== undefined) {
      process.env.CDN_ENABLED = newConfig.cdnEnabled.toString()
    }
    if (newConfig.cdnBaseUrl !== undefined) {
      process.env.CDN_BASE_URL = newConfig.cdnBaseUrl
    }
    
    ApplicationLogger.businessOperation('config_updated', 'asset-optimizer', 'config', {
      metadata: { updatedFields: Object.keys(newConfig) }
    })
  }
}