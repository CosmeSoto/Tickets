'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, User } from 'lucide-react'

interface ToastProps {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
  onDismiss: (id: string) => void
}

export function Toast({ 
  id, 
  title, 
  description, 
  variant = 'default', 
  duration = 5000,
  action,
  onDismiss 
}: ToastProps) {
  const [isVisible, setIsVisible] = React.useState(false)

  React.useEffect(() => {
    // Animate in
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss()
      }, duration)

      return () => clearTimeout(timer)
    }
    return () => {} // Return empty cleanup function when duration is 0
  }, [id, duration])

  const handleDismiss = () => {
    setIsVisible(false)
    setTimeout(() => onDismiss(id), 150) // Wait for animation
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          className: 'border-green-200 bg-green-50 text-green-900',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        }
      case 'destructive':
        return {
          className: 'border-red-200 bg-red-50 text-red-900',
          icon: AlertCircle,
          iconColor: 'text-red-600'
        }
      case 'warning':
        return {
          className: 'border-yellow-200 bg-yellow-50 text-yellow-900',
          icon: AlertTriangle,
          iconColor: 'text-yellow-600'
        }
      case 'info':
        return {
          className: 'border-blue-200 bg-blue-50 text-blue-900',
          icon: Info,
          iconColor: 'text-blue-600'
        }
      default:
        return {
          className: 'border-border bg-card text-foreground shadow-lg',
          icon: User,
          iconColor: 'text-muted-foreground'
        }
    }
  }

  const { className, icon: Icon, iconColor } = getVariantStyles()

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex w-full items-start justify-between space-x-4 overflow-hidden rounded-lg border p-4 pr-8 transition-all duration-300 ease-in-out transform mb-2',
        className,
        isVisible 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
      )}
      role="alert"
      aria-live="polite"
    >
      <div className='flex items-start space-x-3 flex-1 min-w-0'>
        <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconColor)} />
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-semibold leading-tight'>{title}</div>
          {description && (
            <div className='text-sm opacity-90 mt-1 leading-relaxed'>{description}</div>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className='mt-2 text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current rounded'
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
      
      <button
        onClick={handleDismiss}
        className='absolute right-2 top-2 rounded-md p-1 text-current opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2'
        aria-label="Cerrar notificación"
      >
        <X className='h-4 w-4' />
      </button>

      {/* Progress bar for timed toasts */}
      {duration > 0 && (
        <div className='absolute bottom-0 left-0 h-1 bg-current opacity-20 animate-shrink' 
             style={{ animationDuration: `${duration}ms` }} />
      )}
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className='fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]'>
        <div id='toast-container' />
      </div>
    </>
  )
}
