'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Target,
  Ticket as TicketIcon,
  BarChart3,
  FolderTree,
  BookOpen,
} from 'lucide-react'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'
import Link from 'next/link'

// Componentes específicos del módulo
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { technicianTicketColumns, createTechnicianTicketColumns } from '@/components/tickets/technician/ticket-columns'
import { Button } from '@/components/ui/button'

// Hooks y tipos
import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'

// Función para filtrar tickets (como filterTechnicians)
function filterTickets(tickets: TicketType[], filters: any, technicianId: string) {
  return tickets.filter(ticket => {
    // Solo tickets asignados al técnico actual
    if (ticket.assignee?.id !== technicianId) return false

    // Búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        ticket.title.toLowerCase().includes(searchLower) ||
        (ticket.description && ticket.description.toLowerCase().includes(searchLower)) ||
        (ticket.client?.name && ticket.client.name.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Estado
    if (filters.status !== 'all' && ticket.status !== filters.status) return false

    // Prioridad
    if (filters.priority !== 'all' && ticket.priority !== filters.priority) return false

    // Categoría
    if (filters.category !== 'all' && ticket.category?.id !== filters.category) return false

    // Fecha
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const createdDate = new Date(ticket.createdAt)
      
      switch (filters.dateRange) {
        case 'today':
          if (createdDate < today) return false
          break
        case 'yesterday':
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          if (createdDate < yesterday || createdDate >= today) return false
          break
        case 'week':
          const weekAgo = new Date(today)
          weekAgo.setDate(weekAgo.getDate() - 7)
          if (createdDate < weekAgo) return false
          break
        case 'month':
          const monthAgo = new Date(today)
          monthAgo.setMonth(monthAgo.getMonth() - 1)
          if (createdDate < monthAgo) return false
          break
        case 'older':
          const monthAgoOlder = new Date(today)
          monthAgoOlder.setMonth(monthAgoOlder.getMonth() - 1)
          if (createdDate >= monthAgoOlder) return false
          break
      }
    }

    return true
  })
}

export default function TechnicianTicketsPage() {
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
    return filterTickets(allTickets, debouncedFilters, session.user.id)
  }, [allTickets, debouncedFilters, session?.user?.id])

  // Paginación
  const pagination = usePagination(filteredTickets, {
    pageSize: 20
  })

  // Estadísticas
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const resolvedTickets = filteredTickets.filter(t => t.status === 'RESOLVED' && t.resolvedAt)
    
    let avgResolutionTime = 'N/A'
    if (resolvedTickets.length > 0) {
      const totalMinutes = resolvedTickets.reduce((sum, ticket) => {
        const created = new Date(ticket.createdAt).getTime()
        const resolved = new Date(ticket.resolvedAt!).getTime()
        return sum + (resolved - created) / (1000 * 60)
      }, 0)

      const avgMinutes = totalMinutes / resolvedTickets.length
      
      if (avgMinutes < 60) {
        avgResolutionTime = `${Math.round(avgMinutes)}m`
      } else if (avgMinutes < 1440) {
        avgResolutionTime = `${Math.round(avgMinutes / 60)}h`
      } else {
        avgResolutionTime = `${Math.round(avgMinutes / 1440)}d`
      }
    }

    return {
      total: filteredTickets.length,
      open: filteredTickets.filter(t => t.status === 'OPEN').length,
      inProgress: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: filteredTickets.filter(t => t.status === 'RESOLVED').length,
      highPriority: filteredTickets.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length,
      resolvedToday: filteredTickets.filter(t => {
        if (t.status !== 'RESOLVED' || !t.resolvedAt) return false
        const resolvedDate = new Date(t.resolvedAt)
        resolvedDate.setHours(0, 0, 0, 0)
        return resolvedDate.getTime() === today.getTime()
      }).length,
      avgResolutionTime
    }
  }, [filteredTickets])

  // Handlers
  const handleViewTicket = (ticket: TicketType) => {
    router.push(`/technician/tickets/${ticket.id}`)
  }

  // Configuración de paginación
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'TECHNICIAN') {
    return null
  }

  return (
    <ModuleLayout
      title='Mis Tickets Asignados'
      subtitle='Gestiona los tickets que tienes asignados'
      loading={loading && allTickets.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <div className="flex gap-2">
          <Link href="/technician/stats">
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Estadísticas
            </Button>
          </Link>
          <Link href="/technician/categories">
            <Button variant="outline" size="sm">
              <FolderTree className="mr-2 h-4 w-4" />
              Mis Categorías
            </Button>
          </Link>
          <Link href="/technician/knowledge">
            <Button variant="outline" size="sm">
              <BookOpen className="mr-2 h-4 w-4" />
              Conocimientos
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Panel de Estadísticas con Tema TECHNICIAN */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Abiertos"
            value={stats.open}
            icon={AlertCircle}
            color="orange"
            role="TECHNICIAN"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.open / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
            status={stats.open > 5 ? 'warning' : 'normal'}
          />
          
          <SymmetricStatsCard
            title="En Progreso"
            value={stats.inProgress}
            icon={Clock}
            color="blue"
            role="TECHNICIAN"
            badge={stats.total > 0 ? {
              text: `${Math.round((stats.inProgress / stats.total) * 100)}%`,
              variant: 'secondary'
            } : undefined}
          />
          
          <SymmetricStatsCard
            title="Resueltos Hoy"
            value={stats.resolvedToday}
            icon={CheckCircle}
            color="green"
            role="TECHNICIAN"
            status="success"
            trend={stats.resolvedToday > 0 ? {
              value: stats.resolvedToday,
              label: 'completados',
              isPositive: true
            } : undefined}
          />
          
          <SymmetricStatsCard
            title="Tiempo Promedio"
            value={stats.avgResolutionTime}
            icon={Target}
            color="purple"
            role="TECHNICIAN"
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
          variant="technician"
          loading={loading}
          showDateFilter={true}
          showAssigneeFilter={false}
          searchPlaceholder="Buscar por título, descripción o cliente..."
        />

        {/* DataTable */}
        <DataTable
          title="Mis Tickets Asignados"
          description={`Tickets que tienes asignados para resolver (${filteredTickets.length} tickets)`}
          data={pagination.currentItems}
          columns={createTechnicianTicketColumns({
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
            title: hasActiveFilters ? "No se encontraron tickets" : "No hay tickets asignados",
            description: hasActiveFilters
              ? "Intenta ajustar los filtros de búsqueda"
              : "No tienes tickets asignados en este momento",
            action: hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }}
        />
      </div>
    </ModuleLayout>
  )
}