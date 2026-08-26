'use client'

/**
 * Pestaña "Detalle de Tickets" — filas individuales (no agregadas), con
 * filtros ricos y columnas seleccionables. Reutiliza el endpoint existente
 * `GET /api/reports?type=tickets` (antes sin ninguna pantalla que lo usara),
 * que ya trae scoping por rol/familia, rate limit y los datos por ticket
 * (cliente, técnico, categoría/departamento, SLA, calificación).
 *
 * Fetch propio (no `useModuleData`): la respuesta de `/api/reports` tiene la
 * forma `{ data, warnings, metadata }`, distinta al `{ success, data }` que
 * espera ese hook.
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ListFilter, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { UserCombobox } from '@/components/ui/user-combobox'
import { DataTable, type Column } from '@/components/ui/data-table'
import { TableColumnsMenu } from '@/components/common/table-columns-menu'
import { ExportButton } from '@/components/common/export-button'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'
import { Badge } from '@/components/ui/badge'
import { useExport } from '@/hooks/common/use-export'
import { usePagination } from '@/hooks/common/use-pagination'
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/constants/filter-options'
import {
  DETAIL_COLUMN_DEFS,
  DETAIL_DEFAULT_VISIBLE,
  DETAIL_EXPORT_COLUMN_MAP,
  SLA_STATUS_LABELS,
  type DetailedTicketRow,
} from '../utils/detail-columns'

interface DraftFilters {
  status: string
  priority: string
  categoryId: string
  assigneeId: string
  clientId: string
  startDate: string
  endDate: string
}

const EMPTY_FILTERS: DraftFilters = {
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  assigneeId: 'all',
  clientId: 'all',
  startDate: '',
  endDate: '',
}

function slaVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'BREACHED') return 'destructive'
  if (status === 'AT_RISK') return 'secondary'
  if (status === 'COMPLIANT') return 'outline'
  return 'outline'
}

export function DetailTab() {
  const router = useRouter()

  const [filters, setFilters] = useState<DraftFilters>(EMPTY_FILTERS)
  const [rows, setRows] = useState<DetailedTicketRow[]>([])
  const [categories, setCategories] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const [columnOrder, setColumnOrder] = useState<string[]>(DETAIL_COLUMN_DEFS.map(c => c.key))
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DETAIL_DEFAULT_VISIBLE)

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories/simple?isActive=true')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setCategories(json.data.map((c: any) => ({ value: c.id, label: c.name })))
      }
    } catch {
      /* silencioso — el filtro de categoría queda vacío */
    }
  }, [])

  const fetchRows = useCallback(async (f: DraftFilters) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ type: 'tickets', format: 'json', limit: '1000' })
      if (f.status !== 'all') params.set('status', f.status)
      if (f.priority !== 'all') params.set('priority', f.priority)
      if (f.categoryId !== 'all') params.set('categoryId', f.categoryId)
      if (f.assigneeId !== 'all') params.set('assigneeId', f.assigneeId)
      if (f.clientId !== 'all') params.set('clientId', f.clientId)
      if (f.startDate) params.set('startDate', f.startDate)
      if (f.endDate) params.set('endDate', f.endDate)

      const res = await fetch(`/api/reports?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || json.message || 'No se pudo cargar el detalle de tickets.')
        setRows([])
        return
      }
      setRows(Array.isArray(json.data?.detailedTickets) ? json.data.detailedTickets : [])
      setWarnings(Array.isArray(json.warnings) ? json.warnings : [])
    } catch {
      setError('Error de conexión al cargar el detalle de tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Primera carga (sin filtros) al entrar a la pestaña
  useEffect(() => {
    void loadCategories()
    void fetchRows(EMPTY_FILTERS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pagination = usePagination(rows, { pageSize: 20 })

  const allColumns: Column<DetailedTicketRow>[] = [
    {
      key: 'title',
      label: 'Ticket',
      sortable: true,
      render: r => <span className='font-medium truncate max-w-[220px] block'>{r.title}</span>,
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: r => <StatusBadge status={r.status as any} size='sm' />,
    },
    {
      key: 'priority',
      label: 'Prioridad',
      sortable: true,
      render: r => <PriorityBadge priority={r.priority as any} size='sm' />,
    },
    {
      key: 'category',
      label: 'Categoría',
      sortable: true,
      render: r => (
        <div className='flex items-center gap-1.5'>
          <span
            className='w-2.5 h-2.5 rounded-full shrink-0'
            style={{ backgroundColor: r.category?.color || '#6B7280' }}
          />
          <span className='text-sm truncate max-w-[140px]'>{r.category?.name ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Departamento',
      sortable: true,
      render: r => (
        <span className='text-sm text-muted-foreground'>{r.department?.name ?? '—'}</span>
      ),
    },
    {
      key: 'client',
      label: 'Cliente',
      sortable: true,
      render: r => (
        <div className='min-w-0'>
          <p className='text-sm font-medium truncate'>{r.client?.name ?? '—'}</p>
          <p className='text-xs text-muted-foreground truncate'>{r.client?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'assignee',
      label: 'Técnico',
      sortable: true,
      render: r =>
        r.assignee ? (
          <span className='text-sm'>{r.assignee.name}</span>
        ) : (
          <span className='text-sm text-muted-foreground'>Sin asignar</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Creado',
      sortable: true,
      render: r => (
        <span className='text-sm text-muted-foreground'>
          {new Date(r.createdAt).toLocaleDateString('es-ES')}
        </span>
      ),
    },
    {
      key: 'resolvedAt',
      label: 'Resuelto',
      sortable: true,
      render: r => (
        <span className='text-sm text-muted-foreground'>
          {r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString('es-ES') : '—'}
        </span>
      ),
    },
    {
      key: 'resolutionTime',
      label: 'Tiempo de resolución',
      render: r => <span className='text-sm text-muted-foreground'>{r.resolutionTime ?? '—'}</span>,
    },
    {
      key: 'slaStatus',
      label: 'SLA',
      sortable: true,
      render: r => (
        <Badge variant={slaVariant(r.slaStatus)} className='text-xs'>
          {SLA_STATUS_LABELS[r.slaStatus] ?? r.slaStatus}
        </Badge>
      ),
    },
    {
      key: 'slaViolations',
      label: 'Violaciones SLA abiertas',
      render: r => {
        const n = r.slaMetrics?.violationsCount ?? 0
        return n > 0 ? (
          <span className='text-sm font-medium text-destructive'>{n}</span>
        ) : (
          <span className='text-sm text-muted-foreground'>0</span>
        )
      },
    },
    {
      key: 'rating',
      label: 'Calificación',
      render: r =>
        r.rating?.score != null ? (
          <span className='text-sm text-amber-500 dark:text-amber-400 font-medium'>
            ★ {r.rating.score}
          </span>
        ) : (
          <span className='text-sm text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'createdBy',
      label: 'Creado por',
      render: r => (
        <span className='text-sm text-muted-foreground'>{r.createdBy?.name ?? '—'}</span>
      ),
    },
  ]

  const visibleTableColumns = columnOrder
    .filter(k => visibleColumns.includes(k))
    .map(k => allColumns.find(c => String(c.key) === k))
    .filter((c): c is Column<DetailedTicketRow> => Boolean(c))

  const exportColumns = columnOrder
    .filter(k => visibleColumns.includes(k) && DETAIL_EXPORT_COLUMN_MAP[k])
    .map(k => DETAIL_EXPORT_COLUMN_MAP[k])

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'detalle-tickets',
    title: 'Detalle de Tickets',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-ES')} • ${rows.length} tickets`,
    getData: () => rows,
    columns: exportColumns,
  })

  const applyFilters = () => fetchRows(filters)
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    void fetchRows(EMPTY_FILTERS)
  }

  return (
    <div className='space-y-4'>
      <Card>
        <CardContent className='pt-4 pb-4 space-y-3'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Estado</label>
              <Select
                value={filters.status}
                onValueChange={v => setFilters(f => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Prioridad</label>
              <Select
                value={filters.priority}
                onValueChange={v => setFilters(f => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Categoría</label>
              <Combobox
                options={[{ value: 'all', label: 'Todas las categorías' }, ...categories]}
                value={filters.categoryId}
                onValueChange={v => setFilters(f => ({ ...f, categoryId: v }))}
                placeholder='Todas las categorías'
                searchPlaceholder='Buscar categoría...'
              />
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Técnico</label>
              <UserCombobox
                value={filters.assigneeId === 'all' ? '' : filters.assigneeId}
                onValueChange={v => setFilters(f => ({ ...f, assigneeId: v || 'all' }))}
                role='TECHNICIAN'
                placeholder='Todos'
                allowClear
              />
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Cliente</label>
              <UserCombobox
                value={filters.clientId === 'all' ? '' : filters.clientId}
                onValueChange={v => setFilters(f => ({ ...f, clientId: v || 'all' }))}
                role='CLIENT'
                placeholder='Todos'
                allowClear
              />
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Desde</label>
              <Input
                type='date'
                value={filters.startDate}
                onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div className='space-y-1'>
              <label className='text-sm font-medium text-muted-foreground'>Hasta</label>
              <Input
                type='date'
                value={filters.endDate}
                onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          <div className='flex items-center justify-end gap-2 pt-1'>
            <Button variant='outline' size='sm' onClick={clearFilters} disabled={loading}>
              <RotateCcw className='h-4 w-4 mr-1.5' />
              Limpiar
            </Button>
            <Button size='sm' onClick={applyFilters} disabled={loading}>
              <ListFilter className='h-4 w-4 mr-1.5' />
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <Card className='border-amber-300/50 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30'>
          <CardContent className='py-3 flex items-start gap-2'>
            <AlertTriangle className='h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
            <div className='text-sm text-amber-800 dark:text-amber-300'>
              {warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        title='Detalle de Tickets'
        description={`${rows.length} ticket${rows.length !== 1 ? 's' : ''} con los filtros actuales`}
        data={pagination.currentItems}
        columns={visibleTableColumns}
        loading={loading}
        error={error}
        onRowClick={r => router.push(`/admin/tickets/${r.id}`)}
        pagination={{
          page: pagination.currentPage,
          limit: pagination.pageSize,
          total: rows.length,
          onPageChange: pagination.goToPage,
          onLimitChange: pagination.setPageSize,
        }}
        externalSearch
        hideInternalFilters
        actions={
          <>
            <TableColumnsMenu
              columns={DETAIL_COLUMN_DEFS}
              order={columnOrder}
              visible={visibleColumns}
              onOrderChange={setColumnOrder}
              onVisibleChange={setVisibleColumns}
              storageKey='reports-detail-columns-v1'
              defaultVisible={DETAIL_DEFAULT_VISIBLE}
            />
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
              disabled={rows.length === 0}
            />
          </>
        }
        emptyState={{
          icon: <ListFilter className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: 'Sin resultados',
          description: 'No se encontraron tickets con los filtros seleccionados.',
        }}
      />
    </div>
  )
}
