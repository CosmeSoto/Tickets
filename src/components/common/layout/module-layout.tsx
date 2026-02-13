/**
 * Layout base para módulos
 * Incluye header, loading state, error state y slots para acciones
 */

'use client'

import { RefreshCw, AlertCircle } from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ModuleLayoutProps {
  // Header
  title: string
  subtitle?: string
  headerActions?: React.ReactNode
  
  // Contenido
  children: React.ReactNode
  
  // Estados
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  
  // Estilos
  className?: string
  contentClassName?: string
}

export function ModuleLayout({
  title,
  subtitle,
  headerActions,
  children,
  loading = false,
  error = null,
  onRetry,
  className,
  contentClassName
}: ModuleLayoutProps) {
  // Loading state inicial (sin datos)
  if (loading && !children) {
    return (
      <RoleDashboardLayout
        title={title}
        subtitle={subtitle}
        headerActions={headerActions}
      >
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <RefreshCw className='h-8 w-8 animate-spin text-primary mx-auto mb-4' />
            <p className='text-muted-foreground'>Cargando...</p>
          </div>
        </div>
      </RoleDashboardLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <RoleDashboardLayout
        title={title}
        subtitle={subtitle}
        headerActions={headerActions}
      >
        <Card>
          <CardContent className='pt-6'>
            <div className='flex flex-col items-center justify-center py-12'>
              <AlertCircle className='h-16 w-16 text-red-400 mb-4' />
              <h3 className='text-lg font-medium text-foreground mb-2'>
                Error al cargar datos
              </h3>
              <p className='text-muted-foreground text-center mb-6 max-w-md'>
                {error}
              </p>
              {onRetry && (
                <Button onClick={onRetry}>
                  <RefreshCw className='h-4 w-4 mr-2' />
                  Reintentar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </RoleDashboardLayout>
    )
  }

  // Contenido normal
  return (
    <RoleDashboardLayout
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
    >
      <div className={cn('space-y-6', className)}>
        {/* Indicador de loading superpuesto */}
        {loading && (
          <Card className='bg-muted/50'>
            <CardContent className='py-3'>
              <div className='flex items-center justify-center space-x-2'>
                <RefreshCw className='h-4 w-4 animate-spin text-primary' />
                <span className='text-sm text-muted-foreground'>
                  Actualizando datos...
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Contenido del módulo */}
        <div className={contentClassName}>
          {children}
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
