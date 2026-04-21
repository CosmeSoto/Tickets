'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
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

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { createClientTicketColumns } from '@/components/tickets/client/ticket-columns'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { filterTicketsClient } from '@/lib/utils/ticket-filters'
import { useFamilies } from '@/contexts/families-context'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isOwnFamily?: boolean
}

export default function ClientTicketsPage() {
  const { data: session } = useSession()
  const router = useRouter()

  // Familias desde el contexto global (cache Redis, sin peticion extra)
  const { families } = useFamilies()

  const { data: allTickets, loading, error, reload } = useModuleData<TicketType>({
    endpoint: '/api/tickets',
    initialLoad: true,
  })

  // Familias ya disponibles desde el contexto global

  const { filters, debouncedFilters, setFilter, clearFilters, hasActiveFilters } = useTicketFilters()

  // Resetear categoría cuando cambia la familia
  const prevFamilyRef = useRef(filters.family)
  useEffect(() => {
    if (prevFamilyRef.current !== filters.family) {
      prevFamilyRef.current = filters.family
      if (filters.category !== 'all') setFilter('category', 'all')
    }
  }, [filters.family])

  const filteredTickets = useMemo(() => {
    if (!session?.user?.id) return []
    return filterTicketsClient(allTickets, debouncedFilters, session.user.id)
  }, [allTickets, debouncedFilters, session?.user?.id])

  // Categorías derivadas de los tickets del cliente filtrados por familia
  const categories = useMemo(() => {
    if (!session?.user?.id) return []
    const seen = new Map<string, { id: string; name: string }>()
    allTickets
      .filter(t =>
        t.client?.id === session.user.id &&
        (debouncedFilters.family === 'all' || t.family?.id === debouncedFilters.family)
      )
      .forEach(t => {
        if (t.category && !seen.has(t.category.id)) {
          seen.set(t.category.id, { id: t.category.id, name: t.category.name })
        }
      })
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allTickets, debouncedFilters.family, session?.user?.id])

  const pagination = usePagination(filteredTickets, { pageSize: 20 })

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
      if (avgMinutes < 60) avgResponseTime = `${Math.round(avgMinutes)}m`
      else if (avgMinutes < 1440) avgResponseTime = `${Math.round(avgMinutes / 60)}h`
      else avgResponseTime = `${Math.round(avgMinutes / 1440)}d`
    }
    return {
      total: filteredTickets.length,
      open: filteredTickets.filter(t => t.status === 'OPEN').length,
      inProgress: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: filteredTickets.filter(t => t.status === 'RESOLVED').length,
      avgResponseTime,
    }
  }, [filteredTickets])

  const handleViewTicket = (ticket: TicketType) => router.push(`/client/tickets/${ticket.id}`)

  // Exportación — tickets del cliente con filtros activos
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'mis-tickets',
    title: 'Mis Tickets',
    subtitle: `${session?.user?.name ?? ''} • ${filteredTickets.length} tickets`,
    getData: () => filteredTickets,
    columns: [
      { key: 'ticketCode', label: 'Código', format: (v, r) => v ?? r.id.slice(-8).toUpperCase() },
      { key: 'title', label: 'Título' },
      { key: 'status', label: 'Estado', format: (v: string) => ({ OPEN: 'Abierto', IN_PROGRESS: 'En Progreso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado' } as Record<string, string>)[v] ?? v },
      { key: 'priority', label: 'Prioridad', format: (v: string) => ({ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' } as Record<string, string>)[v] ?? v },
      { key: 'assignee', label: 'Técnico', format: v => v?.name ?? 'Sin asignar' },
      { key: 'category', label: 'Categoría', format: v => v?.name ?? '' },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'createdAt', label: 'Creado', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
      { key: 'updatedAt', label: 'Actualizado', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
    ],
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'CLIENT') return null

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
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard title="Total Tickets" value={stats.total} icon={TicketIcon} color="blue" role="CLIENT" />
          <SymmetricStatsCard
            title="Abiertos"
            value={stats.open}
            icon={AlertCircle}
            color="orange"
            role="CLIENT"
            badge={stats.total > 0 ? { text: `${Math.round((stats.open / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
            status={stats.open > 3 ? 'warning' : 'normal'}
          />
          <SymmetricStatsCard
            title="En Progreso"
            value={stats.inProgress}
            icon={Clock}
            color="orange"
            role="CLIENT"
            badge={stats.total > 0 ? { text: `${Math.round((stats.inProgress / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
          />
          <SymmetricStatsCard
            title="Resueltos"
            value={stats.resolved}
            icon={CheckCircle}
            color="green"
            role="CLIENT"
            status="success"
            badge={stats.total > 0 ? { text: `${Math.round((stats.resolved / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
          />
        </div>

        <TicketFilters
          searchTerm={filters.search}
          statusFilter={filters.status}
          priorityFilter={filters.priority}
          categoryFilter={filters.category}
          dateFilter={filters.dateRange}
          familyFilter={filters.family}
          setSearchTerm={(term) => setFilter('search', term)}
          onStatusChange={(status) => setFilter('status', status)}
          onPriorityChange={(priority) => setFilter('priority', priority)}
          onCategoryChange={(category) => setFilter('category', category)}
          onDateChange={(date) => setFilter('dateRange', date)}
          onFamilyChange={(family) => setFilter('family', family)}
          onRefresh={reload}
          onClearFilters={clearFilters}
          categories={categories}
          families={families}
          variant="client"
          loading={loading}
          showDateFilter={true}
          showAssigneeFilter={false}
          searchPlaceholder="Buscar en mis tickets..."
        />

        <DataTable
          title="Mis Solicitudes de Soporte"
          description={`Tickets que has creado (${filteredTickets.length} tickets)`}
          data={pagination.currentItems}
          columns={createClientTicketColumns({ onView: handleViewTicket })}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={reload}
          externalSearch={true}
          hideInternalFilters={true}
          onRowClick={handleViewTicket}
          actions={
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
              disabled={filteredTickets.length === 0}
            />
          }
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
              <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
            ),
          }}
        />
      </div>
    </ModuleLayout>
  )
}
