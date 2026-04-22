'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import Link from 'next/link'
import {
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from '@/lib/utils/ticket-utils'

interface Ticket {
  id: string
  title: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  client: { id: string; name: string; email: string }
  assignee?: { id: string; name: string; email: string }
  category: { id: string; name: string; color: string }
  createdAt: string
  updatedAt: string
  _count: { comments: number; attachments: number }
}

interface TicketTableProps {
  title?: string
  description?: string
  showFilters?: boolean
  defaultFilters?: {
    status?: string
    priority?: string
    assigneeId?: string
  }
  actions?: React.ReactNode
}

const statusLabels = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
}

const priorityLabels = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export function TicketTable({
  title = 'Tickets',
  description = 'Gestión de tickets de soporte',
  showFilters = true,
  defaultFilters = {},
  actions,
}: TicketTableProps) {
  const { data: session } = useSession()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Filtros con debounce optimizado
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(defaultFilters.status || 'all')
  const [priorityFilter, setPriorityFilter] = useState(defaultFilters.priority || 'all')
  const [assigneeFilter, setAssigneeFilter] = useState(defaultFilters.assigneeId || 'all')

  // Debounce para búsqueda - optimización crítica
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300) // 300ms debounce para mejor UX

    return () => clearTimeout(timer)
  }, [search])

  // Función optimizada de carga con mejor error handling
  const loadTickets = useCallback(
    async (page = 1) => {
      if (!session?.user) {
        setTickets([])
        setTotal(0)
        setTotalPages(1)
        setCurrentPage(1)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '25', // Aumentado para mejor performance
        })

        // Solo agregar filtros si tienen valor
        if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim())
        if (statusFilter !== 'all') params.append('status', statusFilter)
        if (priorityFilter !== 'all') params.append('priority', priorityFilter)
        if (assigneeFilter !== 'all') params.append('assigneeId', assigneeFilter)

        const response = await fetch(`/api/tickets?${params}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          // Error handling granular - optimización crítica
          if (response.status === 401) {
            throw new Error('No tienes permisos para ver los tickets')
          } else if (response.status === 403) {
            throw new Error('Acceso denegado a los tickets')
          } else if (response.status === 404) {
            throw new Error('No se encontraron tickets')
          } else if (response.status >= 500) {
            throw new Error('Error del servidor. Intenta de nuevo en unos momentos')
          } else {
            throw new Error(`Error ${response.status}: ${response.statusText}`)
          }
        }

        const data = await response.json()

        // Manejar diferentes estructuras de respuesta con validación
        if (data.success && data.data) {
          const ticketsData = Array.isArray(data.data) ? data.data : []
          setTickets(ticketsData)
          setTotal(data.meta?.pagination?.total || ticketsData.length)
          setTotalPages(data.meta?.pagination?.totalPages || 1)
          setCurrentPage(data.meta?.pagination?.page || page)
        } else if (data.tickets) {
          const ticketsData = Array.isArray(data.tickets) ? data.tickets : []
          setTickets(ticketsData)
          setTotal(data.total || ticketsData.length)
          setTotalPages(data.pages || 1)
          setCurrentPage(data.currentPage || page)
        } else {
          // Respuesta válida pero sin datos
          setTickets([])
          setTotal(0)
          setTotalPages(1)
          setCurrentPage(1)
        }
      } catch (error) {
        console.error('Error loading tickets:', error)

        // Error handling granular con mensajes específicos
        if (error instanceof Error) {
          setError(error.message)
        } else {
          setError(
            'Error inesperado al cargar los tickets. Verifica tu conexión e intenta de nuevo.'
          )
        }

        // Limpiar estado en caso de error
        setTickets([])
        setTotal(0)
        setTotalPages(1)
        setCurrentPage(1)
      } finally {
        setLoading(false)
      }
    },
    [session, debouncedSearch, statusFilter, priorityFilter, assigneeFilter]
  )

  // Efecto optimizado que solo se ejecuta cuando cambian los filtros debounced
  useEffect(() => {
    loadTickets(1)
  }, [loadTickets])

  // Función memoizada para cambio de página
  const handlePageChange = useCallback(
    (page: number) => {
      if (page !== currentPage && !loading) {
        loadTickets(page)
      }
    },
    [currentPage, loading, loadTickets]
  )

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}min`
    return 'Ahora'
  }

  const getTicketUrl = (ticketId: string) => {
    const role = session?.user?.role?.toLowerCase()
    return `/${role}/tickets/${ticketId}`
  }

  return (
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
              onClick={() => loadTickets(currentPage)}
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
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className='w-full sm:w-[180px]'>
                <SelectValue placeholder='Estado' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los estados</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className='w-full sm:w-[180px]'>
                <SelectValue placeholder='Prioridad' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las prioridades</SelectItem>
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Tabla con estados de error granulares */}
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={9} className='text-center py-8'>
                    <div className='flex items-center justify-center'>
                      <RefreshCw className='h-6 w-6 animate-spin mr-2' />
                      <div>
                        <div className='font-medium'>Cargando tickets...</div>
                        <div className='text-sm text-muted-foreground mt-1'>
                          {debouncedSearch
                            ? `Buscando "${debouncedSearch}"`
                            : 'Obteniendo datos del servidor'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9} className='text-center py-8'>
                    <div className='flex flex-col items-center space-y-3'>
                      <div className='text-destructive font-medium'>Error al cargar tickets</div>
                      <div className='text-sm text-muted-foreground max-w-md text-center'>
                        {error}
                      </div>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => loadTickets(currentPage)}
                        className='mt-2'
                      >
                        <RefreshCw className='h-4 w-4 mr-2' />
                        Reintentar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : tickets && tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className='text-center py-8'>
                    <div className='flex flex-col items-center space-y-2'>
                      <div className='text-muted-foreground font-medium'>
                        {debouncedSearch ||
                        statusFilter !== 'all' ||
                        priorityFilter !== 'all' ||
                        assigneeFilter !== 'all'
                          ? 'No se encontraron tickets con los filtros aplicados'
                          : 'No hay tickets disponibles'}
                      </div>
                      {(debouncedSearch ||
                        statusFilter !== 'all' ||
                        priorityFilter !== 'all' ||
                        assigneeFilter !== 'all') && (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            setSearch('')
                            setStatusFilter('all')
                            setPriorityFilter('all')
                            setAssigneeFilter('all')
                          }}
                          className='mt-2'
                        >
                          Limpiar filtros
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (tickets || []).map(ticket => (
                  <TableRow key={ticket.id} className='hover:bg-muted'>
                    <TableCell>
                      <div>
                        <div className='font-medium text-foreground truncate max-w-[200px]'>
                          {ticket.title}
                        </div>
                        <div className='text-sm text-muted-foreground'>#{ticket.id.slice(-8)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(ticket.status)}>
                        {getStatusLabel(ticket.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {getPriorityLabel(ticket.priority)}
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
                            <div className='text-xs text-muted-foreground'>
                              {ticket.assignee.email}
                            </div>
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
                        <span>{getTimeAgo(ticket.createdAt)}</span>
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
                          <span>{getTimeAgo(ticket.updatedAt)}</span>
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
        {!loading && !error && totalPages > 1 && (
          <div className='flex flex-col sm:flex-row items-center justify-between mt-6 gap-4'>
            <div className='text-sm text-muted-foreground'>
              {total > 0 ? (
                <>
                  Mostrando {(currentPage - 1) * 25 + 1} a {Math.min(currentPage * 25, total)} de{' '}
                  {total} tickets
                  {(debouncedSearch ||
                    statusFilter !== 'all' ||
                    priorityFilter !== 'all' ||
                    assigneeFilter !== 'all') && (
                    <span className='text-primary ml-1'>(filtrados)</span>
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
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || loading}
              >
                <ChevronLeft className='h-4 w-4' />
                <span className='hidden sm:inline ml-1'>Anterior</span>
              </Button>

              <div className='flex items-center space-x-1'>
                {/* Paginación inteligente */}
                {(() => {
                  const pages = []
                  const maxVisiblePages = 5
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
                  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

                  // Ajustar si estamos cerca del final
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1)
                  }

                  // Mostrar primera página si no está visible
                  if (startPage > 1) {
                    pages.push(
                      <Button
                        key={1}
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(1)}
                        disabled={loading}
                      >
                        1
                      </Button>
                    )
                    if (startPage > 2) {
                      pages.push(
                        <span key='ellipsis1' className='px-2 text-muted-foreground'>
                          ...
                        </span>
                      )
                    }
                  }

                  // Páginas visibles
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={i}
                        variant={currentPage === i ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => handlePageChange(i)}
                        disabled={loading}
                      >
                        {i}
                      </Button>
                    )
                  }

                  // Mostrar última página si no está visible
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key='ellipsis2' className='px-2 text-muted-foreground'>
                          ...
                        </span>
                      )
                    }
                    pages.push(
                      <Button
                        key={totalPages}
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(totalPages)}
                        disabled={loading}
                      >
                        {totalPages}
                      </Button>
                    )
                  }

                  return pages
                })()}
              </div>

              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
              >
                <span className='hidden sm:inline mr-1'>Siguiente</span>
                <ChevronRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        )}

        {/* Información adicional para debugging en desarrollo */}
        {process.env.NODE_ENV === 'development' && (
          <div className='mt-4 p-3 bg-muted rounded-md text-xs text-muted-foreground'>
            <div className='grid grid-cols-2 gap-2'>
              <div>Página actual: {currentPage}</div>
              <div>Total páginas: {totalPages}</div>
              <div>Total tickets: {total}</div>
              <div>
                Filtros activos:{' '}
                {[
                  debouncedSearch && `búsqueda: "${debouncedSearch}"`,
                  statusFilter !== 'all' && `estado: ${statusFilter}`,
                  priorityFilter !== 'all' && `prioridad: ${priorityFilter}`,
                  assigneeFilter !== 'all' && `asignado: ${assigneeFilter}`,
                ]
                  .filter(Boolean)
                  .join(', ') || 'ninguno'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
