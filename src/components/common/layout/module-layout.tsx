/**
 * Layout base para módulos
 * Incluye header, loading state, error state y slots para acciones
 *
 * `layoutShell="auto"` (defecto): si la página está bajo `DashboardShellProvider`
 * (/admin, /technician, /client), sincroniza el encabezado al shell compartido y
 * no duplica RoleDashboardLayout.
 */

'use client'

import { useEffect, type ReactNode } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { useDashboardShellSetter } from '@/contexts/dashboard-shell-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ModuleLayoutProps {
  // Header
  title: string
  subtitle?: string | React.ReactNode
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

  /**
   * - `self`: siempre envuelve con RoleDashboardLayout (páginas fuera del shell compartido).
   * - `context`: exige proveedor; solo contenido central.
   * - `auto`: usa contexto si hay proveedor; si no, `self`.
   */
  layoutShell?: 'self' | 'context' | 'auto'
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
  contentClassName,
  layoutShell = 'self',
}: ModuleLayoutProps) {
  const setShellMeta = useDashboardShellSetter()

  const resolvedShell: 'self' | 'context' =
    layoutShell === 'auto'
      ? setShellMeta
        ? 'context'
        : 'self'
      : layoutShell === 'context' && !setShellMeta
        ? 'self'
        : layoutShell

  useEffect(() => {
    if (resolvedShell !== 'context' || !setShellMeta) return
    setShellMeta({ title, subtitle, headerActions })
    return () => {
      setShellMeta(null)
    }
  }, [resolvedShell, setShellMeta, title, subtitle, headerActions])

  const wrapShell = (inner: ReactNode) =>
    resolvedShell === 'context' ? (
      <>{inner}</>
    ) : (
      <RoleDashboardLayout title={title} subtitle={subtitle} headerActions={headerActions}>
        {inner}
      </RoleDashboardLayout>
    )

  // Loading state inicial (sin datos)
  if (loading && !children) {
    return wrapShell(
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <RefreshCw className='h-8 w-8 animate-spin text-primary mx-auto mb-4' />
          <p className='text-muted-foreground'>Cargando...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return wrapShell(
      <Card>
        <CardContent className='pt-6'>
          <div className='flex flex-col items-center justify-center py-12'>
            <AlertCircle className='h-16 w-16 text-red-400 mb-4' />
            <h3 className='text-lg font-medium text-foreground mb-2'>Error al cargar datos</h3>
            <p className='text-muted-foreground text-center mb-6 max-w-md'>{error}</p>
            {onRetry && (
              <Button onClick={onRetry}>
                <RefreshCw className='h-4 w-4 mr-2' />
                Reintentar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Contenido normal
  return wrapShell(
    <div className={cn('space-y-6', className)}>
      {loading && (
        <Card className='bg-muted/50'>
          <CardContent className='py-3'>
            <div className='flex items-center justify-center space-x-2'>
              <RefreshCw className='h-4 w-4 animate-spin text-primary' />
              <span className='text-sm text-muted-foreground'>Actualizando datos...</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={contentClassName}>{children}</div>
    </div>
  )
}
