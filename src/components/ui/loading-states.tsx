/**
 * Consolidated Loading States Components
 * Combines the best features from both loading-states.tsx and loading-states-improved.tsx
 * Enhanced with better accessibility, TypeScript support, and modern patterns
 */

'use client'

import * as React from 'react'
import { ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { RefreshCw, Loader2, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import { Button } from './button'
import { Card, CardContent } from './card'
import { cn } from '@/lib/utils'

// ============================================================================
// ENHANCED LOADING SPINNER
// ============================================================================

const spinnerVariants = cva(
  'animate-spin',
  {
    variants: {
      variant: {
        default: 'text-muted-foreground',
        primary: 'text-blue-600',
        secondary: 'text-purple-600',
        success: 'text-green-600',
        warning: 'text-yellow-600',
        error: 'text-red-600',
        white: 'text-white',
      },
      size: {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface LoadingSpinnerProps 
  extends React.HTMLAttributes<HTMLDivElement>,
         VariantProps<typeof spinnerVariants> {
  label?: string
  icon?: 'loader' | 'refresh'
  'data-testid'?: string
}

export const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ 
    variant, 
    size, 
    icon = 'loader',
    className, 
    label = 'Loading...', 
    'data-testid': testId, 
    ...props 
  }, ref) => {
    const IconComponent = icon === 'refresh' ? RefreshCw : Loader2

    return (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        data-testid={testId}
        className={cn('inline-flex items-center justify-center', className)}
        {...props}
      >
        <IconComponent className={spinnerVariants({ variant, size })} />
        <span className="sr-only">{label}</span>
      </div>
    )
  }
)
LoadingSpinner.displayName = 'LoadingSpinner'

// ============================================================================
// ENHANCED LOADING STATE
// ============================================================================

const loadingStateVariants = cva(
  'flex items-center justify-center',
  {
    variants: {
      size: {
        sm: 'py-4',
        md: 'py-8',
        lg: 'py-12',
      },
      variant: {
        default: '',
        card: 'bg-card rounded-lg border border-border shadow-sm',
        fullscreen: 'min-h-screen bg-muted',
        container: 'min-h-96',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'default',
    },
  }
)

export interface LoadingStateProps 
  extends React.HTMLAttributes<HTMLDivElement>,
         VariantProps<typeof loadingStateVariants> {
  message?: string
  showSpinner?: boolean
  spinnerVariant?: VariantProps<typeof spinnerVariants>['variant']
  'data-testid'?: string
}

export const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ 
    size,
    variant,
    message = 'Cargando...',
    showSpinner = true,
    spinnerVariant = 'primary',
    className,
    'data-testid': testId,
    ...props 
  }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(loadingStateVariants({ size, variant }), className)}
        role="status"
        aria-label={message}
        data-testid={testId}
        {...props}
      >
        <div className="flex flex-col items-center space-y-4">
          {showSpinner && (
            <LoadingSpinner 
              size={size === 'sm' ? 'md' : 'xl'} 
              variant={spinnerVariant}
              label={message} 
            />
          )}
          <span className="text-muted-foreground font-medium text-center">{message}</span>
        </div>
      </div>
    )
  }
)
LoadingState.displayName = 'LoadingState'

// ============================================================================
// ENHANCED LOADING BUTTON
// ============================================================================

const loadingButtonVariants = cva(
  'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-muted text-foreground hover:bg-gray-200',
        outline: 'border border-border bg-card hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        sm: 'h-9 px-3 text-sm rounded-md',
        md: 'h-10 px-4 text-sm rounded-md',
        lg: 'h-11 px-6 text-base rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface LoadingButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
         VariantProps<typeof loadingButtonVariants> {
  isLoading?: boolean
  loadingText?: string
  children: React.ReactNode
  'data-testid'?: string
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ 
    variant, 
    size, 
    isLoading = false, 
    loadingText = 'Cargando...', 
    children, 
    className, 
    disabled,
    'data-testid': testId,
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(loadingButtonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        data-testid={testId}
        {...props}
      >
        {isLoading && (
          <LoadingSpinner 
            size={size === 'sm' ? 'xs' : 'sm'} 
            variant="white" 
            className="mr-2" 
            label=""
          />
        )}
        {isLoading ? loadingText : children}
      </button>
    )
  }
)
LoadingButton.displayName = 'LoadingButton'

// ============================================================================
// ERROR STATE COMPONENT
// ============================================================================

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  showIcon?: boolean
  variant?: 'default' | 'network' | 'permission' | 'notFound'
  className?: string
  'data-testid'?: string
}

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  ({
    title,
    message,
    onRetry,
    retryLabel = 'Reintentar',
    showIcon = true,
    variant = 'default',
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    const getIcon = () => {
      switch (variant) {
        case 'network':
          return <WifiOff className="h-12 w-12 text-red-400" />
        case 'permission':
          return <AlertCircle className="h-12 w-12 text-yellow-400" />
        case 'notFound':
          return <AlertCircle className="h-12 w-12 text-muted-foreground" />
        default:
          return <AlertCircle className="h-12 w-12 text-red-400" />
      }
    }

    const getDefaultTitle = () => {
      switch (variant) {
        case 'network':
          return 'Error de conexión'
        case 'permission':
          return 'Sin permisos'
        case 'notFound':
          return 'No encontrado'
        default:
          return 'Error'
      }
    }

    return (
      <div 
        ref={ref}
        className={cn('text-center py-12', className)} 
        role="alert"
        data-testid={testId}
        {...props}
      >
        {showIcon && (
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
        )}
        
        <h3 className="text-lg font-medium text-foreground mb-2">
          {title || getDefaultTitle()}
        </h3>
        
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
          {message}
        </p>
        
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {retryLabel}
          </Button>
        )}
      </div>
    )
  }
)
ErrorState.displayName = 'ErrorState'

// ============================================================================
// EMPTY STATE COMPONENT
// ============================================================================

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
  'data-testid'?: string
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({
    icon,
    title,
    description,
    action,
    className,
    'data-testid': testId,
    ...props
  }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('text-center py-12', className)}
        data-testid={testId}
        {...props}
      >
        {icon && (
          <div className="flex justify-center mb-4">
            {icon}
          </div>
        )}
        
        <h3 className="text-lg font-medium text-foreground mb-2">
          {title}
        </h3>
        
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
          {description}
        </p>
        
        {action}
      </div>
    )
  }
)
EmptyState.displayName = 'EmptyState'

// ============================================================================
// ENHANCED SKELETON COMPONENTS
// ============================================================================

const skeletonVariants = cva(
  'animate-pulse rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-gray-200',
        light: 'bg-muted',
        dark: 'bg-gray-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface SkeletonProps 
  extends React.HTMLAttributes<HTMLDivElement>,
         VariantProps<typeof skeletonVariants> {
  'data-testid'?: string
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant, className, 'data-testid': testId, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(skeletonVariants({ variant }), className)}
        role="status"
        aria-label="Loading content"
        data-testid={testId}
        {...props}
      />
    )
  }
)
Skeleton.displayName = 'Skeleton'

// ============================================================================
// CARD SKELETON
// ============================================================================

export interface CardSkeletonProps {
  className?: string
  'data-testid'?: string
}

export const CardSkeleton = React.forwardRef<HTMLDivElement, CardSkeletonProps>(
  ({ className, 'data-testid': testId }, ref) => {
    return (
      <Card ref={ref} className={className} data-testid={testId}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-3 mb-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-8 w-20 rounded-full" />
            <div className="flex space-x-2">
              <Skeleton className="h-8 w-16 rounded-full" />
              <Skeleton className="h-8 w-16 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
)
CardSkeleton.displayName = 'CardSkeleton'

// ============================================================================
// TABLE COMPONENTS
// ============================================================================

interface TableLoadingStateProps {
  columns: number
  rows?: number
  message?: string
}

export function TableLoadingState({ 
  columns, 
  rows = 5,
  message = 'Cargando datos...' 
}: TableLoadingStateProps) {
  return (
    <tr>
      <td colSpan={columns} className="text-center py-8">
        <LoadingState message={message} />
      </td>
    </tr>
  )
}

interface TableErrorStateProps {
  columns: number
  message: string
  onRetry?: () => void
  retryLabel?: string
}

export function TableErrorState({ 
  columns, 
  message,
  onRetry,
  retryLabel = 'Reintentar'
}: TableErrorStateProps) {
  return (
    <tr>
      <td colSpan={columns} className="text-center py-8">
        <ErrorState 
          message={message}
          onRetry={onRetry}
          retryLabel={retryLabel}
        />
      </td>
    </tr>
  )
}

interface TableEmptyStateProps {
  columns: number
  title: string
  description: string
  action?: ReactNode
}

export function TableEmptyState({ 
  columns, 
  title,
  description,
  action
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={columns} className="text-center py-8">
        <EmptyState 
          title={title}
          description={description}
          action={action}
        />
      </td>
    </tr>
  )
}

export interface TableSkeletonProps {
  rows?: number
  columns?: number
  className?: string
  'data-testid'?: string
}

export const TableSkeleton = React.forwardRef<HTMLDivElement, TableSkeletonProps>(
  ({ rows = 5, columns = 4, className, 'data-testid': testId }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('rounded-lg border border-border bg-card', className)}
        role="status"
        aria-label="Loading table content"
        data-testid={testId}
      >
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        
        {/* Rows */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div key={rowIndex} className="p-4">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <Skeleton key={colIndex} className="h-4 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
)
TableSkeleton.displayName = 'TableSkeleton'

// ============================================================================
// INLINE LOADING
// ============================================================================

export interface InlineLoadingProps {
  text?: string
  size?: 'sm' | 'md'
  className?: string
  'data-testid'?: string
}

export const InlineLoading = React.forwardRef<HTMLDivElement, InlineLoadingProps>(
  ({ text = 'Cargando...', size = 'sm', className, 'data-testid': testId }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn('inline-flex items-center text-muted-foreground', className)}
        role="status"
        aria-label={text}
        data-testid={testId}
      >
        <LoadingSpinner size={size} className="mr-2" label="" />
        <span className={size === 'sm' ? 'text-sm' : 'text-base'}>{text}</span>
      </div>
    )
  }
)
InlineLoading.displayName = 'InlineLoading'

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

interface NetworkStatusProps {
  isOnline: boolean
  className?: string
}

export function NetworkStatus({ isOnline, className }: NetworkStatusProps) {
  return (
    <div className={cn(
      'flex items-center space-x-2 text-sm',
      isOnline ? 'text-green-600' : 'text-red-600',
      className
    )}>
      {isOnline ? (
        <Wifi className="h-4 w-4" />
      ) : (
        <WifiOff className="h-4 w-4" />
      )}
      <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
    </div>
  )
}

interface ProgressIndicatorProps {
  progress: number
  label?: string
  showPercentage?: boolean
  variant?: 'default' | 'success' | 'warning' | 'error'
  className?: string
}

export function ProgressIndicator({
  progress,
  label,
  showPercentage = true,
  variant = 'default',
  className
}: ProgressIndicatorProps) {
  const variantClasses = {
    default: 'bg-blue-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    error: 'bg-red-600'
  }

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm font-medium text-foreground">{label}</span>}
          {showPercentage && (
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn('h-2 rounded-full transition-all duration-300', variantClasses[variant])}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================================
// PAGE LOADING (standalone, compatible con tests)
// ============================================================================

export interface PageLoadingProps {
  message?: string
  className?: string
}

export const PageLoading: React.FC<PageLoadingProps> = ({ message = 'Cargando...', className }) => {
  return (
    <div
      className={cn('min-h-screen bg-gray-50 flex items-center justify-center', className)}
      role="status"
      aria-label={message}
    >
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size="xl" variant="primary" label="" />
        <p className="text-muted-foreground font-medium text-center">{message}</p>
      </div>
    </div>
  )
}

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// For backward compatibility with existing code
export const SkeletonCard = CardSkeleton
export const SkeletonTable = TableSkeleton