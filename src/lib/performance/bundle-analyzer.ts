/**
 * Bundle Analysis and Optimization Utilities
 * Provides tools for analyzing and optimizing bundle size
 */

// Dynamic import wrapper with error handling
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  fallback?: T
): Promise<T> {
  try {
    return await importFn()
  } catch (error) {
    console.error('Dynamic import failed:', error)
    if (fallback) {
      return fallback
    }
    throw error
  }
}

// Preload critical resources
export function preloadResource(href: string, as: string = 'script') {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = href
  link.as = as
  document.head.appendChild(link)
}

// Prefetch non-critical resources
export function prefetchResource(href: string) {
  if (typeof window === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = href
  document.head.appendChild(link)
}

// Bundle size analyzer
export class BundleAnalyzer {
  private static instance: BundleAnalyzer
  private loadedModules = new Set<string>()
  private moduleLoadTimes = new Map<string, number>()

  static getInstance(): BundleAnalyzer {
    if (!BundleAnalyzer.instance) {
      BundleAnalyzer.instance = new BundleAnalyzer()
    }
    return BundleAnalyzer.instance
  }

  // Track module loading
  trackModuleLoad(moduleName: string, startTime: number = performance.now()) {
    const endTime = performance.now()
    const loadTime = endTime - startTime
    
    this.loadedModules.add(moduleName)
    this.moduleLoadTimes.set(moduleName, loadTime)
    
    if (process.env.NODE_ENV === 'development') {
      // Log silencioso en desarrollo
    }
  }

  // Get loading statistics
  getStats() {
    const totalModules = this.loadedModules.size
    const totalLoadTime = Array.from(this.moduleLoadTimes.values())
      .reduce((sum, time) => sum + time, 0)
    const avgLoadTime = totalLoadTime / totalModules

    return {
      totalModules,
      totalLoadTime: Math.round(totalLoadTime * 100) / 100,
      avgLoadTime: Math.round(avgLoadTime * 100) / 100,
      slowestModules: this.getSlowestModules(5)
    }
  }

  // Get slowest loading modules
  private getSlowestModules(count: number = 5) {
    return Array.from(this.moduleLoadTimes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, count)
      .map(([name, time]) => ({ name, time: Math.round(time * 100) / 100 }))
  }

  // Clear statistics
  clear() {
    this.loadedModules.clear()
    this.moduleLoadTimes.clear()
  }
}

// Route-based code splitting utilities
export const RouteModules = {
  // Admin routes
  AdminDashboard: () => dynamicImport(() => import('@/app/admin/page')),
  AdminUsers: () => dynamicImport(() => import('@/app/admin/users/page')),
  AdminTickets: () => dynamicImport(() => import('@/app/admin/tickets/page')),
  AdminReports: () => dynamicImport(() => import('@/app/admin/reports/page')),
  AdminSettings: () => dynamicImport(() => import('@/app/admin/settings/page')),
  
  // Client routes
  ClientDashboard: () => dynamicImport(() => import('@/app/client/page')),
  ClientTickets: () => dynamicImport(() => import('@/app/client/tickets/page')),
  CreateTicket: () => dynamicImport(() => import('@/app/client/create-ticket/page')),
  
  // Technician routes
  TechnicianDashboard: () => dynamicImport(() => import('@/app/technician/page')),
  TechnicianTickets: () => dynamicImport(() => import('@/app/technician/tickets/page'))
}

// Component-based code splitting
export const ComponentModules = {
  // Charts and visualizations
  Charts: () => dynamicImport(() => import('recharts')),
  
  // File upload
  FileUpload: () => dynamicImport(() => import('@/components/tickets/file-upload')),
}

// Performance monitoring
export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics = new Map<string, number[]>()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  // Measure function execution time
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    
    this.recordMetric(name, end - start)
    return result
  }

  // Measure async function execution time
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    
    this.recordMetric(name, end - start)
    return result
  }

  // Record a metric
  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
  }

  // Get metric statistics
  getMetricStats(name: string) {
    const values = this.metrics.get(name) || []
    if (values.length === 0) return null

    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)]

    return {
      count: values.length,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      median: Math.round(median * 100) / 100
    }
  }

  // Get all metrics
  getAllMetrics() {
    const result: Record<string, any> = {}
    for (const [name] of this.metrics) {
      result[name] = this.getMetricStats(name)
    }
    return result
  }

  // Clear metrics
  clear() {
    this.metrics.clear()
  }
}

// Web Vitals monitoring
export function measureWebVitals() {
  if (typeof window === 'undefined') return

  // Measure Core Web Vitals
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const monitor = PerformanceMonitor.getInstance()
      
      switch (entry.entryType) {
        case 'largest-contentful-paint':
          monitor.recordMetric('LCP', entry.startTime)
          break
        case 'first-input':
          monitor.recordMetric('FID', (entry as any).processingStart - entry.startTime)
          break
        case 'layout-shift':
          if (!(entry as any).hadRecentInput) {
            monitor.recordMetric('CLS', (entry as any).value)
          }
          break
      }
    }
  })

  observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
}

// Resource loading optimization
export function optimizeResourceLoading() {
  if (typeof window === 'undefined') return

  // Preload critical resources
  preloadResource('/fonts/inter.woff2', 'font')
  preloadResource('/api/dashboard/stats', 'fetch')
  
  // Prefetch likely next pages
  const currentPath = window.location.pathname
  
  if (currentPath === '/') {
    prefetchResource('/login')
  } else if (currentPath === '/login') {
    prefetchResource('/dashboard')
  } else if (currentPath.includes('/admin')) {
    prefetchResource('/admin/tickets')
    prefetchResource('/admin/users')
  }
}

// Bundle size recommendations
export function getBundleOptimizationTips() {
  return [
    {
      category: 'Code Splitting',
      tips: [
        'Use dynamic imports for route-based code splitting',
        'Lazy load non-critical components',
        'Split vendor libraries into separate chunks',
        'Use React.lazy() for component-level splitting'
      ]
    },
    {
      category: 'Tree Shaking',
      tips: [
        'Import only specific functions from libraries',
        'Use ES6 modules instead of CommonJS',
        'Avoid importing entire libraries when only using parts',
        'Configure webpack to eliminate dead code'
      ]
    },
    {
      category: 'Asset Optimization',
      tips: [
        'Optimize images with Next.js Image component',
        'Use WebP format for images when possible',
        'Compress and minify CSS and JavaScript',
        'Use CDN for static assets'
      ]
    },
    {
      category: 'Caching',
      tips: [
        'Implement proper HTTP caching headers',
        'Use service workers for offline caching',
        'Cache API responses with appropriate TTL',
        'Leverage browser caching for static assets'
      ]
    }
  ]
}

export default BundleAnalyzer