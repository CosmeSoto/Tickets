'use client'

import {
  Bell,
  RefreshCw,
  Trash2,
  CheckCheck,
  AlertCircle,
  Search,
  X,
  Ticket,
  Check,
  Filter,
  Mail,
  Loader2,
  ChevronDown,
  ChevronRight,
  Layers,
  List,
  Clock,
  BellOff,
  MoreHorizontal,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModuleLayout } from '@/components/common/layout/module-layout'
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
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { FILTER_TYPE_OPTIONS, getTypeConfig } from '@/lib/notifications/notification-types'
import { groupNotifications } from '@/lib/notifications/group-notifications'
import { buildEntityKey } from '@/lib/notifications/entity-key'
import { ActiveMutesPanel } from '@/components/notifications/active-mutes-panel'

function NotificationCard({
  notification,
  onMarkRead,
  onMarkUnread,
  onDelete,
  onNavigate,
  onSnooze,
  onMuteThread,
}: {
  notification: NotificationData
  onMarkRead: (id: string) => void
  onMarkUnread: (id: string) => void
  onDelete: (id: string) => void
  onNavigate: (n: NotificationData) => void
  onSnooze: (id: string, duration: '1h' | '8h' | '24h') => void
  onMuteThread: (entityKey: string, duration: '1h' | '8h' | '24h' | 'forever') => void
}) {
  const muteKey = buildEntityKey({
    ticketId: notification.ticketId,
    metadata: notification.metadata,
  })
  const cfg = getTypeConfig(notification.type)
  const Icon = cfg.icon
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: es,
  })
  const isClickable = !!(
    notification.ticketId ||
    notification.metadata?.link ||
    notification.metadata?.actId ||
    notification.metadata?.maintenanceId ||
    notification.metadata?.equipmentId ||
    notification.metadata?.patrolId ||
    notification.metadata?.scheduleId ||
    notification.metadata?.routeId ||
    notification.metadata?.incidentId
  )

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
      <div className='flex items-start gap-3'>
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', cfg.textColor)} />

        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2 mb-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              <span
                className={cn('text-sm font-semibold', !notification.isRead && 'text-foreground')}
              >
                {notification.title}
              </span>
              {!notification.isRead && (
                <span className='w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full shrink-0' />
              )}
              <Badge variant='outline' className='text-xs'>
                {cfg.label}
              </Badge>
            </div>
            <span className='text-xs text-muted-foreground whitespace-nowrap shrink-0'>
              {timeAgo}
            </span>
          </div>

          <p className='text-sm text-muted-foreground mb-2 leading-relaxed'>
            {notification.message}
          </p>

          {notification.tickets && (
            <div className='flex items-center gap-1.5 text-xs text-muted-foreground mb-2 bg-muted/50 rounded px-2 py-1 w-fit'>
              <Ticket className='h-3 w-3' />
              <span className='truncate max-w-[200px]'>{notification.tickets.title}</span>
              <span className='text-muted-foreground/60'>#{notification.tickets.id.slice(-6)}</span>
            </div>
          )}

          <div className='flex items-center gap-1' onClick={e => e.stopPropagation()}>
            {!notification.isRead ? (
              <Button
                variant='ghost'
                size='sm'
                className='h-7 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                onClick={() => onMarkRead(notification.id)}
              >
                <Check className='h-3 w-3 mr-1' />
                Marcar leída
              </Button>
            ) : (
              <Button
                variant='ghost'
                size='sm'
                className='h-7 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-950/30'
                onClick={() => onMarkUnread(notification.id)}
              >
                <Mail className='h-3 w-3 mr-1' />
                Marcar no leída
              </Button>
            )}
            {isClickable && (
              <Button
                variant='ghost'
                size='sm'
                className='h-7 text-xs text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                onClick={() => onNavigate(notification)}
              >
                <Ticket className='h-3 w-3 mr-1' />
                {notification.metadata?.actId || notification.metadata?.link?.includes('/acts/')
                  ? 'Ver acta'
                  : notification.metadata?.maintenanceId ||
                      notification.metadata?.link?.includes('/maintenance/')
                    ? 'Ver mantenimiento'
                    : notification.metadata?.equipmentId ||
                        notification.metadata?.link?.includes('/equipment/')
                      ? 'Ver equipo'
                      : notification.metadata?.patrolId ||
                          notification.metadata?.scheduleId ||
                          notification.metadata?.routeId
                        ? 'Ver ronda'
                        : notification.metadata?.link?.includes('/inventory/')
                          ? 'Ver inventario'
                          : notification.metadata?.link?.includes('/news')
                            ? 'Ver noticia'
                            : notification.metadata?.link?.includes('/forms')
                              ? 'Ver documento'
                              : 'Ver ticket'}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='sm' className='h-7 w-7 p-0 ml-auto'>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                <DropdownMenuLabel>Posponer</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onSnooze(notification.id, '1h')}>
                  <Clock className='h-3.5 w-3.5 mr-2' />1 hora
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(notification.id, '8h')}>
                  <Clock className='h-3.5 w-3.5 mr-2' />8 horas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSnooze(notification.id, '24h')}>
                  <Clock className='h-3.5 w-3.5 mr-2' />
                  24 horas
                </DropdownMenuItem>
                {muteKey && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Silenciar hilo</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onMuteThread(muteKey, '8h')}>
                      <BellOff className='h-3.5 w-3.5 mr-2' />8 horas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMuteThread(muteKey, '24h')}>
                      <BellOff className='h-3.5 w-3.5 mr-2' />
                      24 horas
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onMuteThread(muteKey, 'forever')}>
                      <BellOff className='h-3.5 w-3.5 mr-2' />
                      Indefinido
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className='text-red-600 focus:text-red-600'
                  onClick={() => onDelete(notification.id)}
                >
                  <Trash2 className='h-3.5 w-3.5 mr-2' />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NotificationsPage() {
  const {
    loading,
    loadingMore,
    hasMore,
    filterRead,
    setFilterRead,
    filterType,
    setFilterType,
    searchTerm,
    setSearchTerm,
    filteredNotifications,
    stats,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    snoozeNotification,
    muteEntity,
    unmuteEntity,
    navigateToTicket,
    loadMore,
    refresh,
    isAuthenticated,
  } = useNotifications()

  const [showClearDialog, setShowClearDialog] = useState(false)
  const [groupByEntity, setGroupByEntity] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(
    () => (groupByEntity ? groupNotifications(filteredNotifications) : []),
    [groupByEntity, filteredNotifications]
  )

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (!isAuthenticated) {
    return (
      <ModuleLayout title='Notificaciones' subtitle='Centro de notificaciones'>
        <Card>
          <CardContent className='pt-6 text-center py-12'>
            <AlertCircle className='h-12 w-12 text-red-400 mx-auto mb-3' />
            <p className='text-muted-foreground'>
              Necesitas iniciar sesión para ver las notificaciones
            </p>
          </CardContent>
        </Card>
      </ModuleLayout>
    )
  }

  const headerActions = (
    <div className='flex items-center gap-2 flex-wrap'>
      {stats.unread > 0 && (
        <Button variant='outline' size='sm' onClick={markAllAsRead} disabled={loading}>
          <CheckCheck className='h-4 w-4 mr-2' />
          Marcar todas como leídas
        </Button>
      )}
      {stats.total > 0 && (
        <Button
          variant='outline'
          size='sm'
          onClick={() => setShowClearDialog(true)}
          disabled={loading}
          className='text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'
        >
          <Trash2 className='h-4 w-4 mr-2' />
          Limpiar todo
        </Button>
      )}
      <Button variant='outline' size='sm' onClick={refresh} disabled={loading}>
        <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
        Actualizar
      </Button>
    </div>
  )

  return (
    <ModuleLayout
      title='Notificaciones'
      subtitle={stats.unread > 0 ? `${stats.unread} sin leer` : 'Todo al día'}
      headerActions={headerActions}
    >
      <div className='max-w-3xl mx-auto space-y-4'>
        <ActiveMutesPanel onUnmute={unmuteEntity} />

        {/* Filtros */}
        <Card>
          <CardContent className='p-4 space-y-3'>
            {/* Búsqueda */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Buscar en notificaciones...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className='pl-9 pr-9'
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                >
                  <X className='h-4 w-4' />
                </button>
              )}
            </div>

            {/* Filtros de estado */}
            <div className='flex items-center gap-2 flex-wrap'>
              <Filter className='h-4 w-4 text-muted-foreground shrink-0' />
              {(['all', 'unread', 'read'] as const).map(f => (
                <Button
                  key={f}
                  variant={filterRead === f ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setFilterRead(f)}
                  className='h-7 text-xs'
                >
                  {f === 'all'
                    ? `Todas (${stats.total})`
                    : f === 'unread'
                      ? `Sin leer (${stats.unread})`
                      : `Leídas (${stats.read})`}
                </Button>
              ))}
              <div className='w-px h-5 bg-border mx-1' />
              {FILTER_TYPE_OPTIONS.map(opt => (
                <Button
                  key={opt.value}
                  variant={filterType === opt.value ? 'default' : 'outline'}
                  size='sm'
                  onClick={() => setFilterType(opt.value)}
                  className='h-7 text-xs'
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader className='pb-3'>
            <div className='flex items-center justify-between gap-2 flex-wrap'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Bell className='h-5 w-5' />
                {filteredNotifications.length >= stats.total
                  ? `${stats.total} notificaciones`
                  : `${filteredNotifications.length} de ${stats.total} notificaciones`}
                {groupByEntity && groups.length > 0 && (
                  <span className='text-sm font-normal text-muted-foreground'>
                    · {groups.length} grupos
                  </span>
                )}
              </CardTitle>
              <div className='flex items-center gap-1'>
                <Button
                  variant={groupByEntity ? 'default' : 'outline'}
                  size='sm'
                  className='h-7 text-xs'
                  onClick={() => setGroupByEntity(true)}
                >
                  <Layers className='h-3.5 w-3.5 mr-1' />
                  Agrupar
                </Button>
                <Button
                  variant={!groupByEntity ? 'default' : 'outline'}
                  size='sm'
                  className='h-7 text-xs'
                  onClick={() => setGroupByEntity(false)}
                >
                  <List className='h-3.5 w-3.5 mr-1' />
                  Lista
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && filteredNotifications.length === 0 ? (
              <div className='space-y-3'>
                {[...Array(4)].map((_, i) => (
                  <div key={i} className='h-20 bg-muted animate-pulse rounded-lg' />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className='text-center py-12'>
                <Bell className='h-12 w-12 text-muted-foreground/40 mx-auto mb-3' />
                <p className='text-muted-foreground'>
                  {stats.hasActiveFilters
                    ? 'No hay notificaciones con esos filtros'
                    : 'No tienes notificaciones por ahora'}
                </p>
                {stats.hasActiveFilters && (
                  <Button
                    variant='ghost'
                    size='sm'
                    className='mt-2'
                    onClick={() => {
                      setFilterRead('all')
                      setFilterType('all')
                      setSearchTerm('')
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : groupByEntity ? (
              <div className='space-y-3'>
                {groups.map(group => {
                  const isSingle = group.notifications.length === 1
                  const isOpen = isSingle || expandedGroups.has(group.key)
                  if (isSingle) {
                    const n = group.notifications[0]
                    return (
                      <NotificationCard
                        key={n.id}
                        notification={n}
                        onMarkRead={markAsRead}
                        onMarkUnread={markAsUnread}
                        onDelete={deleteNotification}
                        onNavigate={navigateToTicket}
                        onSnooze={(id, d) => snoozeNotification(id, d)}
                        onMuteThread={muteEntity}
                      />
                    )
                  }
                  return (
                    <div
                      key={group.key}
                      className='rounded-lg border border-border overflow-hidden'
                    >
                      <div className='flex items-center gap-1 pr-2'>
                        <button
                          type='button'
                          className='flex-1 flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors min-w-0'
                          onClick={() => toggleGroup(group.key)}
                        >
                          {isOpen ? (
                            <ChevronDown className='h-4 w-4 text-muted-foreground shrink-0' />
                          ) : (
                            <ChevronRight className='h-4 w-4 text-muted-foreground shrink-0' />
                          )}
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center gap-2 flex-wrap'>
                              <span className='text-sm font-semibold truncate'>{group.label}</span>
                              {group.subtitle && (
                                <span className='text-xs text-muted-foreground'>
                                  {group.subtitle}
                                </span>
                              )}
                              <Badge variant='secondary' className='text-[10px]'>
                                {group.notifications.length}
                              </Badge>
                              {group.unreadCount > 0 && (
                                <Badge className='text-[10px] bg-blue-500'>
                                  {group.unreadCount} nuevas
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                        {group.muteKey && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='sm' className='h-8 w-8 p-0 shrink-0'>
                                <BellOff className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuLabel>Silenciar hilo</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => muteEntity(group.muteKey!, '8h')}>
                                8 horas
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => muteEntity(group.muteKey!, '24h')}>
                                24 horas
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => muteEntity(group.muteKey!, 'forever')}
                              >
                                Indefinido
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      {isOpen && (
                        <div className='space-y-2 p-2 pt-0 border-t border-border/60'>
                          {group.notifications.map(n => (
                            <NotificationCard
                              key={n.id}
                              notification={n}
                              onMarkRead={markAsRead}
                              onMarkUnread={markAsUnread}
                              onDelete={deleteNotification}
                              onNavigate={navigateToTicket}
                              onSnooze={(id, d) => snoozeNotification(id, d)}
                              onMuteThread={muteEntity}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {hasMore && (
                  <div className='flex justify-center pt-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                      {loadingMore ? 'Cargando...' : 'Cargar más'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className='space-y-3'>
                {filteredNotifications.map(n => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onMarkRead={markAsRead}
                    onMarkUnread={markAsUnread}
                    onDelete={deleteNotification}
                    onNavigate={navigateToTicket}
                    onSnooze={(id, d) => snoozeNotification(id, d)}
                    onMuteThread={muteEntity}
                  />
                ))}
                {hasMore && (
                  <div className='flex justify-center pt-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => loadMore()}
                      disabled={loadingMore}
                    >
                      {loadingMore && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                      {loadingMore ? 'Cargando...' : 'Cargar más'}
                    </Button>
                  </div>
                )}
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
              Se eliminarán {stats.total} notificaciones permanentemente. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await clearAllNotifications()
                setShowClearDialog(false)
              }}
              className='bg-red-600 hover:bg-red-700'
            >
              <Trash2 className='h-4 w-4 mr-2' />
              Eliminar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
