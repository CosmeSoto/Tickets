'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { safeFetch } from '@/lib/auth-fetch'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { SubtypeBadge } from '@/components/inventory/subtype-badge'
import { ExportButton } from '@/components/common/export-button'
import { getAssetStatusColor, getAssetStatusLabel } from '@/lib/utils/inventory-utils'
import { useExport } from '@/hooks/common/use-export'
import { Search } from 'lucide-react'
import type { AssetSubtype } from '@/lib/inventory/family-config'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFamilyOptions } from '@/hooks/use-family-options'

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
  personalOnly?: boolean // true = solo equipos asignados al usuario actual
}

const PAGE_SIZE = 20

const SUBTYPE_FILTER_OPTIONS: { value: AssetSubtype | ''; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'EQUIPMENT', label: 'Equipo' },
  { value: 'MRO', label: 'Material / Consumible' },
  { value: 'LICENSE', label: 'Licencia y Contrato' },
]

function StatusBadge({ status }: { status: string }) {
  const cls = getAssetStatusColor(status)
  const label = getAssetStatusLabel(status)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function UnifiedInventoryList({
  initialFamilyId,
  personalOnly = false,
}: UnifiedInventoryListProps) {
  const router = useRouter()
  const { status } = useSession()
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(initialFamilyId ?? null)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | ''>('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // ✅ Familias desde contexto global — sin petición extra (memoizadas)
  const { families } = useFamilyOptions()

  // Memoizar opciones de familias para FamilyCombobox
  const familyComboboxOptions = useMemo(
    () =>
      families.map(f => ({
        id: f.id,
        name: f.name,
        code: f.code,
        color: f.color,
      })),
    [families]
  )

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

  const fetchAssets = useCallback(
    async (familyId: string | null, subtype: AssetSubtype | '', q: string, currentPage: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
        })
        if (familyId && !personalOnly) params.set('familyId', familyId)
        if (subtype) params.set('subtype', subtype)
        if (q.trim()) params.set('search', q.trim())
        if (personalOnly) params.set('personalOnly', 'true')
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
    [personalOnly]
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

  // Exportación — activos visibles con filtros activos
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'inventario',
    title: 'Inventario de Activos',
    subtitle: `${total} activos${selectedFamilyId ? ' (filtrados por área)' : ''}`,
    getData: () => assets,
    columns: [
      {
        key: 'subtype',
        label: 'Tipo',
        format: (v: string) =>
          (
            ({
              EQUIPMENT: 'Equipo',
              MRO: 'Material / Consumible',
              LICENSE: 'Licencia y Contrato',
            }) as Record<string, string>
          )[v] ?? v,
      },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código', format: (v, r) => v ?? r.id.slice(0, 8) },
      { key: 'status', label: 'Estado', format: (v: string) => getAssetStatusLabel(v) },
      {
        key: 'createdAt',
        label: 'Creado',
        format: v => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
      },
    ],
  })

  return (
    <div className='space-y-4'>
      {/* Filtros: área + tipo + búsqueda + exportar */}
      <div className='flex flex-col sm:flex-row gap-2 flex-wrap'>
        {/* Área (familia) — combobox con buscador, solo en modo inventario de familias */}
        {!personalOnly && families.length > 1 && (
          <FamilyCombobox
            families={familyComboboxOptions}
            value={selectedFamilyId ?? 'all'}
            onValueChange={v => handleFamilyChange(v === 'all' ? null : v)}
            allowAll
            allowClear
            popoverWidth='260px'
            className='sm:w-52'
          />
        )}

        {/* Tipo de activo */}
        <select
          value={selectedSubtype}
          onChange={e => handleSubtypeChange(e.target.value as AssetSubtype | '')}
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-52'
        >
          {SUBTYPE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Búsqueda */}
        <div className='relative flex-1 min-w-[180px]'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder='Buscar por nombre o código...'
            className='flex h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground'
          />
        </div>

        {/* Exportar */}
        <ExportButton
          onExportCSV={exportCSV}
          onExportExcel={exportExcel}
          onExportPDF={exportPDF}
          loading={exporting}
          disabled={assets.length === 0}
        />
      </div>

      {/* Contador */}
      {!loading && (
        <p className='text-xs text-muted-foreground'>
          {total === 0 ? 'Sin resultados' : `${total} activo${total !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Tabla */}
      <div className='overflow-x-auto rounded-lg border border-border'>
        <table className='min-w-full divide-y divide-border text-sm'>
          <thead className='bg-muted/50'>
            <tr>
              <th className='px-4 py-3 text-left font-medium text-muted-foreground'>Tipo</th>
              <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell'>
                Área
              </th>
              <th className='px-4 py-3 text-left font-medium text-muted-foreground'>Nombre</th>
              <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell'>
                Código
              </th>
              <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell'>
                Estado
              </th>
              <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell'>
                Creado
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-border bg-card'>
            {loading ? (
              <tr>
                <td colSpan={6} className='px-4 py-10 text-center text-muted-foreground'>
                  <div className='flex items-center justify-center gap-2'>
                    <div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6} className='px-4 py-10 text-center text-muted-foreground'>
                  No hay activos para mostrar.
                </td>
              </tr>
            ) : (
              assets.map(asset => (
                <tr
                  key={asset.id}
                  className='cursor-pointer hover:bg-muted/50 transition-colors'
                  onClick={() =>
                    router.push(`/inventory/${asset.subtype.toLowerCase()}/${asset.id}`)
                  }
                >
                  <td className='px-4 py-3'>
                    <SubtypeBadge subtype={asset.subtype} size='sm' />
                  </td>
                  <td className='px-4 py-3 hidden sm:table-cell'>
                    <FamilyBadge family={asset.family} size='sm' />
                  </td>
                  <td className='px-4 py-3 font-medium text-foreground'>{asset.name}</td>
                  <td className='px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell'>
                    {asset.code ?? asset.id.slice(0, 8)}
                  </td>
                  <td className='px-4 py-3 hidden lg:table-cell'>
                    <StatusBadge status={asset.status} />
                  </td>
                  <td className='px-4 py-3 text-muted-foreground hidden lg:table-cell'>
                    {formatDate(asset.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className='flex items-center justify-end gap-2'>
          <button
            type='button'
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className='rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors'
          >
            Anterior
          </button>
          <span className='text-sm text-muted-foreground'>
            {page} / {totalPages}
          </span>
          <button
            type='button'
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className='rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors'
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
