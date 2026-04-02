'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { safeFetch } from '@/lib/auth-fetch'
import { FamilyFilterBar } from '@/components/inventory/family-filter-bar'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { SubtypeBadge } from '@/components/inventory/subtype-badge'
import { Search } from 'lucide-react'
import type { AssetSubtype } from '@/lib/inventory/family-config'

interface Family {
  id: string
  name: string
  icon?: string | null
  color?: string | null
}

interface UnifiedAsset {
  id: string
  name: string
  subtype: AssetSubtype
  familyId: string
  family: { name: string; icon: string | null; color: string | null }
  status: string
  code?: string
  createdAt: string
}

interface UnifiedAssetsResponse {
  items: UnifiedAsset[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface UnifiedInventoryListProps {
  initialFamilyId?: string
}

const PAGE_SIZE = 20

const SUBTYPE_FILTER_OPTIONS: { value: AssetSubtype | ''; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'EQUIPMENT', label: 'Equipo Físico' },
  { value: 'MRO', label: 'Material MRO' },
  { value: 'LICENSE', label: 'Contrato / Licencia' },
]

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE:   'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ASSIGNED:    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  MAINTENANCE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  DAMAGED:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  RETIRED:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ACTIVE:      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  EXPIRED:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE:   'Disponible',
  ASSIGNED:    'Asignado',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED:     'Dañado',
  RETIRED:     'Retirado',
  ACTIVE:      'Activo',
  EXPIRED:     'Vencido',
  CANCELLED:   'Cancelado',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
  const label = STATUS_LABELS[status] ?? status
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function UnifiedInventoryList({ initialFamilyId }: UnifiedInventoryListProps) {
  const router = useRouter()
  const { status } = useSession()
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(initialFamilyId ?? null)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | ''>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [families, setFamilies] = useState<Family[]>([])
  const [assets, setAssets] = useState<UnifiedAsset[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (status !== 'authenticated') return
    safeFetch('/api/inventory/families')
      .then(r => r?.json())
      .then(data => {
        if (!data) return
        if (Array.isArray(data)) setFamilies(data)
        else if (Array.isArray(data?.families)) setFamilies(data.families)
      })
  }, [status])

  const fetchAssets = useCallback(
    async (familyId: string | null, subtype: AssetSubtype | '', q: string, currentPage: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) })
        if (familyId) params.set('familyId', familyId)
        if (subtype) params.set('subtype', subtype)
        if (q.trim()) params.set('search', q.trim())
        const res = await safeFetch(`/api/inventory/assets?${params.toString()}`)
        if (!res?.ok) return
        const data: UnifiedAssetsResponse = await res.json()
        setAssets(data.items)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (status !== 'authenticated') return
    fetchAssets(selectedFamilyId, selectedSubtype, debouncedSearch, page)
  }, [selectedFamilyId, selectedSubtype, debouncedSearch, page, fetchAssets, status])

  function handleFamilyChange(familyId: string | null) {
    setSelectedFamilyId(familyId)
    setPage(1)
  }

  function handleSubtypeChange(subtype: AssetSubtype | '') {
    setSelectedSubtype(subtype)
    setPage(1)
  }

  function handleSearchChange(q: string) {
    setSearch(q)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filtro de familia */}
      <FamilyFilterBar
        families={families}
        selectedId={selectedFamilyId}
        onChange={handleFamilyChange}
      />

      {/* Barra de búsqueda + filtro subtipo */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="flex h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={selectedSubtype}
          onChange={e => handleSubtypeChange(e.target.value as AssetSubtype | '')}
          className="flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-52"
        >
          {SUBTYPE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Contador */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {total === 0 ? 'Sin resultados' : `${total} activo${total !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Familia</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Código</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No hay activos para mostrar.
                </td>
              </tr>
            ) : (
              assets.map(asset => (
                <tr
                  key={asset.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/inventory/${asset.subtype.toLowerCase()}/${asset.id}`)}
                >
                  <td className="px-4 py-3">
                    <SubtypeBadge subtype={asset.subtype} size="sm" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <FamilyBadge family={asset.family} size="sm" />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{asset.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                    {asset.code ?? asset.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(asset.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
