/**
 * Custom Image Loader for CDN Integration
 * 
 * Provides optimized image loading with CDN support
 */

import { ImageLoaderProps } from 'next/image'
import { AssetOptimizer } from './asset-optimizer'
import { ApplicationLogger } from '@/lib/logging'

export interface CDNImageConfig {
  baseUrl: string
  enableOptimization: boolean
  defaultQuality: number
  supportedFormats: string[]
  enableWebP: boolean
  enableAVIF: boolean
}

const getConfig = (): CDNImageConfig => ({
  baseUrl: process.env.CDN_BASE_URL || '',
  enableOptimization: true,
  defaultQuality: 75,
  supportedFormats: ['webp', 'avif', 'jpeg', 'png'],
  enableWebP: true,
  enableAVIF: true,
})

/**
 * Custom image loader for Next.js Image component
 */
export default function cdnImageLoader({ src, width, quality }: ImageLoaderProps): string {
  const timer = ApplicationLogger.timer('cdn_image_loader', {
    component: 'cdn-image-loader',
    metadata: { src, width, quality }
  })

  try {
    const config = getConfig()
    
    // If CDN is not configured, return original src
    if (!config.baseUrl) {
      timer.end('CDN not configured, using original src')
      return src
    }

    // Build optimized image URL
    const optimizedUrl = AssetOptimizer.getAssetUrl(src, {
      width,
      quality: quality || config.defaultQuality,
      format: getBestFormat()
    })

    ApplicationLogger.cacheOperation('hit', `image:${src}`, {
      metadata: { 
        optimizedUrl,
        width,
        quality: quality || config.defaultQuality
      }
    })

    timer.end('Image URL optimized successfully')
    return optimizedUrl

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('cdn-image-loader', 'degraded', {
      error: err.message,
      src,
      width,
      quality
    })
    timer.end('Image loader failed, using fallback')
    
    // Fallback to original src
    return src
  }
}

/**
 * Get the best image format based on browser support
 */
function getBestFormat(): 'avif' | 'webp' | 'jpeg' {
  // In a real implementation, you would detect browser support
  // For now, we'll default to webp as it has good support
  const config = getConfig()
  
  if (config.enableAVIF) {
    return 'avif'
  }
  
  if (config.enableWebP) {
    return 'webp'
  }
  
  return 'jpeg'
}

/**
 * Generate responsive image srcset for CDN
 */
export function generateResponsiveSrcSet(
  src: string,
  sizes: number[],
  quality?: number
): string {
  const timer = ApplicationLogger.timer('generate_responsive_srcset', {
    component: 'cdn-image-loader',
    metadata: { src, sizes: sizes.length }
  })

  try {
    const srcSet = sizes
      .map(size => {
        const url = cdnImageLoader({ 
          src, 
          width: size, 
          quality: quality || getConfig().defaultQuality 
        })
        return `${url} ${size}w`
      })
      .join(', ')

    ApplicationLogger.businessOperation('generate_srcset', 'cdn-image-loader', 'performance', {
      metadata: { 
        src,
        sizesCount: sizes.length,
        duration: timer.end()
      }
    })

    return srcSet

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('cdn-image-loader', 'degraded', {
      error: err.message,
      src,
      sizes
    })
    timer.end('SrcSet generation failed')
    
    // Fallback to single size
    return `${src} 1x`
  }
}

/**
 * Generate optimized image props for Next.js Image component
 */
export function getOptimizedImageProps(
  src: string,
  alt: string,
  options: {
    width?: number
    height?: number
    quality?: number
    priority?: boolean
    sizes?: string
    fill?: boolean
  } = {}
) {
  const config = getConfig()
  
  const props: any = {
    src,
    alt,
    loader: cdnImageLoader,
    quality: options.quality || config.defaultQuality,
    priority: options.priority || false,
  }

  // Add dimensions if provided
  if (options.width) props.width = options.width
  if (options.height) props.height = options.height
  if (options.fill) props.fill = options.fill
  if (options.sizes) props.sizes = options.sizes

  // Add placeholder for better UX
  props.placeholder = 'blur'
  props.blurDataURL = generateBlurDataURL()

  ApplicationLogger.businessOperation('get_optimized_props', 'cdn-image-loader', 'image', {
    metadata: { src, hasWidth: !!options.width, hasHeight: !!options.height }
  })

  return props
}

/**
 * Generate blur data URL for placeholder
 */
function generateBlurDataURL(): string {
  // Simple 1x1 transparent pixel as base64
  return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=='
}

/**
 * Preload critical images
 */
export function preloadCriticalImages(imageSrcs: string[]): void {
  if (typeof window === 'undefined') return

  const timer = ApplicationLogger.timer('preload_critical_images', {
    component: 'cdn-image-loader',
    metadata: { imageCount: imageSrcs.length }
  })

  try {
    imageSrcs.forEach(src => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = cdnImageLoader({ src, width: 1920, quality: getConfig().defaultQuality })
      document.head.appendChild(link)
    })

    ApplicationLogger.businessOperation('preload_images', 'cdn-image-loader', 'performance', {
      metadata: { 
        imageCount: imageSrcs.length,
        duration: timer.end()
      }
    })

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('cdn-image-loader', 'degraded', {
      error: err.message,
      imageCount: imageSrcs.length
    })
    timer.end('Image preloading failed')
  }
}

/**
 * Get CDN configuration
 */
export function getCDNConfig(): CDNImageConfig {
  return getConfig()
}

/**
 * Update CDN configuration (for testing)
 */
export function updateCDNConfig(newConfig: Partial<CDNImageConfig>): void {
  // For testing, we can temporarily override environment variables
  if (newConfig.baseUrl !== undefined) {
    process.env.CDN_BASE_URL = newConfig.baseUrl
  }
  
  ApplicationLogger.businessOperation('config_updated', 'cdn-image-loader', 'config', {
    metadata: { updatedFields: Object.keys(newConfig) }
  })
}