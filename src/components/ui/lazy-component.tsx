'use client'

import { Suspense, lazy, ComponentType, useEffect, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ErrorInfo } from 'react'

interface LazyComponentProps {
  fallback?: React.ReactNode
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

// Loading skeleton components
export const LoadingSkeleton = {
  Card: () => (
    <div className="animate-pulse">
      <div className="bg-gray-200 rounded-lg h-32 w-full mb-4"></div>
      <div className="space-y-2">
        <div className="bg-gray-200 rounded h-4 w-3/4"></div>
        <div className="bg-gray-200 rounded h-4 w-1/2"></div>
      </div>
    </div>
  ),
  
  Table: () => (
    <div className="animate-pulse space-y-4">
      <div className="bg-gray-200 rounded h-8 w-full"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex space-x-4">
          <div className="bg-gray-200 rounded h-6 w-1/4"></div>
          <div className="bg-gray-200 rounded h-6 w-1/3"></div>
          <div className="bg-gray-200 rounded h-6 w-1/4"></div>
          <div className="bg-gray-200 rounded h-6 w-1/6"></div>
        </div>
      ))}
    </div>
  ),
  
  Form: () => (
    <div className="animate-pulse space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="bg-gray-200 rounded h-4 w-1/4"></div>
          <div className="bg-gray-200 rounded h-10 w-full"></div>
        </div>
      ))}
      <div className="bg-gray-200 rounded h-10 w-32"></div>
    </div>
  ),
  
  Dashboard: () => (
    <div className="animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-lg h-24"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-200 rounded-lg h-64"></div>
        <div className="bg-gray-200 rounded-lg h-64"></div>
      </div>
    </div>
  )
}

// Error fallback components
const DefaultErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <h3 className="text-lg font-semibold text-red-800 mb-2">
      Error al cargar el componente
    </h3>
    <p className="text-red-600 mb-4">
      {error.message || 'Ha ocurrido un error inesperado'}
    </p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
    >
      Reintentar
    </button>
  </div>
)

// Higher-order component for lazy loading
export function withLazyLoading<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentProps = {}
) {
  const LazyComponent = lazy(importFn)
  
  return function LazyWrapper(props: P) {
    const {
      fallback = <LoadingSkeleton.Card />,
      errorFallback = DefaultErrorFallback,
      onError
    } = options

    return (
      <ErrorBoundary
        FallbackComponent={errorFallback}
        onError={onError}
        onReset={() => window.location.reload()}
      >
        <Suspense fallback={fallback}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  }
}

// Intersection Observer hook for lazy loading on scroll
export function useLazyLoad(threshold: number = 0.1) {
  const [isVisible, setIsVisible] = useState(false)
  const [ref, setRef] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(ref)
        }
      },
      { threshold }
    )

    observer.observe(ref)

    return () => {
      if (ref) observer.unobserve(ref)
    }
  }, [ref, threshold])

  return [setRef, isVisible] as const
}

// Lazy load component with intersection observer
export function LazyLoadOnScroll({
  children,
  fallback = <LoadingSkeleton.Card />,
  threshold = 0.1,
  className
}: {
  children: React.ReactNode
  fallback?: React.ReactNode
  threshold?: number
  className?: string
}) {
  const [ref, isVisible] = useLazyLoad(threshold)

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : fallback}
    </div>
  )
}

// Preload function for critical components
export function preloadComponent(importFn: () => Promise<any>) {
  // Preload the component module
  importFn()
}

// Lazy load specific components
export const LazyComponents = {
  TicketTable: lazy(() => import('@/components/tickets/ticket-table').then(module => ({ default: module.TicketTable }))),
  
  Dashboard: withLazyLoading(
    () => import('@/components/dashboard/dashboard'),
    { fallback: <LoadingSkeleton.Dashboard /> }
  ),
}