/**
 * CDN and Asset Optimization - Main Export
 * 
 * Centralized exports for all CDN functionality
 */

// Internal imports for functions
import { getEnvironmentConfig, validateCDNConfig } from './config'

// Core services
export { AssetOptimizer } from './asset-optimizer'
export { StaticAssetMiddleware, createAssetMiddleware, AssetPreloader } from './static-asset-middleware'

// Image optimization
export { default as cdnImageLoader, generateResponsiveSrcSet, getOptimizedImageProps, preloadCriticalImages, getCDNConfig as getImageCDNConfig, updateCDNConfig } from './image-loader'

// Configuration
export { getCDNConfig, validateCDNConfig, getEnvironmentConfig, DEFAULT_CDN_CONFIG, ASSET_TYPES, CACHE_STRATEGIES, PERFORMANCE_THRESHOLDS } from './config'
export type { CDNConfig } from './config'

// Types
export type { AssetOptimizationConfig, AssetMetrics } from './asset-optimizer'
export type { StaticAssetConfig } from './static-asset-middleware'
export type { CDNImageConfig } from './image-loader'

/**
 * Initialize CDN system
 */
export function initializeCDN() {
  const envConfig = getEnvironmentConfig()
  const { config, isDevelopment, isProduction } = envConfig
  
  if (isDevelopment) {
    console.log('🔧 CDN System: Development mode - CDN disabled')
    return { enabled: false, config }
  }
  
  if (isProduction && config.enabled) {
    console.log('🚀 CDN System: Production mode - CDN enabled')
    console.log(`📡 CDN Base URL: ${config.baseUrl}`)
  } else {
    console.log('📦 CDN System: CDN disabled - using local assets')
  }
  
  // Validate configuration
  const errors = validateCDNConfig(config)
  if (errors.length > 0) {
    console.warn('⚠️ CDN Configuration warnings:', errors)
  }
  
  return { enabled: config.enabled, config, errors }
}

/**
 * Get CDN status and metrics
 */
export function getCDNStatus() {
  const envConfig = getEnvironmentConfig()
  const { config } = envConfig
  
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    compression: config.compression.enabled,
    caching: config.cache.enabled,
    imageOptimization: config.images.enabled,
    minification: config.minification.enabled,
    monitoring: config.performance.monitoring
  }
}