'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Ticket,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserX
} from 'lucide-react'
import Link from 'next/link'

// Componentes
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { Button } from '@/components/ui/button'
import { createAdminTicketColumns } from '@/components/tickets/admin/ticket-columns'

// Hooks
import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'

// Función para filtrar tickets (como filterTechnicians)
function filterTickets(tickets: TicketType[], filters: any) {
  return tickets.filter(ticket => {
    // Búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        ticket.title.toLowerCase().includes(searchLower) ||
        (ticket.description && ticket.description.toLowerCase().includes(searchLower)) ||
        (ticket.client?.name && ticket.client.name.toLowerCase().includes(searchLower)) ||
        (ticket.assignee?.name && ticket.assignee.name.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Estado
    if (filters.status !== 'all' && ticket.status !== filters.status) return false

    // Prioridad
    if (filters.priority !== 'all' && ticket.priority !== filters.priority) return false

    // Categoría
    if (filters.category !== 'all' && ticket.category?.id !== filters.category) return false

    // Asignado
    if (filters.assignee === 'unassigned' && ticket.assignee) return false
    if (filters.assignee !== 'all' && filters.assignee !== 'unassigned' && ticket.assignee?.id !== filters.assignee) return false

    return true
  })
}

export default function AdminTicketsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  // Cargar TODOS los tickets UNA VEZ (como técnicos)
  const {
    data: allTickets,
    loading,
    error,
    reload
  } = useModuleData<TicketType>({
    endpoint: '/api/tickets',
    initialLoad: true
  })

  // Cargar categorías
  const { data: categories } = useModuleData<{ id: string; name: string }>({
    endpoint: '/api/categories?isActive=true',
    initialLoad: true
  })

  // Filtros
  const {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    hasActiveFilters
  } = useTicketFilters()

  // Filtrar en MEMORIA (como técnicos)
  const filteredTickets = useMemo(() => {
    return filterTickets(allTickets, debouncedFilters)
  }, [allTickets, debouncedFilters])

  // Paginación
  const pagination = usePagination(filteredTickets, {
    pageSize: 20
  })

  // Estadísticas
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return {
      total: filteredTickets.length,
      open: filteredTickets.filter(t => t.status === 'OPEN').length,
      inProgress: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: filteredTickets.filter(t => t.status === 'RESOLVED').length,
      closed: filteredTickets.filter(t => t.status === 'CLOSED').length,
      highPriority: filteredTickets.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length,
      avgResolutionTime: 'N/A',
      todayCreated: filteredTickets.filter(t => {
        const createdDate = new Date(t.createdAt)
        createdDate.setHours(0, 0, 0, 0)
        return createdDate.getTime() === today.getTime()
      }).length,
      unassigned: filteredTickets.filter(t => !t.assignee).length
    }
  }, [filteredTickets])

  // Handlers
  const handleViewTicket = (ticket: TicketType) => {
    router.push(`/admin/tickets/${ticket.id}`)
  }

  const handleEditTicket = (ticket: TicketType) => {
    router.push(`/admin/tickets/${ticket.id}/edit`)
  }

  // Configuración de paginación
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <ModuleLayout
      title='Gestión de Tickets'
      subtitle='Administrar todos los tickets del sistema'
      loading={loading && allTickets.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <Button size='sm' asChild>
          <Link href='/admin/tickets/create'>
            <Plus className='h-4 w-4 mr-2' />
            Crear Ticket
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Panel de Estadísticas con Tema ADMIN */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Total Tickets"
            value={stats.total}
            icon={Ticket}
            color="purple"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Abiertos"
            value={stats.open}
            icon={AlertCircle}
            color="blue"
            role="ADMIN"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.open / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
            status={stats.open > 10 ? 'warning' : 'normal'}
          />
          
          <SymmetricStatsCard
            title="En Progreso"
            value={stats.inProgress}
            icon={Clock}
            color="orange"
            role="ADMIN"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.inProgress / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
          />
          
          <SymmetricStatsCard
            title="Sin Asignar"
            value={stats.unassigned}
            icon={UserX}
            color="red"
            role="ADMIN"
            status={stats.unassigned > 5 ? 'error' : 'normal'}
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.unassigned / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
          />
        </div>

        {/* Filtros */}
        <TicketFilters
          searchTerm={filters.search}
          statusFilter={filters.status}
          priorityFilter={filters.priority}
          categoryFilter={filters.category}
          assigneeFilter={filters.assignee}
          setSearchTerm={(term) => setFilter('search', term)}
          onStatusChange={(status) => setFilter('status', status)}
          onPriorityChange={(priority) => setFilter('priority', priority)}
          onCategoryChange={(category) => setFilter('category', category)}
          onAssigneeChange={(assignee) => setFilter('assignee', assignee)}
          onRefresh={reload}
          onClearFilters={clearFilters}
          categories={categories}
          variant="admin"
          loading={loading}
          showAssigneeFilter={true}
          searchPlaceholder="Buscar por título, descripción, cliente o técnico..."
        />

        {/* DataTable */}
        <DataTable
          title="Tickets"
          description={`Gestión de tickets del sistema (${filteredTickets.length} tickets)`}
          data={pagination.currentItems}
          columns={createAdminTicketColumns({
            onView: handleViewTicket,
            onEdit: handleEditTicket,
          })}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={reload}
          externalSearch={true}
          hideInternalFilters={true}
          onRowClick={handleViewTicket}
          emptyState={{
            icon: <Ticket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
            title: hasActiveFilters ? "No se encontraron tickets" : "No hay tickets",
            description: hasActiveFilters
              ? "Intenta ajustar los filtros de búsqueda"
              : "No se encontraron tickets en el sistema",
            action: hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/tickets/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer ticket
                </Link>
              </Button>
            )
          }}
        />
      </div>
    </ModuleLayout>
  )
}
