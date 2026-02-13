/**
 * CDN Configuration Management
 * 
 * Centralized configuration for CDN and asset optimization
 */

export interface CDNConfig {
  // CDN Settings
  enabled: boolean
  baseUrl: string
  
  // Asset Optimization
  compression: {
    enabled: boolean
    gzip: boolean
    brotli: boolean
    threshold: number // bytes
  }
  
  // Caching
  cache: {
    enabled: boolean
    maxAge: number
    staleWhileRevalidate: number
  }
  
  // Image Optimization
  images: {
    enabled: boolean
    webpEnabled: boolean
    avifEnabled: boolean
    defaultQuality: number
    responsiveSizes: number[]
  }
  
  // Minification
  minification: {
    enabled: boolean
    css: boolean
    js: boolean
  }
  
  // Performance
  performance: {
    preloadCritical: boolean
    lazyLoad: boolean
    monitoring: boolean
  }
}

/**
 * Default CDN configuration
 */
export const DEFAULT_CDN_CONFIG: CDNConfig = {
  enabled: process.env.CDN_ENABLED === 'true',
  baseUrl: process.env.CDN_BASE_URL || '',
  
  compression: {
    enabled: process.env.ASSET_COMPRESSION_ENABLED !== 'false',
    gzip: true,
    brotli: true,
    threshold: parseInt(process.env.STATIC_ASSET_COMPRESSION_THRESHOLD || '1024')
  },
  
  cache: {
    enabled: process.env.STATIC_ASSET_CACHING_ENABLED !== 'false',
    maxAge: parseInt(process.env.ASSET_CACHE_MAX_AGE || '31536000'), // 1 year
    staleWhileRevalidate: 31536000 // 1 year
  },
  
  images: {
    enabled: process.env.IMAGE_OPTIMIZATION_ENABLED !== 'false',
    webpEnabled: process.env.IMAGE_WEBP_ENABLED !== 'false',
    avifEnabled: process.env.IMAGE_AVIF_ENABLED !== 'false',
    defaultQuality: parseInt(process.env.IMAGE_DEFAULT_QUALITY || '75'),
    responsiveSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840]
  },
  
  minification: {
    enabled: process.env.ASSET_MINIFICATION_ENABLED !== 'false',
    css: true,
    js: true
  },
  
  performance: {
    preloadCritical: true,
    lazyLoad: true,
    monitoring: true
  }
}

/**
 * Get current CDN configuration
 */
export function getCDNConfig(): CDNConfig {
  return { ...DEFAULT_CDN_CONFIG }
}

/**
 * Validate CDN configuration
 */
export function validateCDNConfig(config: Partial<CDNConfig>): string[] {
  const errors: string[] = []
  
  if (config.enabled && !config.baseUrl) {
    errors.push('CDN_BASE_URL is required when CDN is enabled')
  }
  
  if (config.baseUrl && !config.baseUrl.startsWith('https://')) {
    errors.push('CDN_BASE_URL must use HTTPS protocol')
  }
  
  if (config.images?.defaultQuality && (config.images.defaultQuality < 1 || config.images.defaultQuality > 100)) {
    errors.push('Image quality must be between 1 and 100')
  }
  
  if (config.cache?.maxAge && config.cache.maxAge < 0) {
    errors.push('Cache max age must be positive')
  }
  
  return errors
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(): {
  isDevelopment: boolean
  isProduction: boolean
  isTest: boolean
  config: CDNConfig
} {
  const env = process.env.NODE_ENV || 'development'
  
  const baseConfig = getCDNConfig()
  
  // Environment-specific overrides
  if (env === 'development') {
    baseConfig.enabled = false // Disable CDN in development
    baseConfig.minification.enabled = false
    baseConfig.performance.monitoring = false
  }
  
  if (env === 'test') {
    baseConfig.enabled = false
    baseConfig.compression.enabled = false
    baseConfig.cache.enabled = false
  }
  
  return {
    isDevelopment: env === 'development',
    isProduction: env === 'production',
    isTest: env === 'test',
    config: baseConfig
  }
}

/**
 * Asset type detection utilities
 */
export const ASSET_TYPES = {
  images: /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i,
  styles: /\.css$/i,
  scripts: /\.js$/i,
  fonts: /\.(woff|woff2|ttf|otf|eot)$/i,
  static: /\/_next\/static\//,
  public: /^\/(images|icons|fonts|favicon\.ico|robots\.txt|sitemap\.xml)/
} as const

/**
 * Cache strategy definitions
 */
export const CACHE_STRATEGIES = {
  immutable: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'CDN-Cache-Control': 'public, max-age=31536000, immutable'
  },
  longTerm: {
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=31536000',
    'CDN-Cache-Control': 'public, max-age=86400, stale-while-revalidate=31536000'
  },
  shortTerm: {
    'Cache-Control': 'public, max-age=3600',
    'CDN-Cache-Control': 'public, max-age=3600'
  },
  noCache: {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'public, max-age=0, must-revalidate'
  }
} as const

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  slowAssetLoadTime: 1000, // ms
  largeAssetSize: 1024 * 1024, // 1MB
  compressionMinSize: 1024, // 1KB
  criticalAssetCount: 10
} as const