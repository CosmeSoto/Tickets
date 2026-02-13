/**
 * Responsive Design Improvements
 * Enhanced responsive components and utilities
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { useBreakpoint } from './responsive-layout'

// Mobile navigation
interface MobileNavigationProps {
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  isOpen,
  onToggle,
  children,
  className,
}) => {
  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center p-2 rounded-md text-muted-foreground',
          'hover:text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2',
          'focus:ring-inset focus:ring-blue-500 md:hidden',
          className
        )}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label="Toggle navigation menu"
      >
        <svg
          className="h-6 w-6"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile menu */}
      <div className={cn(
        'md:hidden',
        isOpen ? 'block' : 'hidden'
      )}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-card border-t border-border">
          {children}
        </div>
      </div>
    </>
  )
}

// Responsive grid with auto-fit
interface ResponsiveGridProps {
  children: React.ReactNode
  minItemWidth?: string
  gap?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  minItemWidth = '280px',
  gap = 'md',
  className,
}) => {
  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-12',
  }

  return (
    <div
      className={cn(
        'grid w-full',
        gapClasses[gap],
        className
      )}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${minItemWidth}, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  )
}

// Touch-friendly button
interface TouchButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  children: React.ReactNode
}

export const TouchButton: React.FC<TouchButtonProps> = ({
  size = 'md',
  variant = 'primary',
  className,
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'min-h-[40px] px-3 py-2 text-sm',
    md: 'min-h-[44px] px-4 py-2 text-base',
    lg: 'min-h-[48px] px-6 py-3 text-lg',
  }

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border border-border text-foreground hover:bg-muted focus:ring-blue-500',
    ghost: 'text-foreground hover:bg-muted focus:ring-blue-500',
  }

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:pointer-events-none',
        'touch-manipulation', // Improves touch responsiveness
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

// Responsive table wrapper
interface ResponsiveTableProps {
  children: React.ReactNode
  className?: string
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  className,
}) => {
  return (
    <div className={cn(
      'overflow-x-auto -mx-4 sm:mx-0',
      'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100',
      className
    )}>
      <div className="inline-block min-w-full align-middle">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

// Mobile-first form layout
interface ResponsiveFormProps {
  children: React.ReactNode
  columns?: 1 | 2 | 3
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}

export const ResponsiveForm: React.FC<ResponsiveFormProps> = ({
  children,
  columns = 1,
  gap = 'md',
  className,
}) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  }

  const gapClasses = {
    sm: 'gap-3',
    md: 'gap-6',
    lg: 'gap-8',
  }

  return (
    <div className={cn(
      'grid w-full',
      columnClasses[columns],
      gapClasses[gap],
      className
    )}>
      {children}
    </div>
  )
}

// Responsive image with aspect ratio
interface ResponsiveImageProps {
  src: string
  alt: string
  aspectRatio?: 'square' | 'video' | 'wide' | 'tall'
  sizes?: string
  className?: string
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  aspectRatio = 'video',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  className,
}) => {
  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[21/9]',
    tall: 'aspect-[3/4]',
  }

  return (
    <div className={cn(
      'relative overflow-hidden rounded-lg',
      aspectRatioClasses[aspectRatio],
      className
    )}>
      <img
        src={src}
        alt={alt}
        sizes={sizes}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  )
}

// Responsive text with optimal line length
interface ResponsiveTextProps {
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'none'
  className?: string
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  maxWidth = 'lg',
  className,
}) => {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    none: '',
  }

  return (
    <div className={cn(
      'text-base leading-relaxed',
      maxWidthClasses[maxWidth],
      className
    )}>
      {children}
    </div>
  )
}

// Responsive card stack
interface ResponsiveCardStackProps {
  children: React.ReactNode
  minCardWidth?: string
  maxColumns?: 2 | 3 | 4 | 5 | 6
  gap?: 'sm' | 'md' | 'lg'
  className?: string
}

export const ResponsiveCardStack: React.FC<ResponsiveCardStackProps> = ({
  children,
  minCardWidth = '300px',
  maxColumns = 4,
  gap = 'md',
  className,
}) => {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  }

  return (
    <div
      className={cn(
        'grid w-full',
        gapClasses[gap],
        className
      )}
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${minCardWidth}, 100%), 1fr))`,
      }}
    >
      {children}
    </div>
  )
}

// Breakpoint-aware component
interface BreakpointAwareProps {
  children: (breakpoint: ReturnType<typeof useBreakpoint>) => React.ReactNode
}

export const BreakpointAware: React.FC<BreakpointAwareProps> = ({ children }) => {
  const breakpoint = useBreakpoint()
  return <>{children(breakpoint)}</>
}

// Mobile input
interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
}

export const MobileInput: React.FC<MobileInputProps> = ({
  label,
  error,
  helpText,
  className,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'block w-full min-h-[44px] px-3 py-2 border border-border rounded-md',
          'text-base', // Prevents zoom on iOS
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'disabled:bg-muted disabled:text-muted-foreground',
          error && 'border-red-300 focus:ring-red-500 focus:border-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {helpText && !error && (
        <p className="text-sm text-muted-foreground">
          {helpText}
        </p>
      )}
    </div>
  )
}