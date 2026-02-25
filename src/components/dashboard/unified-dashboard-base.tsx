'use client'

import { ReactNode } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { LoadingDashboard } from '@/components/shared/loading-dashboard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Notifications } from '@/components/ui/notifications'

interface UnifiedDashboardBaseProps {
  // Datos del usuario
  userName?: string
  userRole: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  
  // Estados de carga
  isLoading: boolean
  isAuthorized: boolean
  error: string | null
  
  // Configuración del dashboard
  title: string
  subtitle: string
  loadingMessage?: string
  
  // Acciones
  onRefresh: () => void
  headerActions?: ReactNode
  
  // Contenido
  children: ReactNode
  
  // Notificaciones
  showNotifications?: boolean
  notificationsMaxVisible?: number
  
  // Badge de estado (opcional)
  statusBadge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
}

export function UnifiedDashboardBase({
  userName,
  userRole,
  isLoading,
  isAuthorized,
  error,
  title,
  subtitle,
  loadingMessage = 'Cargando datos...',
  onRefresh,
  headerActions,
  children,
  showNotifications = true,
  notificationsMaxVisible = 3,
  statusBadge
}: UnifiedDashboardBaseProps) {
  
  // Mostrar loading mientras se verifica autenticación o se cargan datos
  if (isLoading) {
    return (
      <LoadingDashboard
        title={title}
        subtitle={subtitle}
        message={loadingMessage}
      />
    )
  }

  // Si no está autorizado, el hook ya redirigió
  if (!isAuthorized) return null

  // Construir título con nombre de usuario si está disponible
  const displayTitle = userName ? `¡${userRole === 'CLIENT' ? 'Bienvenido' : 'Hola'}, ${userName}!` : title

  // Construir header actions con badge y botón de refresh
  const defaultHeaderActions = (
    <div className="flex items-center space-x-3">
      {statusBadge && (
        <Badge variant={statusBadge.variant || 'default'} className={statusBadge.className}>
          {statusBadge.text}
        </Badge>
      )}
      <Button variant="outline" size="sm" onClick={onRefresh}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Actualizar
      </Button>
      {headerActions}
    </div>
  )

  // Mostrar error si hay problemas cargando datos
  if (error) {
    return (
      <RoleDashboardLayout
        title={displayTitle}
        subtitle={subtitle}
        headerActions={defaultHeaderActions}
      >
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Error al cargar datos: {error}</span>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title={displayTitle}
      subtitle={subtitle}
      headerActions={defaultHeaderActions}
    >
      {/* Notificaciones y Alertas Unificadas */}
      {showNotifications && (
        <Notifications 
          variant="dashboard" 
          className="mb-6" 
          maxVisible={notificationsMaxVisible} 
        />
      )}

      {/* Contenido del dashboard */}
      {children}
    </RoleDashboardLayout>
  )
}
