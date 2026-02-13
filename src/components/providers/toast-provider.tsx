'use client'

import { ReactNode } from 'react'
import { ToastContext, useToastProvider } from '@/hooks/use-toast'

export function ToastProvider({ children }: { children: ReactNode }) {
  const toastValue = useToastProvider()

  return (
    <ToastContext.Provider value={toastValue}>
      {children}
    </ToastContext.Provider>
  )
}