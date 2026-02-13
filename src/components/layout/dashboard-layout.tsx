'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { Breadcrumb } from './breadcrumb'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  headerActions?: React.ReactNode
  className?: string
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  headerActions,
  className,
}: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Solo ejecutar la lógica de redirección una vez que NextAuth esté inicializado
    if (status === 'loading') return

    if (status === 'unauthenticated') {
      // Solo redirigir si realmente no hay sesión
      const currentPath = window.location.pathname + window.location.search
      router.push(`/login?callbackUrl=${encodeURIComponent(currentPath)}`)
      return
    }

    if (status === 'authenticated' && session) {
      setIsInitialized(true)
    }
  }, [session, status, router])

  // Mostrar loading mientras NextAuth se inicializa
  if (status === 'loading') {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='flex flex-col items-center space-y-4'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
          <p className='text-muted-foreground'>Verificando sesión...</p>
        </div>
      </div>
    )
  }

  // No mostrar nada si no hay sesión (el middleware se encarga de la redirección)
  if (status === 'unauthenticated' || !session) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='flex flex-col items-center space-y-4'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
          <p className='text-muted-foreground'>Redirigiendo...</p>
        </div>
      </div>
    )
  }

  // Solo renderizar el dashboard cuando esté completamente inicializado
  if (!isInitialized) {
    return (
      <div className='min-h-screen bg-background flex items-center justify-center'>
        <div className='flex flex-col items-center space-y-4'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
          <p className='text-muted-foreground'>Inicializando dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-background flex'>
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        {/* Header */}
        <Header title={title} subtitle={subtitle} actions={headerActions} />

        {/* Breadcrumb */}
        <div className='px-6 py-3 bg-background border-b border-border'>
          <Breadcrumb />
        </div>

        {/* Page Content */}
        <main className={cn('flex-1 overflow-y-auto p-6', className)}>{children}</main>
      </div>
    </div>
  )
}
