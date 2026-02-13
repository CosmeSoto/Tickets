'use client'

import { useState, useEffect } from 'react'
import { PerformanceMonitor as PerfMonitor, BundleAnalyzer, measureWebVitals } from '@/lib/performance/bundle-analyzer'

interface PerformanceMetrics {
  LCP?: number // Largest Contentful Paint
  FID?: number // First Input Delay
  CLS?: number // Cumulative Layout Shift
  TTFB?: number // Time to First Byte
  FCP?: number // First Contentful Paint
}

interface BundleStats {
  totalModules: number
  totalLoadTime: number
  avgLoadTime: number
  slowestModules: Array<{ name: string; time: number }>
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({})
  const [bundleStats, setBundleStats] = useState<BundleStats | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return

    // Initialize performance monitoring
    measureWebVitals()
    
    const monitor = PerfMonitor.getInstance()
    const analyzer = BundleAnalyzer.getInstance()

    // Update metrics every 2 seconds
    const interval = setInterval(() => {
      const allMetrics = monitor.getAllMetrics()
      setMetrics({
        LCP: allMetrics.LCP?.avg,
        FID: allMetrics.FID?.avg,
        CLS: allMetrics.CLS?.avg,
        TTFB: allMetrics.TTFB?.avg,
        FCP: allMetrics.FCP?.avg
      })

      setBundleStats(analyzer.getStats())
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // Don't render in production
  if (process.env.NODE_ENV !== 'development') return null

  const getScoreColor = (value: number, thresholds: [number, number]) => {
    if (value <= thresholds[0]) return 'text-green-600'
    if (value <= thresholds[1]) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatTime = (time: number) => {
    if (time < 1000) return `${Math.round(time)}ms`
    return `${(time / 1000).toFixed(2)}s`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Performance Monitor"
      >
        📊
      </button>

      {isVisible && (
        <div className="absolute bottom-12 right-0 bg-card border border-border rounded-lg shadow-xl p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-foreground">Performance Monitor</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-muted-foreground hover:text-muted-foreground"
            >
              ✕
            </button>
          </div>

          {/* Core Web Vitals */}
          <div className="mb-4">
            <h4 className="font-medium text-foreground mb-2">Core Web Vitals</h4>
            <div className="space-y-2 text-sm">
              {metrics.LCP && (
                <div className="flex justify-between">
                  <span>LCP:</span>
                  <span className={getScoreColor(metrics.LCP, [2500, 4000])}>
                    {formatTime(metrics.LCP)}
                  </span>
                </div>
              )}
              {metrics.FID && (
                <div className="flex justify-between">
                  <span>FID:</span>
                  <span className={getScoreColor(metrics.FID, [100, 300])}>
                    {formatTime(metrics.FID)}
                  </span>
                </div>
              )}
              {metrics.CLS && (
                <div className="flex justify-between">
                  <span>CLS:</span>
                  <span className={getScoreColor(metrics.CLS * 1000, [100, 250])}>
                    {metrics.CLS.toFixed(3)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bundle Statistics */}
          {bundleStats && (
            <div className="mb-4">
              <h4 className="font-medium text-foreground mb-2">Bundle Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Modules:</span>
                  <span>{bundleStats.totalModules}</span>
                </div>
                <div className="flex justify-between">
                  <span>Load Time:</span>
                  <span>{formatTime(bundleStats.totalLoadTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Time:</span>
                  <span>{formatTime(bundleStats.avgLoadTime)}</span>
                </div>
              </div>

              {bundleStats.slowestModules.length > 0 && (
                <div className="mt-3">
                  <h5 className="font-medium text-muted-foreground mb-1">Slowest Modules</h5>
                  <div className="space-y-1 text-xs">
                    {bundleStats.slowestModules.slice(0, 3).map((module, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="truncate mr-2" title={module.name}>
                          {module.name.split('/').pop()}
                        </span>
                        <span className="text-red-600">
                          {formatTime(module.time)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Performance Tips */}
          <div className="border-t pt-3">
            <h4 className="font-medium text-foreground mb-2">Quick Tips</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>• LCP should be &lt; 2.5s</div>
              <div>• FID should be &lt; 100ms</div>
              <div>• CLS should be &lt; 0.1</div>
              <div>• Use lazy loading for images</div>
              <div>• Minimize bundle size</div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t pt-3 mt-3">
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  PerfMonitor.getInstance().clear()
                  BundleAnalyzer.getInstance().clear()
                }}
                className="text-xs bg-muted hover:bg-gray-200 px-2 py-1 rounded"
              >
                Clear Stats
              </button>
              <button
                onClick={() => window.location.reload()}
                className="text-xs bg-blue-100 hover:bg-blue-200 px-2 py-1 rounded"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for measuring component render time
export function useRenderTime(componentName: string) {
  useEffect(() => {
    const monitor = PerfMonitor.getInstance()
    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      monitor.recordMetric(`render-${componentName}`, endTime - startTime)
    }
  }, [componentName])
}

// HOC for measuring component performance
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function PerformanceTrackedComponent(props: P) {
    useRenderTime(componentName)
    return <Component {...props} />
  }
}