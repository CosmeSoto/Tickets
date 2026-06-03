'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search, RefreshCw, Filter, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/common/views/data-table'
import { ExportButton } from '@/components/common/export-button'
import { createAssetRequestColumns } from '@/components/inventory/asset-requests/asset-request-columns'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import { AssetRequestStatus, AssetType } from '@prisma/client'

interface AssetRequest {
  id: string
  code: string
  assetType: AssetType
  description: string
  familyId: string
  familyName: string
  status: AssetRequestStatus
  requesterId: string
  requesterName: string
  createdAt: string
  updatedAt: string
  slaDeadline?: string | null
}

interface ListResponse {
  data: AssetRequest[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'UNDER_REVIEW', label: 'En Revisión' },
  { value: 'APPROVED', label: 'Aprobada' },
  { value: 'REJECTED', label: 'Rechazada' },
  { value: 'FULFILLED', label: 'Cumplida' },
]

const TYPE_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'EQUIPMENT', label: 'Equipo' },
  { value: 'LICENSE', label: 'Licencia' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
]

const EXPORT_COLUMNS = [
  { key: 'code', header: 'Código' },
  { key: 'assetType', header: 'Tipo' },
  { key: 'description', header: 'Descripción' },
  { key: 'familyName', header: 'Familia' },
  { key: 'requesterName', header: 'Solicitante' },
  { key: 'status', header: 'Estado' },
  { key: 'createdAt', header: 'Creado' },
]

export default function AssetRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<AssetRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  const hasActiveFilters = search || statusFilter !== 'all' || typeFilter !== 'all'
  const activeFiltersCount = [statusFilter !== 'all', typeFilter !== 'all'].filter(Boolean).length

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (search) params.append('search', search)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter !== 'all') params.append('assetType', typeFilter)

      const response = await fetch(`/api/inventory/asset-requests?${params}`)
      if (!response.ok) {
        throw new Error('Error al cargar solicitudes')
      }

      const data: ListResponse = await response.json()
      setRequests(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al cargar solicitudes'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, statusFilter, typeFilter])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilter])

  // Initial load and when page/limit/filters change
  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleFilterChange = useCallback(() => {
    // Already handled by useEffect
  }, [])

  const handleViewRequest = (request: AssetRequest) => {
    router.push(`/inventory/asset-requests/${request.id}`)
  }

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setTypeFilter('all')
    setPage(1)
  }

  const paginationConfig = useMemo(
    () => ({
      page,
      limit,
      total,
      onPageChange: (newPage: number) => setPage(newPage),
      onLimitChange: (newLimit: number) => {
        setLimit(newLimit)
        setPage(1)
      },
    }),
    [page, limit, total]
  )

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'solicitudes-activos',
    title: 'Solicitudes de Activos',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-ES')} • ${total} solicitudes`,
    getData: () => requests,
    columns: EXPORT_COLUMNS,
  })

  const columns = useMemo(() => createAssetRequestColumns({ onView: handleViewRequest }), [])

  return (
    <ModuleLayout
      title='Solicitudes de Activos'
      subtitle='Gestiona las solicitudes de equipos, licencias y mantenimiento'
      loading={loading && requests.length === 0}
      error={error}
      onRetry={loadRequests}
      headerActions={
        <Button asChild>
          <Link href='/inventory/asset-requests/create'>
            <Plus className='h-4 w-4 mr-2' />
            Nueva Solicitud
          </Link>
        </Button>
      }
    >
      {/* Filters */}
      <div className='space-y-4 mb-6'>
        <div className='flex gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
            <Input
              type='text'
              placeholder='Buscar por código o descripción...'
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFilterChange()}
              className='pl-10'
            />
          </div>
          <Button
            variant={showAdvancedFilters ? 'default' : 'outline'}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className='flex items-center gap-2'
          >
            <Filter className='w-4 h-4' />
            Filtros
            {activeFiltersCount > 0 && (
              <Badge variant='secondary' className='ml-1'>
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
          <Button variant='outline' onClick={loadRequests} className='flex items-center gap-2'>
            <RefreshCw className='w-4 h-4' />
            Actualizar
          </Button>
          {hasActiveFilters && (
            <Button
              variant='ghost'
              onClick={handleClearFilters}
              className='flex items-center gap-2'
            >
              <X className='w-4 h-4' />
              Limpiar
            </Button>
          )}
        </div>

        {showAdvancedFilters && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50'>
            <div>
              <label className='text-sm font-medium mb-2 block'>Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Todos los estados' />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className='text-sm font-medium mb-2 block'>Tipo de Activo</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder='Todos los tipos' />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        title='Solicitudes de Activos'
        description={`Listado de solicitudes (${total} total)`}
        data={requests}
        columns={columns}
        loading={loading}
        pagination={paginationConfig}
        onRefresh={loadRequests}
        onRowClick={handleViewRequest}
        actions={
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={requests.length === 0}
          />
        }
        emptyState={{
          icon: <Plus className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: hasActiveFilters ? 'No se encontraron solicitudes' : 'No hay solicitudes',
          description: hasActiveFilters
            ? 'Intenta ajustar los filtros de búsqueda'
            : 'Comienza creando tu primera solicitud de activo',
          action: hasActiveFilters ? (
            <Button variant='outline' onClick={handleClearFilters}>
              Limpiar filtros
            </Button>
          ) : (
            <Button asChild>
              <Link href='/inventory/asset-requests/create'>
                <Plus className='h-4 w-4 mr-2' />
                Nueva Solicitud
              </Link>
            </Button>
          ),
        }}
      />
    </ModuleLayout>
  )
}
