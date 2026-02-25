'use client'

import { 
  Bell, 
  RefreshCw, 
  Trash2, 
  CheckCheck,
  AlertCircle
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationFilters } from './notification-filters'
import { NotificationList } from './notification-list'
import { useState } from 'react'

export default function NotificationsPage() {
  const {
    // Estados principales
    notifications,
    loading,
    error,
    
    // Estados de filtros
    filterType,
    setFilterType,
    filterRead,
    setFilterRead,
    searchTerm,
    setSearchTerm,
    
    // Datos procesados
    filteredNotifications,
    stats,
    
    // Funciones principales
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    
    // Funciones de utilidad
    refresh,
    isAuthenticated,
  } = useNotifications()

  const [showClearAllDialog, setShowClearAllDialog] = useState(false)

  // Renderizado de loading inicial
  if (loading && notifications.length === 0) {
    return (
      <RoleDashboardLayout title="Notificaciones" subtitle="Centro de notificaciones del sistema">
        <div className='flex items-center justify-center h-64'>
          <div className='text-center'>
            <RefreshCw className='h-8 w-8 animate-spin text-blue-600 mx-auto' />
            <p className='mt-2 text-muted-foreground'>Cargando notificaciones...</p>
          </div>
        </div>
      </RoleDashboardLayout>
    )
  }

  // Renderizado de error de autenticación
  if (!isAuthenticated) {
    return (
      <RoleDashboardLayout title="Notificaciones" subtitle="Centro de notificaciones del sistema">
        <Card>
          <CardContent className="pt-6">
            <div className='flex flex-col items-center justify-center py-12'>
              <AlertCircle className='h-16 w-16 text-red-400 mb-4' />
              <h3 className='text-lg font-medium text-foreground mb-2'>Acceso no autorizado</h3>
              <p className='text-muted-foreground text-center mb-6'>
                Necesitas iniciar sesión para ver las notificaciones
              </p>
            </div>
          </CardContent>
        </Card>
      </RoleDashboardLayout>
    )
  }

  // Renderizado de error
  if (error && notifications.length === 0) {
    return (
      <RoleDashboardLayout title="Notificaciones" subtitle="Centro de notificaciones del sistema">
        <Card>
          <CardContent className="pt-6">
            <div className='flex flex-col items-center justify-center py-12'>
              <AlertCircle className='h-16 w-16 text-red-400 mb-4' />
              <h3 className='text-lg font-medium text-foreground mb-2'>Error al cargar notificaciones</h3>
              <p className='text-muted-foreground text-center mb-6'>{error}</p>
              <Button onClick={() => refresh()}>
                <RefreshCw className='h-4 w-4 mr-2' />
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      </RoleDashboardLayout>
    )
  }

  const handleClearAll = async () => {
    await clearAllNotifications()
    setShowClearAllDialog(false)
  }

  const headerActions = (
    <div className='flex items-center space-x-2'>
      {stats.unread > 0 && (
        <Button 
          variant='outline' 
          onClick={markAllAsRead}
          disabled={loading}
          className="text-green-600 hover:text-green-700"
        >
          <CheckCheck className='h-4 w-4 mr-2' />
          Marcar todas como leídas
        </Button>
      )}
      
      {stats.total > 0 && (
        <Button 
          variant='outline' 
          onClick={() => setShowClearAllDialog(true)}
          disabled={loading}
          className="text-red-600 hover:text-red-700"
        >
          <Trash2 className='h-4 w-4 mr-2' />
          Limpiar todas
        </Button>
      )}
      
      <Button variant='outline' onClick={() => refresh()} disabled={loading}>
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
    </div>
  )

  return (
    <RoleDashboardLayout
      title='Notificaciones'
      subtitle={`Centro de notificaciones del sistema${stats.unread > 0 ? ` • ${stats.unread} sin leer` : ''}`}
      headerActions={headerActions}
    >
      <div className='space-y-6'>
        {/* Filtros */}
        <NotificationFilters
          filterType={filterType}
          setFilterType={setFilterType}
          filterRead={filterRead}
          setFilterRead={setFilterRead}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          hasActiveFilters={stats.hasActiveFilters}
          stats={stats}
        />

        {/* Lista de notificaciones */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center justify-between'>
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>
                  Notificaciones ({stats.filtered})
                  {stats.filtered !== stats.total && (
                    <span className="text-muted-foreground font-normal"> de {stats.total}</span>
                  )}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationList
              notifications={filteredNotifications}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
              searchTerm={searchTerm}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmación para limpiar todas */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todas las notificaciones?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente todas tus notificaciones ({stats.total} en total).
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              className='bg-red-600 hover:bg-red-700'
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}