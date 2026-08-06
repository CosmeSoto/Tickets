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
  Plus,
  Send,
} from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import Link from 'next/link'

import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { StaggerGrid } from '@/components/shared/stagger-grid'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { createTechnicianTicketColumns } from '@/components/tickets/technician/ticket-columns'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { filterTicketsTechnician, filterTicketsCreatedBy } from '@/lib/utils/ticket-filters'
import { TECHNICIAN_TICKET_EXPORT_COLUMNS } from '@/lib/utils/ticket-utils'
import { useFamilies } from '@/contexts/families-context'

export default function TechnicianTicketsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'assigned' | 'created'>('assigned')

  const { families } = useFamilies()

  // Carga de tickets asignados (modo por defecto)
  const {
    data: assignedTickets,
    loading: loadingAssigned,
    error: errorAssigned,
    reload: reloadAssigned,
  } = useModuleData<TicketType>({
    endpoint: '/api/tickets?limit=500',
    initialLoad: true,
  })

  // Carga de tickets creados por el técnico (como solicitante)
  const {
    data: createdTickets,
    loading: loadingCreated,
    error: errorCreated,
    reload: reloadCreated,
  } = useModuleData<TicketType>({
    endpoint: '/api/tickets?viewMode=created&limit=500',
    initialLoad: true,
  })

  const { filters, debouncedFilters, setFilter, clearFilters, hasActiveFilters } =
    useTicketFilters()

  // Resetear categoría cuando cambia la familia
  const prevFamilyRef = useRef(filters.family)
  useEffect(() => {
    if (prevFamilyRef.current !== filters.family) {
      prevFamilyRef.current = filters.family
      if (filters.category !== 'all') setFilter('category', 'all')
    }
  }, [filters.family]) // eslint-disable-line react-hooks/exhaustive-deps

  // Tickets filtrados según tab activo (para la tabla — incluye filtros de búsqueda/estado/etc.)
  const filteredAssigned = useMemo(() => {
    if (!session?.user?.id) return []
    return filterTicketsTechnician(assignedTickets, debouncedFilters, session.user.id)
  }, [assignedTickets, debouncedFilters, session?.user?.id])

  const filteredCreated = useMemo(() => {
    if (!session?.user?.id) return []
    return filterTicketsCreatedBy(createdTickets, debouncedFilters, session.user.id)
  }, [createdTickets, debouncedFilters, session?.user?.id])

  const activeTickets = activeTab === 'assigned' ? filteredAssigned : filteredCreated
  const loading = activeTab === 'assigned' ? loadingAssigned : loadingCreated
  const error = activeTab === 'assigned' ? errorAssigned : errorCreated
  const reload = activeTab === 'assigned' ? reloadAssigned : reloadCreated

  // Categorías derivadas de los tickets del tab activo
  const categories = useMemo(() => {
    if (!session?.user?.id) return []
    const source = activeTab === 'assigned' ? assignedTickets : createdTickets
    const seen = new Map<string, { id: string; name: string }>()
    source
      .filter(t => debouncedFilters.family === 'all' || t.family?.id === debouncedFilters.family)
      .forEach(t => {
        if (t.category && !seen.has(t.category.id)) {
          seen.set(t.category.id, { id: t.category.id, name: t.category.name })
        }
      })
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [assignedTickets, createdTickets, activeTab, debouncedFilters.family, session?.user?.id])

  const pagination = usePagination(activeTickets, { pageSize: 20 })

  // Stats del tab "Asignados" — calculadas sobre datos crudos (sin filtros de búsqueda/estado)
  // para que reflejen la realidad independientemente de los filtros activos en la tabla
  const assignedStats = useMemo(() => {
    if (!session?.user?.id)
      return { total: 0, open: 0, inProgress: 0, resolvedToday: 0, avgResolutionTime: 'N/A' }
    // Solo tickets realmente asignados al técnico (no los sin asignar de su familia)
    const myTickets = assignedTickets.filter(t => t.assignee?.id === session.user.id)
    const resolvedTickets = myTickets.filter(t => t.status === 'RESOLVED' && t.resolvedAt)
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
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return {
      total: myTickets.length,
      open: myTickets.filter(t => t.status === 'OPEN').length,
      inProgress: myTickets.filter(t => t.status === 'IN_PROGRESS').length,
      resolvedToday: myTickets.filter(t => {
        if (t.status !== 'RESOLVED' || !t.resolvedAt) return false
        const d = new Date(t.resolvedAt)
        d.setHours(0, 0, 0, 0)
        return d.getTime() === today.getTime()
      }).length,
      avgResolutionTime,
    }
  }, [assignedTickets, session?.user?.id])

  // Stats del tab "Mis Solicitudes" — calculadas sobre datos crudos
  const createdStats = useMemo(() => {
    if (!session?.user?.id) return { total: 0, open: 0, inProgress: 0, resolved: 0 }
    const myCreated = createdTickets.filter(t => t.client?.id === session.user.id)
    return {
      total: myCreated.length,
      open: myCreated.filter(t => t.status === 'OPEN').length,
      inProgress: myCreated.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: myCreated.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    }
  }, [createdTickets, session?.user?.id])

  const handleViewTicket = (ticket: TicketType) => router.push(`/technician/tickets/${ticket.id}`)

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: activeTab === 'assigned' ? 'tickets-asignados' : 'mis-solicitudes',
    title: activeTab === 'assigned' ? 'Tickets Asignados' : 'Mis Solicitudes',
    subtitle: `${session?.user?.name ?? ''} • ${activeTickets.length} tickets`,
    getData: () => activeTickets,
    columns: TECHNICIAN_TICKET_EXPORT_COLUMNS,
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: activeTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'TECHNICIAN') return null

  return (
    <ModuleLayout
      title='Tickets'
      subtitle='Gestiona tus tickets asignados y tus solicitudes de soporte'
      loading={
        loadingAssigned &&
        assignedTickets.length === 0 &&
        loadingCreated &&
        createdTickets.length === 0
      }
      error={error}
      onRetry={reload}
      headerActions={
        <div className='flex gap-2 flex-wrap'>
          <Link href='/technician/tickets/create'>
            <Button size='sm'>
              <Plus className='h-4 w-4 sm:mr-2' />
              <span className='hidden sm:inline'>Crear Ticket</span>
            </Button>
          </Link>
        </div>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={v => {
          setActiveTab(v as 'assigned' | 'created')
          clearFilters()
        }}
      >
        <TabsList className='mb-6'>
          <TabsTrigger value='assigned' className='gap-2'>
            <TicketIcon className='h-4 w-4' />
            Asignados a mí
            <Badge
              variant={assignedStats.open + assignedStats.inProgress > 0 ? 'default' : 'secondary'}
              className='ml-1 h-5 px-1.5 text-xs'
            >
              {assignedStats.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='created' className='gap-2'>
            <Send className='h-4 w-4' />
            Mis Solicitudes
            <Badge
              variant={createdStats.open + createdStats.inProgress > 0 ? 'default' : 'secondary'}
              className='ml-1 h-5 px-1.5 text-xs'
            >
              {createdStats.total}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Asignados ── */}
        <TabsContent value='assigned' className='space-y-6 mt-0'>
          <StaggerGrid className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <SymmetricStatsCard
              title='Total Asignados'
              value={assignedStats.total}
              icon={TicketIcon}
              color='purple'
            />
            <SymmetricStatsCard
              title='Abiertos'
              value={assignedStats.open}
              icon={AlertCircle}
              color='orange'
              badge={
                assignedStats.total > 0
                  ? {
                      text: `${Math.round((assignedStats.open / assignedStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
              status={assignedStats.open > 5 ? 'warning' : 'normal'}
            />
            <SymmetricStatsCard
              title='En Progreso'
              value={assignedStats.inProgress}
              icon={Clock}
              color='blue'
              badge={
                assignedStats.total > 0
                  ? {
                      text: `${Math.round((assignedStats.inProgress / assignedStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
            <SymmetricStatsCard
              title='Tiempo Promedio'
              value={assignedStats.avgResolutionTime}
              icon={Target}
              color='purple'
            />
          </StaggerGrid>

          <TicketFilters
            searchTerm={filters.search}
            statusFilter={filters.status}
            priorityFilter={filters.priority}
            categoryFilter={filters.category}
            dateFilter={filters.dateRange}
            familyFilter={filters.family}
            setSearchTerm={term => setFilter('search', term)}
            onStatusChange={status => setFilter('status', status)}
            onPriorityChange={priority => setFilter('priority', priority)}
            onCategoryChange={category => setFilter('category', category)}
            onDateChange={date => setFilter('dateRange', date)}
            onFamilyChange={family => setFilter('family', family)}
            onRefresh={reloadAssigned}
            onClearFilters={clearFilters}
            categories={categories}
            families={families}
            variant='technician'
            loading={loadingAssigned}
            showDateFilter={true}
            showAssigneeFilter={false}
            searchPlaceholder='Buscar por título, descripción o cliente...'
          />

          <DataTable
            title='Tickets Asignados'
            description={`Tickets que tienes asignados para resolver (${filteredAssigned.length} tickets)`}
            data={pagination.currentItems}
            columns={createTechnicianTicketColumns({ onView: handleViewTicket })}
            loading={loadingAssigned}
            pagination={paginationConfig}
            onRefresh={reloadAssigned}
            externalSearch={true}
            hideInternalFilters={true}
            onRowClick={handleViewTicket}
            actions={
              <ExportButton
                onExportCSV={exportCSV}
                onExportExcel={exportExcel}
                onExportPDF={exportPDF}
                loading={exporting}
                disabled={filteredAssigned.length === 0}
              />
            }
            emptyState={{
              icon: <TicketIcon className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
              title: hasActiveFilters ? 'No se encontraron tickets' : 'No hay tickets asignados',
              description: hasActiveFilters
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No tienes tickets asignados en este momento',
              action: hasActiveFilters ? (
                <Button variant='outline' onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined,
            }}
          />
        </TabsContent>

        {/* ── Tab: Mis Solicitudes ── */}
        <TabsContent value='created' className='space-y-6 mt-0'>
          <StaggerGrid className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <SymmetricStatsCard
              title='Total Solicitudes'
              value={createdStats.total}
              icon={Send}
              color='purple'
            />
            <SymmetricStatsCard
              title='Abiertas'
              value={createdStats.open}
              icon={AlertCircle}
              color='orange'
              status={createdStats.open > 3 ? 'warning' : 'normal'}
              badge={
                createdStats.total > 0
                  ? {
                      text: `${Math.round((createdStats.open / createdStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
            <SymmetricStatsCard
              title='En Progreso'
              value={createdStats.inProgress}
              icon={Clock}
              color='blue'
              badge={
                createdStats.total > 0
                  ? {
                      text: `${Math.round((createdStats.inProgress / createdStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
            <SymmetricStatsCard
              title='Resueltas / Cerradas'
              value={createdStats.resolved}
              icon={CheckCircle}
              color='green'
              status='success'
              badge={
                createdStats.total > 0
                  ? {
                      text: `${Math.round((createdStats.resolved / createdStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
          </StaggerGrid>

          <TicketFilters
            searchTerm={filters.search}
            statusFilter={filters.status}
            priorityFilter={filters.priority}
            categoryFilter={filters.category}
            dateFilter={filters.dateRange}
            familyFilter={filters.family}
            setSearchTerm={term => setFilter('search', term)}
            onStatusChange={status => setFilter('status', status)}
            onPriorityChange={priority => setFilter('priority', priority)}
            onCategoryChange={category => setFilter('category', category)}
            onDateChange={date => setFilter('dateRange', date)}
            onFamilyChange={family => setFilter('family', family)}
            onRefresh={reloadCreated}
            onClearFilters={clearFilters}
            categories={categories}
            families={families}
            variant='technician'
            loading={loadingCreated}
            showDateFilter={true}
            showAssigneeFilter={false}
            searchPlaceholder='Buscar por título o descripción...'
          />

          <DataTable
            title='Mis Solicitudes'
            description={`Tickets que creaste como solicitante (${filteredCreated.length} tickets)`}
            data={pagination.currentItems}
            columns={createTechnicianTicketColumns({ onView: handleViewTicket })}
            loading={loadingCreated}
            pagination={paginationConfig}
            onRefresh={reloadCreated}
            externalSearch={true}
            hideInternalFilters={true}
            onRowClick={handleViewTicket}
            actions={
              <ExportButton
                onExportCSV={exportCSV}
                onExportExcel={exportExcel}
                onExportPDF={exportPDF}
                loading={exporting}
                disabled={filteredCreated.length === 0}
              />
            }
            emptyState={{
              icon: <Send className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
              title: hasActiveFilters ? 'No se encontraron solicitudes' : 'No tienes solicitudes',
              description: hasActiveFilters
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Aún no has creado ninguna solicitud. Usa «Nuevo Ticket» en la barra superior.',
              action: hasActiveFilters ? (
                <Button variant='outline' onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : undefined,
            }}
          />
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}
