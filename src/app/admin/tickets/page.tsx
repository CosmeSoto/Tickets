'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Ticket, AlertCircle, Clock, UserX, Send, CheckCircle } from 'lucide-react'
import Link from 'next/link'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { TicketFilters } from '@/components/tickets/ticket-filters'
import { Button } from '@/components/ui/button'
import { ExportButton } from '@/components/common/export-button'
import { createAdminTicketColumns } from '@/components/tickets/admin/ticket-columns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'

import { useModuleData } from '@/hooks/common/use-module-data'
import { useTicketFilters } from '@/hooks/common/use-ticket-filters'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { filterTicketsAdmin, filterTicketsCreatedBy } from '@/lib/utils/ticket-filters'
import { ADMIN_TICKET_EXPORT_COLUMNS } from '@/lib/utils/ticket-utils'
import { useFamilies } from '@/contexts/families-context'

export default function AdminTicketsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | 'created'>('all')

  const { families } = useFamilies()

  // Todos los tickets del sistema
  const {
    data: allTickets,
    loading: loadingAll,
    error: errorAll,
    reload: reloadAll,
  } = useModuleData<TicketType>({
    endpoint: '/api/tickets',
    initialLoad: true,
  })

  // Tickets creados por el admin como solicitante
  const {
    data: createdTicketsRaw,
    loading: loadingCreated,
    error: errorCreated,
    reload: reloadCreated,
  } = useModuleData<TicketType>({
    endpoint: '/api/tickets?viewMode=created',
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

  const filteredAll = useMemo(
    () => filterTicketsAdmin(allTickets, debouncedFilters),
    [allTickets, debouncedFilters]
  )

  const filteredCreated = useMemo(() => {
    if (!session?.user?.id) return []
    return filterTicketsCreatedBy(createdTicketsRaw, debouncedFilters, session.user.id)
  }, [createdTicketsRaw, debouncedFilters, session?.user?.id])

  const activeTickets = activeTab === 'all' ? filteredAll : filteredCreated
  const loading = activeTab === 'all' ? loadingAll : loadingCreated
  const error = activeTab === 'all' ? errorAll : errorCreated
  const reload = activeTab === 'all' ? reloadAll : reloadCreated

  // Categorías derivadas de los tickets del tab activo
  const categories = useMemo(() => {
    const source = activeTab === 'all' ? allTickets : createdTicketsRaw
    const seen = new Map<string, { id: string; name: string }>()
    source
      .filter(t => debouncedFilters.family === 'all' || t.family?.id === debouncedFilters.family)
      .forEach(t => {
        if (t.category && !seen.has(t.category.id)) {
          seen.set(t.category.id, { id: t.category.id, name: t.category.name })
        }
      })
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allTickets, createdTicketsRaw, activeTab, debouncedFilters.family])

  const pagination = usePagination(activeTickets, { pageSize: 20 })

  // Stats "Todos los Tickets" — sobre datos filtrados (el admin ve todo, los filtros son su herramienta)
  const allStats = useMemo(
    () => ({
      total: filteredAll.length,
      open: filteredAll.filter(t => t.status === 'OPEN').length,
      inProgress: filteredAll.filter(t => t.status === 'IN_PROGRESS').length,
      unassigned: filteredAll.filter(t => !t.assignee).length,
    }),
    [filteredAll]
  )

  // Stats "Mis Solicitudes" — sobre datos crudos para que los badges sean precisos
  const createdStats = useMemo(() => {
    if (!session?.user?.id) return { total: 0, open: 0, inProgress: 0, resolved: 0 }
    const myCreated = createdTicketsRaw.filter(t => t.client?.id === session.user.id)
    return {
      total: myCreated.length,
      open: myCreated.filter(t => t.status === 'OPEN').length,
      inProgress: myCreated.filter(t => t.status === 'IN_PROGRESS').length,
      resolved: myCreated.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    }
  }, [createdTicketsRaw, session?.user?.id])

  const handleViewTicket = (ticket: TicketType) => router.push(`/admin/tickets/${ticket.id}`)

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: activeTab === 'all' ? 'tickets-admin' : 'mis-solicitudes-admin',
    title: activeTab === 'all' ? 'Gestión de Tickets' : 'Mis Solicitudes',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-ES')} • ${activeTickets.length} tickets`,
    getData: () => activeTickets,
    columns: ADMIN_TICKET_EXPORT_COLUMNS,
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: activeTickets.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  if (!session || session.user.role !== 'ADMIN') return null

  return (
    <ModuleLayout
      title='Tickets'
      subtitle='Gestiona todos los tickets del sistema y tus propias solicitudes'
      loading={loadingAll && allTickets.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <div className='flex gap-2'>
          <Button size='sm' asChild>
            <Link href='/admin/tickets/create'>
              <Plus className='h-4 w-4 mr-2' />
              Nuevo Ticket
            </Link>
          </Button>
        </div>
      }
    >
      <Tabs
        value={activeTab}
        onValueChange={v => {
          setActiveTab(v as 'all' | 'created')
          clearFilters()
        }}
      >
        <TabsList className='mb-6'>
          <TabsTrigger value='all' className='gap-2'>
            <Ticket className='h-4 w-4' />
            Todos los Tickets
            {allStats.unassigned > 0 && (
              <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-xs'>
                {allStats.unassigned} sin asignar
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value='created' className='gap-2'>
            <Send className='h-4 w-4' />
            Mis Solicitudes
            {createdStats.open + createdStats.inProgress > 0 && (
              <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-xs'>
                {createdStats.open + createdStats.inProgress}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Todos los Tickets ── */}
        <TabsContent value='all' className='space-y-6 mt-0'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <SymmetricStatsCard
              title='Total Tickets'
              value={allStats.total}
              icon={Ticket}
              color='purple'
            />
            <SymmetricStatsCard
              title='Abiertos'
              value={allStats.open}
              icon={AlertCircle}
              color='blue'
              badge={
                allStats.total > 0
                  ? {
                      text: `${Math.round((allStats.open / allStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
              status={allStats.open > 10 ? 'warning' : 'normal'}
            />
            <SymmetricStatsCard
              title='En Progreso'
              value={allStats.inProgress}
              icon={Clock}
              color='orange'
              badge={
                allStats.total > 0
                  ? {
                      text: `${Math.round((allStats.inProgress / allStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
            <SymmetricStatsCard
              title='Sin Asignar'
              value={allStats.unassigned}
              icon={UserX}
              color='red'
              status={allStats.unassigned > 5 ? 'error' : 'normal'}
              badge={
                allStats.total > 0
                  ? {
                      text: `${Math.round((allStats.unassigned / allStats.total) * 100)}%`,
                      variant: 'secondary',
                    }
                  : undefined
              }
            />
          </div>

          <TicketFilters
            searchTerm={filters.search}
            statusFilter={filters.status}
            priorityFilter={filters.priority}
            categoryFilter={filters.category}
            assigneeFilter={filters.assignee}
            familyFilter={filters.family}
            setSearchTerm={term => setFilter('search', term)}
            onStatusChange={status => setFilter('status', status)}
            onPriorityChange={priority => setFilter('priority', priority)}
            onCategoryChange={category => setFilter('category', category)}
            onAssigneeChange={assignee => setFilter('assignee', assignee)}
            onFamilyChange={family => setFilter('family', family)}
            onRefresh={reloadAll}
            onClearFilters={clearFilters}
            categories={categories}
            families={families}
            variant='admin'
            loading={loadingAll}
            showAssigneeFilter={true}
            searchPlaceholder='Buscar por título, descripción, cliente o técnico...'
          />

          <DataTable
            title='Tickets'
            description={`Gestión de tickets del sistema (${filteredAll.length} tickets)`}
            data={pagination.currentItems}
            columns={createAdminTicketColumns({ onView: handleViewTicket })}
            loading={loadingAll}
            pagination={paginationConfig}
            onRefresh={reloadAll}
            externalSearch={true}
            hideInternalFilters={true}
            onRowClick={handleViewTicket}
            actions={
              <ExportButton
                onExportCSV={exportCSV}
                onExportExcel={exportExcel}
                onExportPDF={exportPDF}
                loading={exporting}
                disabled={filteredAll.length === 0}
              />
            }
            emptyState={{
              icon: <Ticket className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
              title: hasActiveFilters ? 'No se encontraron tickets' : 'No hay tickets',
              description: hasActiveFilters
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'No se encontraron tickets en el sistema',
              action: hasActiveFilters ? (
                <Button variant='outline' onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : (
                <Button asChild>
                  <Link href='/admin/tickets/create'>
                    <Plus className='h-4 w-4 mr-2' />
                    Crear primer ticket
                  </Link>
                </Button>
              ),
            }}
          />
        </TabsContent>

        {/* ── Tab: Mis Solicitudes ── */}
        <TabsContent value='created' className='space-y-6 mt-0'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
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
          </div>

          <TicketFilters
            searchTerm={filters.search}
            statusFilter={filters.status}
            priorityFilter={filters.priority}
            categoryFilter={filters.category}
            familyFilter={filters.family}
            setSearchTerm={term => setFilter('search', term)}
            onStatusChange={status => setFilter('status', status)}
            onPriorityChange={priority => setFilter('priority', priority)}
            onCategoryChange={category => setFilter('category', category)}
            onFamilyChange={family => setFilter('family', family)}
            onRefresh={reloadCreated}
            onClearFilters={clearFilters}
            categories={categories}
            families={families}
            variant='admin'
            loading={loadingCreated}
            showAssigneeFilter={false}
            searchPlaceholder='Buscar por título o descripción...'
          />

          <DataTable
            title='Mis Solicitudes'
            description={`Tickets que creaste como solicitante (${filteredCreated.length} tickets)`}
            data={pagination.currentItems}
            columns={createAdminTicketColumns({ onView: handleViewTicket })}
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
                : 'Aún no has creado ninguna solicitud de soporte',
              action: hasActiveFilters ? (
                <Button variant='outline' onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              ) : (
                <Button asChild>
                  <Link href='/admin/tickets/create'>
                    <Plus className='h-4 w-4 mr-2' />
                    Nueva Solicitud
                  </Link>
                </Button>
              ),
            }}
          />
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  )
}
