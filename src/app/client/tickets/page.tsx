'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Plus,
  Ticket as TicketIcon,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react'
import Link from 'next/link'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'

// Componentes específicos del módulo
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { clientTicketColumns, createClientTicketColumns } from '@/components/tickets/client/ticket-columns'
import { Button } from '@/components/ui/button'

// Hooks y tipos
import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { filterTicketsClient } from '@/lib/utils/ticket-filters'

export default function ClientTicketsPage() {
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
    if (!session?.user?.id) return []
    return filterTicketsClient(allTickets, debouncedFilters, session.user.id)
  }, [allTickets, debouncedFilters, session?.user?.id])

  // Paginación
  const pagination = usePagination(filteredTickets, {
    pageSize: 20
  })

  // Estadísticas
  const stats = useMemo(() => {
    const respondedTickets = filteredTickets.filter(t => t.status !== 'OPEN' && t.updatedAt !== t.createdAt)
    
    let avgResponseTime = 'N/A'
    if (respondedTickets.length > 0) {
      const totalMinutes = respondedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt).getTime()
        const updated = new Date(ticket.updatedAt).getTime()
        return sum + (updated - created) / (1000 * 60)
      }, 0)

      const avgMinutes = totalMinutes / respondedTickets.length
      
      if (avgMinutes < 60) {
        avgResponseTime = `${Math.round(avgMinutes)}m`
      } else if (avgMinutes < 1440) {
        avgResponseTime = `${Math.round(avgMinutes / 60)}h`
      } else {
        avgResponseTime = `${Math.round(avgMinutes / 1440)}d`
      }
    }

    return {
      total: filteredTickets.length,
      open: filteredTickets.filter(t => t.status === 'OPEN').length,
      inProgress: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: filteredTickets.filter(t => t.status === 'RESOLVED').length,
      pending: filteredTickets.filter(t => !t.assignee).length,
      avgResponseTime
    }
  }, [filteredTickets])

  // Handlers
  const handleViewTicket = (ticket: TicketType) => {
    router.push(`/client/tickets/${ticket.id}`)
  }

  // Configuración de paginación
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'CLIENT') {
    return null
  }

  return (
    <ModuleLayout
      title='Mis Tickets'
      subtitle='Gestiona tus solicitudes de soporte'
      loading={loading && allTickets.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <Button size="sm" asChild>
          <Link href="/client/tickets/create">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Ticket
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Panel de Estadísticas con Tema CLIENT */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Total Tickets"
            value={stats.total}
            icon={TicketIcon}
            color="blue"
            role="CLIENT"
          />
          
          <SymmetricStatsCard
            title="Abiertos"
            value={stats.open}
            icon={AlertCircle}
            color="orange"
            role="CLIENT"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.open / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
            status={stats.open > 3 ? 'warning' : 'normal'}
          />
          
          <SymmetricStatsCard
            title="En Progreso"
            value={stats.inProgress}
            icon={Clock}
            color="orange"
            role="CLIENT"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.inProgress / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
          />
          
          <SymmetricStatsCard
            title="Resueltos"
            value={stats.resolved}
            icon={CheckCircle}
            color="green"
            role="CLIENT"
            status="success"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.resolved / stats.total) * 100)}%`,
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
          dateFilter={filters.dateRange}
          setSearchTerm={(term) => setFilter('search', term)}
          onStatusChange={(status) => setFilter('status', status)}
          onPriorityChange={(priority) => setFilter('priority', priority)}
          onCategoryChange={(category) => setFilter('category', category)}
          onDateChange={(date) => setFilter('dateRange', date)}
          onRefresh={reload}
          onClearFilters={clearFilters}
          categories={categories}
          variant="client"
          loading={loading}
          showDateFilter={true}
          showAssigneeFilter={false}
          searchPlaceholder="Buscar en mis tickets..."
        />

        {/* DataTable */}
        <DataTable
          title="Mis Solicitudes de Soporte"
          description={`Tickets que has creado (${filteredTickets.length} tickets)`}
          data={pagination.currentItems}
          columns={createClientTicketColumns({
            onView: handleViewTicket,
          })}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={reload}
          externalSearch={true}
          hideInternalFilters={true}
          onRowClick={handleViewTicket}
          emptyState={{
            icon: <TicketIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
            title: hasActiveFilters ? "No se encontraron tickets" : "No tienes tickets",
            description: hasActiveFilters
              ? "Intenta ajustar los filtros de búsqueda"
              : "Aún no has creado ninguna solicitud de soporte",
            action: !hasActiveFilters ? (
              <Button asChild>
                <Link href="/client/tickets/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear mi primer ticket
                </Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )
          }}
        />
      </div>
    </ModuleLayout>
  )
}