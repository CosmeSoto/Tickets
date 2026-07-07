/**
 * Hook para gestión de solicitudes de activos
 * Centraliza la lógica de negocio, filtros, paginación y exportación
 */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'
import { useExport } from '@/hooks/common/use-export'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { ASSET_REQUEST_EXPORT_COLUMNS } from '@/lib/utils/asset-request-utils'
import type { AssetRequestStatus, AssetType } from '@prisma/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AssetRequest {
  id: string
  code: string
  assetType: AssetType
  description: string
  justification: string
  status: AssetRequestStatus
  quantity: number
  neededBy: string | null
  familyId: string
  familyName?: string
  familyCode?: string
  assetId: string | null
  assetName?: string | null
  requesterId: string
  requesterName?: string
  requesterEmail?: string
  reviewedById: string | null
  reviewerName?: string | null
  reviewedAt: string | null
  reviewerComment: string | null
  fulfilledById: string | null
  fulfillerName?: string | null
  fulfilledAt: string | null
  reviewComments: Array<{
    userId: string
    userName: string
    comment: string
    timestamp: string
  }>
  createdAt: string
  updatedAt: string
}

export interface AssetRequestFilters {
  status?: AssetRequestStatus
  assetType?: AssetType
  familyId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface AssetRequestListResponse {
  data: AssetRequest[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateAssetRequestData {
  assetType: AssetType
  description: string
  familyId: string
  justification: string
  assetId?: string
  quantity?: number
  neededBy?: string
}

export interface UpdateStatusData {
  status: AssetRequestStatus
  comment?: string
}

export interface AddCommentData {
  comment: string
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export interface UseAssetRequestsOptions {
  /** Filtros iniciales */
  initialFilters?: AssetRequestFilters
  /** Tamaño de página inicial */
  pageSize?: number
  /** Auto-refrescar cada X ms (opcional) */
  refreshInterval?: number
}

export interface UseAssetRequestsReturn {
  // Datos
  data: AssetRequest[]
  total: number
  isLoading: boolean
  error: string | null

  // Filtros
  filters: AssetRequestFilters
  setFilter: <K extends keyof AssetRequestFilters>(key: K, value: AssetRequestFilters[K]) => void
  clearFilters: () => void

  // Paginación
  pagination: {
    page: number
    limit: number
    totalPages: number
    goToPage: (page: number) => void
    nextPage: () => void
    prevPage: () => void
    setPageSize: (size: number) => void
  }

  // Mutaciones
  createRequest: (data: CreateAssetRequestData) => Promise<{ id: string; code: string }>
  updateStatus: (requestId: string, data: UpdateStatusData) => Promise<void>
  addComment: (requestId: string, data: AddCommentData) => Promise<void>
  refresh: () => void

  // Exportación
  exportCSV: () => void
  exportExcel: () => Promise<void>
  exportPDF: () => void
  exporting: boolean
}

export function useAssetRequests(options: UseAssetRequestsOptions = {}): UseAssetRequestsReturn {
  const { initialFilters = {}, pageSize: initialPageSize = 20, refreshInterval } = options

  // ── State ──────────────────────────────────────────────────────────────────

  const [data, setData] = useState<AssetRequest[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filters, setFilters] = useState<AssetRequestFilters>(initialFilters)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(initialPageSize)

  // Debounce del campo de búsqueda (300ms)
  const debouncedSearch = useDebounce(filters.search, 300)

  // ── Fetch data ─────────────────────────────────────────────────────────────

  const fetchRequests = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (filters.status) params.append('status', filters.status)
      if (filters.assetType) params.append('assetType', filters.assetType)
      if (filters.familyId) params.append('familyId', filters.familyId)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)
      if (debouncedSearch) params.append('search', debouncedSearch)

      const res = await fetch(`/api/inventory/asset-requests?${params.toString()}`)

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al cargar solicitudes')
      }

      const result: AssetRequestListResponse = await res.json()

      setData(result.data || [])
      setTotal(result.total || 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      toast({
        title: 'Error al cargar solicitudes',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [page, limit, filters, debouncedSearch, toast])

  // Fetch inicial y cuando cambian los filtros/paginación
  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  // Auto-refresh opcional
  useEffect(() => {
    if (!refreshInterval) return

    const interval = setInterval(() => {
      fetchRequests()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, fetchRequests])

  // ── Filtros ────────────────────────────────────────────────────────────────

  const setFilter = useCallback(
    <K extends keyof AssetRequestFilters>(key: K, value: AssetRequestFilters[K]) => {
      setFilters(prev => ({ ...prev, [key]: value }))
      setPage(1) // Reset a primera página cuando cambian filtros
    },
    []
  )

  const clearFilters = useCallback(() => {
    setFilters({})
    setPage(1)
  }, [])

  // ── Paginación ─────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const goToPage = useCallback(
    (newPage: number) => {
      const validPage = Math.max(1, Math.min(newPage, totalPages))
      setPage(validPage)
    },
    [totalPages]
  )

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      setPage(prev => prev + 1)
    }
  }, [page, totalPages])

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage(prev => prev - 1)
    }
  }, [page])

  const setPageSize = useCallback((size: number) => {
    setLimit(size)
    setPage(1) // Reset a primera página cuando cambia el tamaño
  }, [])

  const pagination = useMemo(
    () => ({
      page,
      limit,
      totalPages,
      goToPage,
      nextPage,
      prevPage,
      setPageSize,
    }),
    [page, limit, totalPages, goToPage, nextPage, prevPage, setPageSize]
  )

  // ── Mutaciones ─────────────────────────────────────────────────────────────

  const createRequest = useCallback(
    async (requestData: CreateAssetRequestData): Promise<{ id: string; code: string }> => {
      try {
        const res = await fetch('/api/inventory/asset-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Error al crear solicitud')
        }

        const result = await res.json()

        toast({
          title: 'Solicitud creada',
          description: `Solicitud ${result.code} creada exitosamente`,
        })

        // Invalidar caché y refrescar
        await fetchRequests()

        return { id: result.id, code: result.code }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        toast({
          title: 'Error al crear solicitud',
          description: message,
          variant: 'destructive',
        })
        throw err
      }
    },
    [fetchRequests, toast]
  )

  const updateStatus = useCallback(
    async (requestId: string, statusData: UpdateStatusData): Promise<void> => {
      try {
        const res = await fetch(`/api/inventory/asset-requests/${requestId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(statusData),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Error al actualizar estado')
        }

        toast({
          title: 'Estado actualizado',
          description: 'El estado de la solicitud se actualizó correctamente',
        })

        // Invalidar caché y refrescar
        await fetchRequests()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        toast({
          title: 'Error al actualizar estado',
          description: message,
          variant: 'destructive',
        })
        throw err
      }
    },
    [fetchRequests, toast]
  )

  const addComment = useCallback(
    async (requestId: string, commentData: AddCommentData): Promise<void> => {
      try {
        const res = await fetch(`/api/inventory/asset-requests/${requestId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(commentData),
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Error al agregar comentario')
        }

        toast({
          title: 'Comentario agregado',
          description: 'El comentario se agregó correctamente',
        })

        // Invalidar caché y refrescar
        await fetchRequests()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        toast({
          title: 'Error al agregar comentario',
          description: message,
          variant: 'destructive',
        })
        throw err
      }
    },
    [fetchRequests, toast]
  )

  const refresh = useCallback(() => {
    fetchRequests()
  }, [fetchRequests])

  // ── Exportación ────────────────────────────────────────────────────────────

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'solicitudes-activos',
    title: 'Solicitudes de Activos',
    subtitle: `Total: ${total} solicitudes`,
    columns: ASSET_REQUEST_EXPORT_COLUMNS,
    getData: () => data,
  })

  // ── Return ─────────────────────────────────────────────────────────────────

  return {
    // Datos
    data,
    total,
    isLoading,
    error,

    // Filtros
    filters,
    setFilter,
    clearFilters,

    // Paginación
    pagination,

    // Mutaciones
    createRequest,
    updateStatus,
    addComment,
    refresh,

    // Exportación
    exportCSV,
    exportExcel,
    exportPDF,
    exporting,
  }
}
