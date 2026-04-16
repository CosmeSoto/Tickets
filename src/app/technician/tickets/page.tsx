'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
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

import { ModuleLayout } from '@/components/common/layout/module-layout'
import Link from 'next/link'

import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { createTechnicianTicketColumns } from '@/components/tickets/technician/ticket-columns'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { filterTicketsTechnician } from '@/lib/utils/ticket-filters'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
}

export default function TechnicianTicketsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [families, setFamilies] = useState<FamilyOption[]>([])

  const { data: allTickets, loading, error, reload } = useModuleData<TicketType>({
    endpoint: '/api/tickets',
    initialLoad: true,
  })

  // Cargar familias asignadas al técnico
  useEffect(() => {
    fetch('/api/families')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setFamilies(d.data.map((f: any) => ({
            id: f.id,
            name: f.name,
            code: f.code,
            color: f.color,
          })))
        }
      })
      .catch(() => {})
  }, [])

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
    return filterTicketsTechnician(allTickets, debouncedFilters, session.user.id)
  }, [allTickets, debouncedFilters, session?.user?.id])

  // Categorías derivadas de los tickets del técnico filtrados por familia
  const categories = useMemo(() => {
    if (!session?.user?.id) return []
    const seen = new Map<string, { id: string; name: string }>()
    allTickets
      .filter(t =>
        t.assignee?.id === session.user.id &&
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
      if (avgMinutes < 60) avgResolutionTime = `${Math.round(avgMinutes)}m`
      else if (avgMinutes < 1440) avgResolutionTime = `${Math.round(avgMinutes / 60)}h`
      else avgResolutionTime = `${Math.round(avgMinutes / 1440)}d`
    }

    return {
      total: filteredTickets.length,
      open: filteredTickets.filter(t => t.status === 'OPEN').length,
      inProgress: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolvedToday: filteredTickets.filter(t => {
        if (t.status !== 'RESOLVED' || !t.resolvedAt) return false
        const d = new Date(t.resolvedAt)
        d.setHours(0, 0, 0, 0)
        return d.getTime() === today.getTime()
      }).length,
      avgResolutionTime,
    }
  }, [filteredTickets])

  const handleViewTicket = (ticket: TicketType) => router.push(`/technician/tickets/${ticket.id}`)

  // Exportación — tickets asignados al técnico con filtros activos
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'mis-tickets',
    title: 'Mis Tickets Asignados',
    subtitle: `${session?.user?.name ?? ''} • ${filteredTickets.length} tickets`,
    getData: () => filteredTickets,
    columns: [
      { key: 'ticketCode', label: 'Código', format: (v, r) => v ?? r.id.slice(-8).toUpperCase() },
      { key: 'title', label: 'Título' },
      { key: 'status', label: 'Estado', format: v => ({ OPEN: 'Abierto', IN_PROGRESS: 'En Progreso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado', ON_HOLD: 'En Espera' }[v] ?? v) },
      { key: 'priority', label: 'Prioridad', format: v => ({ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' }[v] ?? v) },
      { key: 'client', label: 'Cliente', format: v => v?.name ?? '' },
      { key: 'category', label: 'Categoría', format: v => v?.name ?? '' },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'createdAt', label: 'Creado', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
      { key: 'resolvedAt', label: 'Resuelto', format: v => v ? new Date(v).toLocaleDateString('es-ES') : '' },
    ],
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'TECHNICIAN') return null

  return (
    <ModuleLayout
      title='Mis Tickets Asignados'
      subtitle='Gestiona los tickets que tienes asignados'
      loading={loading && allTickets.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <div className="flex gap-2">
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={filteredTickets.length === 0}
          />
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
        </div>
      }
    >
      <div className="space-y-6">
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard
            title="Abiertos"
            value={stats.open}
            icon={AlertCircle}
            color="orange"
            badge={stats.total > 0 ? { text: `${Math.round((stats.open / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
            status={stats.open > 5 ? 'warning' : 'normal'}
          />
          <SymmetricStatsCard
            title="En Progreso"
            value={stats.inProgress}
            icon={Clock}
            color="blue"
            badge={stats.total > 0 ? { text: `${Math.round((stats.inProgress / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
          />
          <SymmetricStatsCard
            title="Resueltos Hoy"
            value={stats.resolvedToday}
            icon={CheckCircle}
            color="green"
            status="success"
            trend={stats.resolvedToday > 0 ? { value: stats.resolvedToday, label: 'completados', isPositive: true } : undefined}
          />
          <SymmetricStatsCard title="Tiempo Promedio" value={stats.avgResolutionTime} icon={Target} color="purple" />
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
          variant="technician"
          loading={loading}
          showDateFilter={true}
          showAssigneeFilter={false}
          searchPlaceholder="Buscar por título, descripción o cliente..."
        />

        <DataTable
          title="Mis Tickets Asignados"
          description={`Tickets que tienes asignados para resolver (${filteredTickets.length} tickets)`}
          data={pagination.currentItems}
          columns={createTechnicianTicketColumns({ onView: handleViewTicket })}
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
              <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
            ) : undefined,
          }}
        />
      </div>
    </ModuleLayout>
  )
}
