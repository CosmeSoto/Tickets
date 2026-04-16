'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Plus, 
  Ticket,
  AlertCircle,
  Clock,
  UserX,
} from 'lucide-react'
import Link from 'next/link'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'
import { createAdminTicketColumns } from '@/components/tickets/admin/ticket-columns'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { filterTicketsAdmin } from '@/lib/utils/ticket-filters'

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
}

export default function AdminTicketsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [families, setFamilies] = useState<FamilyOption[]>([])

  const { data: allTickets, loading, error, reload } = useModuleData<TicketType>({
    endpoint: '/api/tickets',
    initialLoad: true,
  })

  // Cargar familias según rol: superadmin ve todas, admin normal ve las suyas
  useEffect(() => {
    fetch('/api/families?includeInactive=false')
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

  // Filtrar en memoria
  const filteredTickets = useMemo(() => {
    return filterTicketsAdmin(allTickets, debouncedFilters)
  }, [allTickets, debouncedFilters])

  // Categorías derivadas de los tickets de la familia seleccionada
  const categories = useMemo(() => {
    const seen = new Map<string, { id: string; name: string }>()
    allTickets
      .filter(t => debouncedFilters.family === 'all' || t.family?.id === debouncedFilters.family)
      .forEach(t => {
        if (t.category && !seen.has(t.category.id)) {
          seen.set(t.category.id, { id: t.category.id, name: t.category.name })
        }
      })
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allTickets, debouncedFilters.family])

  const pagination = usePagination(filteredTickets, { pageSize: 20 })

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return {
      total: filteredTickets.length,
      open: filteredTickets.filter(t => t.status === 'OPEN').length,
      inProgress: filteredTickets.filter(t => t.status === 'IN_PROGRESS').length,
      unassigned: filteredTickets.filter(t => !t.assignee).length,
    }
  }, [filteredTickets])

  const handleViewTicket = (ticket: TicketType) => router.push(`/admin/tickets/${ticket.id}`)

  // Exportación — usa los tickets filtrados actuales (lo que el admin ve en pantalla)
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'tickets-admin',
    title: 'Gestión de Tickets',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-ES')} • ${filteredTickets.length} tickets`,
    getData: () => filteredTickets,
    columns: [
      { key: 'ticketCode', label: 'Código', format: (v, r) => v ?? r.id.slice(-8).toUpperCase() },
      { key: 'title', label: 'Título' },
      { key: 'status', label: 'Estado', format: v => ({ OPEN: 'Abierto', IN_PROGRESS: 'En Progreso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado', ON_HOLD: 'En Espera' }[v] ?? v) },
      { key: 'priority', label: 'Prioridad', format: v => ({ LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' }[v] ?? v) },
      { key: 'client', label: 'Cliente', format: v => v?.name ?? '' },
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

  if (!session || session.user.role !== 'ADMIN') return null

  return (
    <ModuleLayout
      title='Gestión de Tickets'
      subtitle='Administrar todos los tickets del sistema'
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
          <Button size="sm" asChild>
            <Link href="/admin/tickets/create">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Ticket
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          <SymmetricStatsCard title="Total Tickets" value={stats.total} icon={Ticket} color="purple" />
          <SymmetricStatsCard
            title="Abiertos"
            value={stats.open}
            icon={AlertCircle}
            color="blue"
            badge={stats.total > 0 ? { text: `${Math.round((stats.open / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
            status={stats.open > 10 ? 'warning' : 'normal'}
          />
          <SymmetricStatsCard
            title="En Progreso"
            value={stats.inProgress}
            icon={Clock}
            color="orange"
            badge={stats.total > 0 ? { text: `${Math.round((stats.inProgress / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
          />
          <SymmetricStatsCard
            title="Sin Asignar"
            value={stats.unassigned}
            icon={UserX}
            color="red"
            status={stats.unassigned > 5 ? 'error' : 'normal'}
            badge={stats.total > 0 ? { text: `${Math.round((stats.unassigned / stats.total) * 100)}%`, variant: 'secondary' } : undefined}
          />
        </div>

        <TicketFilters
          searchTerm={filters.search}
          statusFilter={filters.status}
          priorityFilter={filters.priority}
          categoryFilter={filters.category}
          assigneeFilter={filters.assignee}
          familyFilter={filters.family}
          setSearchTerm={(term) => setFilter('search', term)}
          onStatusChange={(status) => setFilter('status', status)}
          onPriorityChange={(priority) => setFilter('priority', priority)}
          onCategoryChange={(category) => setFilter('category', category)}
          onAssigneeChange={(assignee) => setFilter('assignee', assignee)}
          onFamilyChange={(family) => setFilter('family', family)}
          onRefresh={reload}
          onClearFilters={clearFilters}
          categories={categories}
          families={families}
          variant="admin"
          loading={loading}
          showAssigneeFilter={true}
          searchPlaceholder="Buscar por título, descripción, cliente o técnico..."
        />

        <DataTable
          title="Tickets"
          description={`Gestión de tickets del sistema (${filteredTickets.length} tickets)`}
          data={pagination.currentItems}
          columns={createAdminTicketColumns({ onView: handleViewTicket })}
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
              <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>
            ) : (
              <Button asChild>
                <Link href="/admin/tickets/create">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer ticket
                </Link>
              </Button>
            ),
          }}
        />
      </div>
    </ModuleLayout>
  )
}
