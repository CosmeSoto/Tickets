/**
 * Tabla de tickets optimizada con acciones masivas
 * Extiende ticket-table.tsx con funcionalidad de selección múltiple
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Search,
  Filter,
  RefreshCw,
  Eye,
  MessageSquare,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Clock,
  MoreHorizontal,
  Trash2,
  UserCheck,
  CheckCircle,
  XCircle,
  Archive,
  Tag,
  AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import { useTickets, Ticket, TICKET_STATUS_LABELS, TICKET_STATUS_COLORS, TICKET_PRIORITY_LABELS, TICKET_PRIORITY_COLORS, formatTimeAgo } from '@/hooks/use-tickets'
import { useToast } from '@/hooks/use-toast'

interface TicketTableWithActionsProps {
  title?: string
  description?: string
  showFilters?: boolean
  defaultFilters?: {
    status?: string
    priority?: string
    assigneeId?: string
  }
  actions?: React.ReactNode
  enableMassActions?: boolean
  userRole?: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}

interface MassAction {
  id: string
  label: string
  icon: React.ReactNode
  action: (ticketIds: string[]) => Promise<void>
  requiresConfirmation?: boolean
  confirmationTitle?: string
  confirmationDescription?: string
  variant?: 'default' | 'destructive'
  requiredRole?: 'ADMIN' | 'TECHNICIAN'
}

export function TicketTableWithActions({
  title = 'Tickets',
  description = 'Gestión de tickets de soporte',
  showFilters = true,
  defaultFilters = {},
  actions,
  enableMassActions = true,
  userRole,
}: TicketTableWithActionsProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const {
    tickets,
    loading,
    error,
    pagination,
    filters,
    setFilters,
    clearFilters,
    refresh,
    goToPage,
    hasActiveFilters
  } = useTickets({
    initialFilters: defaultFilters,
    pageSize: 25
  })

  // Estados para acciones masivas
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set())
  const [isPerformingAction, setIsPerformingAction] = useState(false)
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
    action: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {}
  })

  const currentUserRole = userRole || session?.user?.role

  // Funciones para selección masiva
  const toggleTicketSelection = useCallback((ticketId: string) => {
    setSelectedTickets(prev => {
      const newSet = new Set(prev)
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId)
      } else {
        newSet.add(ticketId)
      }
      return newSet
    })
  }, [])

  const toggleAllTickets = useCallback(() => {
    if (selectedTickets.size === tickets.length) {
      setSelectedTickets(new Set())
    } else {
      setSelectedTickets(new Set(tickets.map(t => t.id)))
    }
  }, [selectedTickets.size, tickets])

  const clearSelection = useCallback(() => {
    setSelectedTickets(new Set())
  }, [])

  // Acciones masivas disponibles
  const massActions: MassAction[] = useMemo(() => {
    const actions: MassAction[] = []

    if (currentUserRole === 'ADMIN' || currentUserRole === 'TECHNICIAN') {
      actions.push(
        {
          id: 'assign-to-me',
          label: 'Asignar a mí',
          icon: <UserCheck className="h-4 w-4" />,
          action: async (ticketIds: string[]) => {
            // Implementar asignación masiva
            const response = await fetch('/api/tickets/bulk-assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ticketIds, 
                assigneeId: session?.user?.id 
              })
            })
            
            if (response.ok) {
              toast({
                title: 'Tickets asignados',
                description: `${ticketIds.length} tickets asignados exitosamente`,
              })
              refresh()
              clearSelection()
            } else {
              throw new Error('Error al asignar tickets')
            }
          }
        },
        {
          id: 'change-status-progress',
          label: 'Marcar en progreso',
          icon: <Clock className="h-4 w-4" />,
          action: async (ticketIds: string[]) => {
            const response = await fetch('/api/tickets/bulk-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ticketIds, 
                status: 'IN_PROGRESS' 
              })
            })
            
            if (response.ok) {
              toast({
                title: 'Estado actualizado',
                description: `${ticketIds.length} tickets marcados en progreso`,
              })
              refresh()
              clearSelection()
            } else {
              throw new Error('Error al actualizar estado')
            }
          }
        },
        {
          id: 'change-status-resolved',
          label: 'Marcar como resuelto',
          icon: <CheckCircle className="h-4 w-4" />,
          action: async (ticketIds: string[]) => {
            const response = await fetch('/api/tickets/bulk-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ticketIds, 
                status: 'RESOLVED' 
              })
            })
            
            if (response.ok) {
              toast({
                title: 'Tickets resueltos',
                description: `${ticketIds.length} tickets marcados como resueltos`,
              })
              refresh()
              clearSelection()
            } else {
              throw new Error('Error al resolver tickets')
            }
          }
        }
      )
    }

    if (currentUserRole === 'ADMIN') {
      actions.push(
        {
          id: 'change-priority-high',
          label: 'Cambiar prioridad a Alta',
          icon: <AlertTriangle className="h-4 w-4" />,
          action: async (ticketIds: string[]) => {
            const response = await fetch('/api/tickets/bulk-priority', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                ticketIds, 
                priority: 'HIGH' 
              })
            })
            
            if (response.ok) {
              toast({
                title: 'Prioridad actualizada',
                description: `${ticketIds.length} tickets marcados como alta prioridad`,
              })
              refresh()
              clearSelection()
            } else {
              throw new Error('Error al cambiar prioridad')
            }
          }
        },
        {
          id: 'archive',
          label: 'Archivar tickets',
          icon: <Archive className="h-4 w-4" />,
          action: async (ticketIds: string[]) => {
            const response = await fetch('/api/tickets/bulk-archive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticketIds })
            })
            
            if (response.ok) {
              toast({
                title: 'Tickets archivados',
                description: `${ticketIds.length} tickets archivados exitosamente`,
              })
              refresh()
              clearSelection()
            } else {
              throw new Error('Error al archivar tickets')
            }
          },
          requiresConfirmation: true,
          confirmationTitle: 'Archivar tickets',
          confirmationDescription: '¿Estás seguro de que quieres archivar los tickets seleccionados? Esta acción se puede deshacer.'
        },
        {
          id: 'delete',
          label: 'Eliminar tickets',
          icon: <Trash2 className="h-4 w-4" />,
          action: async (ticketIds: string[]) => {
            const response = await fetch('/api/tickets/bulk-delete', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticketIds })
            })
            
            if (response.ok) {
              toast({
                title: 'Tickets eliminados',
                description: `${ticketIds.length} tickets eliminados exitosamente`,
              })
              refresh()
              clearSelection()
            } else {
              throw new Error('Error al eliminar tickets')
            }
          },
          requiresConfirmation: true,
          confirmationTitle: 'Eliminar tickets',
          confirmationDescription: '¿Estás seguro de que quieres eliminar permanentemente los tickets seleccionados? Esta acción no se puede deshacer.',
          variant: 'destructive'
        }
      )
    }

    return actions
  }, [currentUserRole, session?.user?.id, refresh, clearSelection])

  // Función para ejecutar acción masiva
  const executeMassAction = useCallback(async (action: MassAction) => {
    if (selectedTickets.size === 0) return

    const ticketIds = Array.from(selectedTickets)

    if (action.requiresConfirmation) {
      setConfirmationDialog({
        isOpen: true,
        title: action.confirmationTitle || action.label,
        description: action.confirmationDescription || `¿Confirmas esta acción en ${ticketIds.length} tickets?`,
        action: async () => {
          setIsPerformingAction(true)
          try {
            await action.action(ticketIds)
          } catch (error) {
            console.error('Error executing mass action:', error)
            toast({
              title: 'Error',
              description: error instanceof Error ? error.message : 'Error al ejecutar la acción',
              variant: 'destructive'
            })
          } finally {
            setIsPerformingAction(false)
            setConfirmationDialog(prev => ({ ...prev, isOpen: false }))
          }
        }
      })
    } else {
      setIsPerformingAction(true)
      try {
        await action.action(ticketIds)
      } catch (error) {
        console.error('Error executing mass action:', error)
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Error al ejecutar la acción',
          variant: 'destructive'
        })
      } finally {
        setIsPerformingAction(false)
      }
    }
  }, [selectedTickets])

  const getTicketUrl = useCallback((ticketId: string) => {
    const role = currentUserRole?.toLowerCase()
    return `/${role}/tickets/${ticketId}`
  }, [currentUserRole])

  const isAllSelected = tickets.length > 0 && selectedTickets.size === tickets.length
  const isIndeterminate = selectedTickets.size > 0 && selectedTickets.size < tickets.length

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <div className='flex items-center space-x-2'>
              {actions}
              <Button
                variant='outline'
                size='sm'
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          {showFilters && (
            <div className='flex flex-col sm:flex-row gap-4 mb-6'>
              <div className='flex-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                  <Input
                    placeholder='Buscar tickets...'
                    value={filters.search || ''}
                    onChange={e => setFilters({ search: e.target.value })}
                    className='pl-10'
                  />
                </div>
              </div>
              <Select value={filters.status || 'all'} onValueChange={value => setFilters({ status: value })}>
                <SelectTrigger className='w-full sm:w-[180px]'>
                  <SelectValue placeholder='Estado' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todos los estados</SelectItem>
                  {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.priority || 'all'} onValueChange={value => setFilters({ priority: value })}>
                <SelectTrigger className='w-full sm:w-[180px]'>
                  <SelectValue placeholder='Prioridad' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todas las prioridades</SelectItem>
                  {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Barra de acciones masivas */}
          {enableMassActions && selectedTickets.size > 0 && (
            <div className='flex items-center justify-between p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg'>
              <div className='flex items-center space-x-3'>
                <span className='text-sm font-medium text-blue-900'>
                  {selectedTickets.size} ticket{selectedTickets.size > 1 ? 's' : ''} seleccionado{selectedTickets.size > 1 ? 's' : ''}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={clearSelection}
                  disabled={isPerformingAction}
                >
                  Limpiar selección
                </Button>
              </div>
              <div className='flex items-center space-x-2'>
                {massActions.map(action => (
                  <Button
                    key={action.id}
                    variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                    size='sm'
                    onClick={() => executeMassAction(action)}
                    disabled={isPerformingAction}
                    className='flex items-center space-x-1'
                  >
                    {action.icon}
                    <span className='hidden sm:inline'>{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Tabla */}
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {enableMassActions && (
                    <TableHead className='w-12'>
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleAllTickets}
                        aria-label='Seleccionar todos los tickets'
                      />
                    </TableHead>
                  )}
                  <TableHead>Ticket</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Asignado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead>Actividad</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={enableMassActions ? 10 : 9} className='text-center py-8'>
                      <div className='flex items-center justify-center'>
                        <RefreshCw className='h-6 w-6 animate-spin mr-2' />
                        <div>
                          <div className='font-medium'>Cargando tickets...</div>
                          <div className='text-sm text-muted-foreground mt-1'>
                            {filters.search ? `Buscando "${filters.search}"` : 'Obteniendo datos del servidor'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={enableMassActions ? 10 : 9} className='text-center py-8'>
                      <div className='flex flex-col items-center space-y-3'>
                        <div className='text-red-500 font-medium'>Error al cargar tickets</div>
                        <div className='text-sm text-muted-foreground max-w-md text-center'>{error.message}</div>
                        <Button 
                          variant='outline' 
                          size='sm' 
                          onClick={refresh}
                          className='mt-2'
                        >
                          <RefreshCw className='h-4 w-4 mr-2' />
                          Reintentar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tickets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={enableMassActions ? 10 : 9} className='text-center py-8'>
                      <div className='flex flex-col items-center space-y-2'>
                        <div className='text-muted-foreground font-medium'>
                          {hasActiveFilters
                            ? 'No se encontraron tickets con los filtros aplicados'
                            : 'No hay tickets disponibles'
                          }
                        </div>
                        {hasActiveFilters && (
                          <Button 
                            variant='outline' 
                            size='sm' 
                            onClick={clearFilters}
                            className='mt-2'
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets.map(ticket => (
                    <TableRow key={ticket.id} className='hover:bg-muted'>
                      {enableMassActions && (
                        <TableCell>
                          <Checkbox
                            checked={selectedTickets.has(ticket.id)}
                            onCheckedChange={() => toggleTicketSelection(ticket.id)}
                            aria-label={`Seleccionar ticket ${ticket.title}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <div>
                          <div className='font-medium text-foreground truncate max-w-[200px]'>
                            {ticket.title}
                          </div>
                          <div className='text-sm text-muted-foreground'>#{ticket.id.slice(-8)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={TICKET_STATUS_COLORS[ticket.status]}>
                          {TICKET_STATUS_LABELS[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={TICKET_PRIORITY_COLORS[ticket.priority]}>
                          {TICKET_PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center space-x-2'>
                          <User className='h-4 w-4 text-muted-foreground' />
                          <div>
                            <div className='font-medium text-sm'>{ticket.client.name}</div>
                            <div className='text-xs text-muted-foreground'>{ticket.client.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.assignee ? (
                          <div className='flex items-center space-x-2'>
                            <User className='h-4 w-4 text-muted-foreground' />
                            <div>
                              <div className='font-medium text-sm'>{ticket.assignee.name}</div>
                              <div className='text-xs text-muted-foreground'>{ticket.assignee.email}</div>
                            </div>
                          </div>
                        ) : (
                          <span className='text-muted-foreground text-sm'>Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center space-x-2'>
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: ticket.category.color }}
                          />
                          <span className='text-sm'>{ticket.category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center space-x-1 text-sm text-muted-foreground'>
                          <Calendar className='h-4 w-4' />
                          <span>{formatTimeAgo(ticket.createdAt)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex items-center space-x-3 text-sm text-muted-foreground'>
                          {ticket._count.comments > 0 && (
                            <div className='flex items-center space-x-1'>
                              <MessageSquare className='h-4 w-4' />
                              <span>{ticket._count.comments}</span>
                            </div>
                          )}
                          {ticket._count.attachments > 0 && (
                            <div className='flex items-center space-x-1'>
                              <Paperclip className='h-4 w-4' />
                              <span>{ticket._count.attachments}</span>
                            </div>
                          )}
                          <div className='flex items-center space-x-1'>
                            <Clock className='h-4 w-4' />
                            <span>{formatTimeAgo(ticket.updatedAt)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button variant='outline' size='sm' asChild>
                          <Link href={getTicketUrl(ticket.id)}>
                            <Eye className='h-4 w-4' />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Paginación optimizada */}
          {!loading && !error && pagination.totalPages > 1 && (
            <div className='flex flex-col sm:flex-row items-center justify-between mt-6 gap-4'>
              <div className='text-sm text-muted-foreground'>
                {pagination.total > 0 ? (
                  <>
                    Mostrando {(pagination.page - 1) * pagination.limit + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} tickets
                    {hasActiveFilters && (
                      <span className='text-blue-600 ml-1'>(filtrados)</span>
                    )}
                  </>
                ) : (
                  'No hay tickets para mostrar'
                )}
              </div>
              <div className='flex items-center space-x-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                >
                  <ChevronLeft className='h-4 w-4' />
                  <span className='hidden sm:inline ml-1'>Anterior</span>
                </Button>
                
                <div className='flex items-center space-x-1'>
                  {/* Paginación inteligente */}
                  {(() => {
                    const pages = []
                    const maxVisiblePages = 5
                    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2))
                    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)
                    
                    if (endPage - startPage + 1 < maxVisiblePages) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1)
                    }
                    
                    if (startPage > 1) {
                      pages.push(
                        <Button
                          key={1}
                          variant='outline'
                          size='sm'
                          onClick={() => goToPage(1)}
                          disabled={loading}
                        >
                          1
                        </Button>
                      )
                      if (startPage > 2) {
                        pages.push(<span key="ellipsis1" className='px-2 text-muted-foreground'>...</span>)
                      }
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={pagination.page === i ? 'default' : 'outline'}
                          size='sm'
                          onClick={() => goToPage(i)}
                          disabled={loading}
                        >
                          {i}
                        </Button>
                      )
                    }
                    
                    if (endPage < pagination.totalPages) {
                      if (endPage < pagination.totalPages - 1) {
                        pages.push(<span key="ellipsis2" className='px-2 text-muted-foreground'>...</span>)
                      }
                      pages.push(
                        <Button
                          key={pagination.totalPages}
                          variant='outline'
                          size='sm'
                          onClick={() => goToPage(pagination.totalPages)}
                          disabled={loading}
                        >
                          {pagination.totalPages}
                        </Button>
                      )
                    }
                    
                    return pages
                  })()}
                </div>
                
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages || loading}
                >
                  <span className='hidden sm:inline mr-1'>Siguiente</span>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmación */}
      <AlertDialog open={confirmationDialog.isOpen} onOpenChange={(open) => 
        setConfirmationDialog(prev => ({ ...prev, isOpen: open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPerformingAction}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmationDialog.action}
              disabled={isPerformingAction}
            >
              {isPerformingAction ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}