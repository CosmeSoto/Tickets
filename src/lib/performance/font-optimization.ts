/**
 * Font Optimization Utilities
 * Provides optimized font loading and management
 */

import { useState, useEffect } from 'react'
import { Inter, Roboto_Mono } from 'next/font/google'

// Primary font - Inter
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif'
  ]
})

// Monospace font - Roboto Mono
export const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
  preload: false,
  fallback: [
    'SFMono-Regular',
    'Menlo',
    'Monaco',
    'Consolas',
    'Liberation Mono',
    'Courier New',
    'monospace'
  ]
})

// Font loading optimization
export function optimizeFontLoading() {
  if (typeof window === 'undefined') return

  // Preload critical fonts
  const preloadFont = (href: string, type: string = 'font/woff2') => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = 'font'
    link.type = type
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  }

  // Preload Inter font variants
  preloadFont('/fonts/inter-latin-400-normal.woff2')
  preloadFont('/fonts/inter-latin-500-normal.woff2')
  preloadFont('/fonts/inter-latin-600-normal.woff2')
  preloadFont('/fonts/inter-latin-700-normal.woff2')
}

// Font display optimization
export const fontDisplayClasses = {
  // Optimized for performance
  swap: 'font-display-swap',
  fallback: 'font-display-fallback',
  optional: 'font-display-optional',
  
  // Font weights
  thin: 'font-thin',
  light: 'font-light',
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
  
  // Font sizes optimized for readability
  xs: 'text-xs',
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl'
}

// Font loading strategy
export class FontLoadingStrategy {
  private static instance: FontLoadingStrategy
  private loadedFonts = new Set<string>()
  private fontLoadPromises = new Map<string, Promise<void>>()

  static getInstance(): FontLoadingStrategy {
    if (!FontLoadingStrategy.instance) {
      FontLoadingStrategy.instance = new FontLoadingStrategy()
    }
    return FontLoadingStrategy.instance
  }

  // Load font with fallback
  async loadFont(fontFamily: string, fontWeight: string = '400'): Promise<void> {
    const fontKey = `${fontFamily}-${fontWeight}`
    
    if (this.loadedFonts.has(fontKey)) {
      return Promise.resolve()
    }

    if (this.fontLoadPromises.has(fontKey)) {
      return this.fontLoadPromises.get(fontKey)!
    }

    const loadPromise = this.loadFontInternal(fontFamily, fontWeight)
    this.fontLoadPromises.set(fontKey, loadPromise)
    
    try {
      await loadPromise
      this.loadedFonts.add(fontKey)
    } catch (error) {
      console.warn(`Failed to load font: ${fontKey}`, error)
      this.fontLoadPromises.delete(fontKey)
    }
  }

  private async loadFontInternal(fontFamily: string, fontWeight: string): Promise<void> {
    if (!('fonts' in document)) {
      return Promise.resolve()
    }

    const font = new FontFace(fontFamily, `url(/fonts/${fontFamily.toLowerCase()}-${fontWeight}.woff2)`, {
      weight: fontWeight,
      display: 'swap'
    })

    try {
      const loadedFont = await font.load()
      document.fonts.add(loadedFont)
    } catch (error) {
      throw new Error(`Font loading failed: ${fontFamily}`)
    }
  }

  // Preload critical fonts
  async preloadCriticalFonts(): Promise<void> {
    const criticalFonts = [
      { family: 'Inter', weight: '400' },
      { family: 'Inter', weight: '500' },
      { family: 'Inter', weight: '600' }
    ]

    await Promise.all(
      criticalFonts.map(font => this.loadFont(font.family, font.weight))
    )
  }

  // Check if font is loaded
  isFontLoaded(fontFamily: string, fontWeight: string = '400'): boolean {
    return this.loadedFonts.has(`${fontFamily}-${fontWeight}`)
  }

  // Get loaded fonts
  getLoadedFonts(): string[] {
    return Array.from(this.loadedFonts)
  }
}

// Font performance metrics
export class FontPerformanceTracker {
  private static instance: FontPerformanceTracker
  private metrics = new Map<string, { loadTime: number; size?: number }>()

  static getInstance(): FontPerformanceTracker {
    if (!FontPerformanceTracker.instance) {
      FontPerformanceTracker.instance = new FontPerformanceTracker()
    }
    return FontPerformanceTracker.instance
  }

  // Track font loading performance
  trackFontLoad(fontName: string, loadTime: number, size?: number) {
    this.metrics.set(fontName, { loadTime, size })
  }

  // Get font metrics
  getFontMetrics(fontName: string) {
    return this.metrics.get(fontName)
  }

  // Get all font metrics
  getAllMetrics() {
    return Object.fromEntries(this.metrics)
  }

  // Get font loading summary
  getSummary() {
    const metrics = Array.from(this.metrics.values())
    const totalLoadTime = metrics.reduce((sum, metric) => sum + metric.loadTime, 0)
    const avgLoadTime = metrics.length > 0 ? totalLoadTime / metrics.length : 0
    const totalSize = metrics.reduce((sum, metric) => sum + (metric.size || 0), 0)

    return {
      totalFonts: metrics.length,
      totalLoadTime: Math.round(totalLoadTime * 100) / 100,
      avgLoadTime: Math.round(avgLoadTime * 100) / 100,
      totalSize: Math.round(totalSize / 1024), // KB
      avgSize: metrics.length > 0 ? Math.round(totalSize / metrics.length / 1024) : 0 // KB
    }
  }
}

// CSS-in-JS font utilities
export const fontStyles = {
  // Optimized font stacks
  sans: {
    fontFamily: 'var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
    fontVariationSettings: 'normal'
  },
  
  mono: {
    fontFamily: 'var(--font-roboto-mono), SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontFeatureSettings: '"liga" 0, "calt" 0'
  },

  // Performance-optimized text rendering
  optimized: {
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    fontSmooth: 'always'
  }
}

// Font loading hook
export function useFontLoading(fonts: Array<{ family: string; weight?: string }>) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fontLoader = FontLoadingStrategy.getInstance()
    
    Promise.all(
      fonts.map(font => fontLoader.loadFont(font.family, font.weight))
    )
    .then(() => setIsLoaded(true))
    .catch(err => setError(err.message))
  }, [fonts])

  return { isLoaded, error }
}

// Font optimization recommendations
export function getFontOptimizationTips() {
  return [
    {
      category: 'Loading Strategy',
      tips: [
        'Use font-display: swap for non-critical fonts',
        'Preload critical fonts in document head',
        'Use system fonts as fallbacks',
        'Implement progressive font loading'
      ]
    },
    {
      category: 'File Optimization',
      tips: [
        'Use WOFF2 format for modern browsers',
        'Subset fonts to include only needed characters',
        'Use variable fonts when appropriate',
        'Compress font files with Brotli/Gzip'
      ]
    },
    {
      category: 'Performance',
      tips: [
        'Limit the number of font variants',
        'Use font-display: optional for non-critical text',
        'Implement font loading timeouts',
        'Monitor font loading performance'
      ]
    }
  ]
}

export default FontLoadingStrategy