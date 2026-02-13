'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  toast: (toast: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastCount = 0

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export { ToastContext }

// Hook para crear el provider
export function useToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback(({ title, description, variant = 'default', duration = 5000, action }: Omit<Toast, 'id'>) => {
    const id = (++toastCount).toString()
    const newToast = { id, title, description, variant, duration, action }

    setToasts(prev => [...prev, newToast])

    // Auto remove after specified duration
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    // Show browser notification for important messages
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted' && (variant === 'destructive' || variant === 'warning')) {
        new Notification(title, {
          body: description,
          icon: '/favicon.ico',
          tag: `toast-${id}`, // Prevent duplicate notifications
        })
      }
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Helper methods for common toast types
  const success = useCallback((title: string, description?: string) => {
    toast({ title, description, variant: 'success' })
  }, [toast])

  const error = useCallback((title: string, description?: string) => {
    toast({ title, description, variant: 'destructive' })
  }, [toast])

  const warning = useCallback((title: string, description?: string) => {
    toast({ title, description, variant: 'warning' })
  }, [toast])

  const info = useCallback((title: string, description?: string) => {
    toast({ title, description, variant: 'info' })
  }, [toast])

  return { toasts, toast, dismiss, success, error, warning, info }
}

// Request notification permission on first load
if (typeof window !== 'undefined' && 'Notification' in window) {
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}
