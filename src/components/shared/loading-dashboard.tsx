/**
 * Componente de estado de carga para dashboards
 * Muestra un spinner mientras se cargan los datos
 */

import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Loader2 } from 'lucide-react'

interface LoadingDashboardProps {
  title?: string
  subtitle?: string
  message?: string
}

export function LoadingDashboard({
  title = 'Dashboard',
  subtitle = 'Cargando datos...',
  message = 'Por favor espera mientras cargamos tu información',
}: LoadingDashboardProps) {
  return (
    <RoleDashboardLayout title={title} subtitle={subtitle}>
      <div className='flex flex-col items-center justify-center h-64 space-y-4'>
        <Loader2 className='h-12 w-12 animate-spin text-primary' />
        <p className='text-sm text-muted-foreground'>{message}</p>
      </div>
    </RoleDashboardLayout>
  )
}

/**
 * Componente de spinner simple para usar en cualquier parte
 */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  return (
    <div className='flex items-center justify-center'>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
    </div>
  )
}
