'use client'

import {
  Bell, RefreshCw, Trash2, CheckCheck, AlertCircle,
  Info, CheckCircle, Clock, Search, X, Ticket,
  Check, Filter
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { useNotifications, type NotificationData } from '@/hooks/use-notifications'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Configuración visual por tipo de notificación
const TYPE_CONFIG: Record<string, { icon: React.ElementType; borderColor: string; bgColor: string; label: string }> = {
  SUCCESS: { icon: CheckCircle, borderColor: 'border-l-green-500', bgColor: 'bg-green-50/40 dark:bg-green-950/20', label: 'Éxito' },
  INFO:    { icon: Info,         borderColor: 'border-l-blue-500',  bgColor: 'bg-blue-50/40 dark:bg-blue-950/20',  label: 'Info' },
  WARNING: { icon: Clock,        borderColor: 'border-l-yellow-500',bgColor: 'bg-yellow-50/40 dark:bg-yellow-950/20', label: 'Atención' },
  ERROR:   { icon: AlertCircle,  borderColor: 'border-l-red-500',   bgColor: 'bg-red-50/40 dark:bg-red-950/20',   label: 'Error' },
}

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: NotificationData
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
  onNavigate: (n: NotificationData) => void
}) {
  const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.INFO
  const Icon = cfg.icon
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: es })
  const isClickable = !!(notification.ticketId || notification.metadata?.link ||
    notification.metadata?.actId || notification.metadata?.maintenanceId ||
    notification.metadata?.equipmentId)

  return (
    <div
      className={cn(
        'border-l-4 rounded-lg p-4 transition-all hover:shadow-sm',
        cfg.borderColor,
        !notification.isRead ? cfg.bgColor : 'bg-muted/30',
        isClickable && 'cursor-pointer'
      )}
      onClick={isClickable ? () => onNavigate(notification) : undefined}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn(
          'h-5 w-5 mt-0.5 shrink-0',
          notification.type === 'SUCCESS' ? 'text-green-600' :
          notification.type === 'WARNING' ? 'text-yellow-600' :
          notification.type === 'ERROR'   ? 'text-red-600' :
          'text-blue-600'
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm font-semibold', !notification.isRead && 'text-foreground')}>
                {notification.title}
              </span>
              {!notification.isRead && (
                <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
              )}
              <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{timeAgo}</span>
          </div>

          <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
            {notification.message}
          </p>

          {notification.tickets && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2 bg-muted/50 rounded px-2 py-1 w-fit">
              <Ticket className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{notification.tickets.title}</span>
              <span className="text-muted-foreground/60">#{notification.tickets.id.slice(-6)}</span>
            </div>
          )}

          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {!notification.isRead && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                onClick={() => onMarkRead(notification.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                Marcar leída
              </Button>
            )}
            {isClickable && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                onClick={() => onNavigate(notification)}
              >
                <Ticket className="h-3 w-3 mr-1" />
                {notification.metadata?.actId || notification.metadata?.link?.includes('/acts/')
                  ? 'Ver acta'
                  : notification.metadata?.maintenanceId || notification.metadata?.link?.includes('/maintenance/')
                  ? 'Ver mantenimiento'
                  : notification.metadata?.equipmentId || notification.metadata?.link?.includes('/equipment/')
                  ? 'Ver equipo'
                  : 'Ver ticket'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
              onClick={() => onDelete(notification.id)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const {
    loading, error,
    filterRead, setFilterRead,
    filterType, setFilterType,
    searchTerm, setSearchTerm,
    filteredNotifications, stats,
    markAsRead, markAllAsRead,
    deleteNotification, clearAllNotifications,
    navigateToTicket, refresh,
    isAuthenticated,
  } = useNotifications()

  const [showClearDialog, setShowClearDialog] = useState(false)

  if (!isAuthenticated) {
    return (
      <RoleDashboardLayout title="Notificaciones" subtitle="Centro de notificaciones">
        <Card><CardContent className="pt-6 text-center py-12">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-muted-foreground">Necesitas iniciar sesión para ver las notificaciones</p>
        </CardContent></Card>
      </RoleDashboardLayout>
    )
  }

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {stats.unread > 0 && (
        <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={loading}>
          <CheckCheck className="h-4 w-4 mr-2" />
          Marcar todas como leídas
        </Button>
      )}
      {stats.total > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowClearDialog(true)} disabled={loading}
          className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300">
          <Trash2 className="h-4 w-4 mr-2" />
          Limpiar todo
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
        <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
        Actualizar
      </Button>
    </div>
  )

  return (
    <RoleDashboardLayout
      title="Notificaciones"
      subtitle={stats.unread > 0 ? `${stats.unread} sin leer` : 'Todo al día'}
      headerActions={headerActions}
    >
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en notificaciones..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filtros de estado */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              {(['all', 'unread', 'read'] as const).map(f => (
                <Button
                  key={f}
                  variant={filterRead === f ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterRead(f)}
                  className="h-7 text-xs"
                >
                  {f === 'all' ? `Todas (${stats.total})` :
                   f === 'unread' ? `Sin leer (${stats.unread})` :
                   `Leídas (${stats.read})`}
                </Button>
              ))}
              <div className="w-px h-5 bg-border mx-1" />
              {(['all', 'SUCCESS', 'INFO', 'WARNING', 'ERROR'] as const).map(t => (
                <Button
                  key={t}
                  variant={filterType === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterType(t)}
                  className="h-7 text-xs"
                >
                  {t === 'all' ? 'Todos los tipos' :
                   t === 'SUCCESS' ? '✅ Éxito' :
                   t === 'INFO' ? 'ℹ️ Info' :
                   t === 'WARNING' ? '⚠️ Atención' :
                   '❌ Error'}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              {stats.filtered === stats.total
                ? `${stats.total} notificaciones`
                : `${stats.filtered} de ${stats.total} notificaciones`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && filteredNotifications.length === 0 ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {stats.hasActiveFilters
                    ? 'No hay notificaciones con esos filtros'
                    : 'No tienes notificaciones por ahora'}
                </p>
                {stats.hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="mt-2"
                    onClick={() => { setFilterRead('all'); setFilterType('all'); setSearchTerm('') }}>
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map(n => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onMarkRead={markAsRead}
                    onDelete={deleteNotification}
                    onNavigate={navigateToTicket}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar todas las notificaciones?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán {stats.total} notificaciones permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { await clearAllNotifications(); setShowClearDialog(false) }}
              className="bg-red-600 hover:bg-red-700"
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
