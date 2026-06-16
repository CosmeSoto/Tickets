'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { safeFetch } from '@/lib/auth-fetch'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { SubtypeBadge } from '@/components/inventory/subtype-badge'
import { ExportButton } from '@/components/common/export-button'
import {
  getAssetStatusColor,
  getAssetStatusLabel,
  getAssetConditionColor,
  getAssetConditionLabel,
  getAcquisitionModeLabel,
} from '@/lib/utils/inventory-utils'
import { useExport } from '@/hooks/common/use-export'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, Check } from 'lucide-react'
import type { AssetSubtype } from '@/lib/inventory/family-config'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { MetricsSection } from '@/components/inventory/dashboard/metrics-section'
import { AlertsSection } from '@/components/inventory/dashboard/alerts-section'

interface UnifiedAsset {
  id: string
  name: string
  subtype: AssetSubtype
  familyId: string
  family: { name: string; icon: string | null; color: string | null }
  status: string
  code?: string
  acquisitionMode?: string
  condition?: string
  createdAt: string
  // Campos financieros opcionales (solo equipos)
  purchaseDate?: string
  purchasePrice?: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
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
  showDashboard?: boolean // true = mostrar métricas y alertas
}

const PAGE_SIZE = 20

const SUBTYPE_FILTER_OPTIONS: { value: AssetSubtype | ''; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'EQUIPMENT', label: 'Equipo' },
  { value: 'MRO', label: 'Material / Consumible' },
  { value: 'LICENSE', label: 'Licencia y Contrato' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'RETIRED', label: 'Retirado' },
  { value: 'FOR_SALE', label: 'En venta' },
]

const CONDITION_FILTER_OPTIONS = [
  { value: '', label: 'Todas las condiciones' },
  { value: 'NEW', label: 'Nuevo' },
  { value: 'LIKE_NEW', label: 'Como nuevo' },
  { value: 'GOOD', label: 'Bueno' },
  { value: 'FAIR', label: 'Regular' },
  { value: 'POOR', label: 'Malo' },
]

// Columnas configurables — las primeras 4 siempre visibles, el resto es opcional
type ColumnKey =
  | 'area'
  | 'codigo'
  | 'estado'
  | 'condicion'
  | 'propiedad'
  | 'creado'
  | 'fechaCompra'
  | 'factura'
  | 'ordenCompra'

const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'area', label: 'Área' },
  { key: 'codigo', label: 'Código' },
  { key: 'estado', label: 'Estado' },
  { key: 'condicion', label: 'Condición' },
  { key: 'propiedad', label: 'Propiedad' },
  { key: 'creado', label: 'Fecha de Creación' },
  { key: 'fechaCompra', label: 'Fecha de Compra' },
  { key: 'factura', label: 'N° Factura' },
  { key: 'ordenCompra', label: 'N° Orden de Compra' },
]

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'area',
  'codigo',
  'estado',
  'condicion',
  'propiedad',
  'creado',
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

function ConditionBadge({ condition }: { condition?: string }) {
  if (!condition) return null
  const cls = getAssetConditionColor(condition)
  const label = getAssetConditionLabel(condition)
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
  showDashboard = false,
}: UnifiedInventoryListProps) {
  const router = useRouter()
  const { status } = useSession()
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(initialFamilyId ?? null)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | ''>('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedCondition, setSelectedCondition] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_VISIBLE_COLUMNS)
  )
  const [showColumnPicker, setShowColumnPicker] = useState(false)

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

  // Ordenamiento client-side sobre la página actual
  // Añadimos familyName como campo virtual para poder ordenar por área
  const assetsWithFamilyName = useMemo(
    () => assets.map(a => ({ ...a, familyName: a.family?.name ?? '' })),
    [assets]
  )
  const {
    sortedData: sortedAssets,
    requestSort,
    getSortIcon,
  } = useTableSort(assetsWithFamilyName, { key: 'createdAt', direction: 'desc' })

  // Helper para renderizar iconos de ordenamiento
  const renderSortIcon = (key: string) => {
    const sortState = getSortIcon(key)
    if (sortState === 'asc') return <ArrowUp className='inline h-3.5 w-3.5 ml-1' />
    if (sortState === 'desc') return <ArrowDown className='inline h-3.5 w-3.5 ml-1' />
    return <ArrowUpDown className='inline h-3.5 w-3.5 ml-1 opacity-40' />
  }

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const fetchAssets = useCallback(
    async (
      familyId: string | null,
      subtype: AssetSubtype | '',
      q: string,
      currentPage: number,
      status: string,
      condition: string
    ) => {
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
        if (status) params.set('status', status)
        if (condition) params.set('condition', condition)
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
    fetchAssets(
      selectedFamilyId,
      selectedSubtype,
      debouncedSearch,
      page,
      selectedStatus,
      selectedCondition
    )
  }, [
    selectedFamilyId,
    selectedSubtype,
    debouncedSearch,
    page,
    fetchAssets,
    status,
    selectedStatus,
    selectedCondition,
  ])

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

  function handleStatusChange(s: string) {
    setSelectedStatus(s)
    setPage(1)
  }

  function handleConditionChange(c: string) {
    setSelectedCondition(c)
    setPage(1)
  }

  function toggleColumn(key: ColumnKey) {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const col = (key: ColumnKey) => visibleColumns.has(key)

  // Exportación — activos visibles con filtros y orden activos
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'inventario',
    title: 'Inventario de Activos',
    subtitle: `${total} activos${selectedFamilyId ? ' (filtrados por área)' : ''}${selectedStatus ? ` · ${getAssetStatusLabel(selectedStatus)}` : ''}${selectedCondition ? ` · ${getAssetConditionLabel(selectedCondition)}` : ''}`,
    getData: () => sortedAssets,
    columns: [
      {
        key: 'subtype',
        label: 'Tipo',
        format: (v: string) =>
          ({ EQUIPMENT: 'Equipo', MRO: 'Material / Consumible', LICENSE: 'Licencia y Contrato' })[
            v
          ] ?? v,
      },
      { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '' },
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código', format: (v: any, r: any) => v ?? r.id.slice(0, 8) },
      { key: 'status', label: 'Estado', format: (v: string) => getAssetStatusLabel(v) },
      {
        key: 'condition',
        label: 'Condición',
        format: (v: string) => (v ? getAssetConditionLabel(v) : ''),
      },
      {
        key: 'acquisitionMode',
        label: 'Propiedad',
        format: (v: string) => (v ? getAcquisitionModeLabel(v) : ''),
      },
      {
        key: 'createdAt',
        label: 'Fecha Creación',
        format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
      },
      {
        key: 'purchaseDate',
        label: 'Fecha de Compra',
        format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
      },
      {
        key: 'purchasePrice',
        label: 'Costo Adquisición',
        format: (v: any) => (v != null ? `$${Number(v).toFixed(2)}` : ''),
      },
      { key: 'invoiceNumber', label: 'N° Factura', format: (v: any) => v ?? '' },
      { key: 'purchaseOrderNumber', label: 'N° Orden de Compra', format: (v: any) => v ?? '' },
    ],
  })

  return (
    <div className='space-y-4'>
      {/* Dashboard: Métricas y Alertas */}
      {showDashboard && (
        <div className='space-y-6 mb-6'>
          <div>
            <h2 className='text-lg font-semibold mb-4'>Métricas Clave</h2>
            <MetricsSection />
          </div>
          <div>
            <h2 className='text-lg font-semibold mb-4'>Alertas</h2>
            <AlertsSection />
          </div>
        </div>
      )}

      {/* Filtros: área + tipo + estado + condición + búsqueda + columnas + exportar */}
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
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44'
        >
          {SUBTYPE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Estado */}
        <select
          value={selectedStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44'
        >
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Condición */}
        <select
          value={selectedCondition}
          onChange={e => handleConditionChange(e.target.value)}
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44'
        >
          {CONDITION_FILTER_OPTIONS.map(o => (
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

        {/* Selector de columnas */}
        <div className='relative'>
          <button
            type='button'
            onClick={() => setShowColumnPicker(p => !p)}
            className='flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors'
            title='Configurar columnas'
          >
            <SlidersHorizontal className='h-4 w-4' />
            <span className='hidden sm:inline'>Columnas</span>
          </button>
          {showColumnPicker && (
            <>
              <div className='fixed inset-0 z-10' onClick={() => setShowColumnPicker(false)} />
              <div className='absolute right-0 z-20 mt-1 w-48 rounded-md border border-border bg-popover shadow-lg p-1'>
                <p className='px-2 py-1.5 text-xs font-medium text-muted-foreground'>
                  Columnas visibles
                </p>
                {OPTIONAL_COLUMNS.map(c => (
                  <button
                    key={c.key}
                    type='button'
                    onClick={() => toggleColumn(c.key)}
                    className='flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors'
                  >
                    <span className='h-4 w-4 flex items-center justify-center'>
                      {visibleColumns.has(c.key) && <Check className='h-3.5 w-3.5 text-primary' />}
                    </span>
                    {c.label}
                  </button>
                ))}
              </div>
            </>
          )}
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
              <th
                className='px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                onClick={() => requestSort('subtype')}
              >
                Tipo {renderSortIcon('subtype')}
              </th>
              {col('area') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell cursor-pointer hover:bg-muted/50 transition-colors select-none'
                  onClick={() => requestSort('familyName')}
                >
                  Área {renderSortIcon('familyName')}
                </th>
              )}
              <th
                className='px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                onClick={() => requestSort('name')}
              >
                Nombre {renderSortIcon('name')}
              </th>
              {col('codigo') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-muted/50 transition-colors select-none'
                  onClick={() => requestSort('code')}
                >
                  Código {renderSortIcon('code')}
                </th>
              )}
              {col('estado') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 transition-colors select-none'
                  onClick={() => requestSort('status')}
                >
                  Estado {renderSortIcon('status')}
                </th>
              )}
              {col('condicion') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 transition-colors select-none'
                  onClick={() => requestSort('condition')}
                >
                  Condición {renderSortIcon('condition')}
                </th>
              )}
              {col('propiedad') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 transition-colors select-none'
                  onClick={() => requestSort('acquisitionMode')}
                >
                  Propiedad {renderSortIcon('acquisitionMode')}
                </th>
              )}
              {col('creado') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 transition-colors select-none'
                  onClick={() => requestSort('createdAt')}
                >
                  Creado {renderSortIcon('createdAt')}
                </th>
              )}
              {col('fechaCompra') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none'>
                  F. Compra
                </th>
              )}
              {col('factura') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none'>
                  N° Factura
                </th>
              )}
              {col('ordenCompra') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none'>
                  N° OC
                </th>
              )}
            </tr>
          </thead>
          <tbody className='divide-y divide-border bg-card'>
            {loading ? (
              <tr>
                <td
                  colSpan={2 + Array.from(visibleColumns).length}
                  className='px-4 py-10 text-center text-muted-foreground'
                >
                  <div className='flex items-center justify-center gap-2'>
                    <div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : sortedAssets.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + Array.from(visibleColumns).length}
                  className='px-4 py-10 text-center text-muted-foreground'
                >
                  No hay activos para mostrar.
                </td>
              </tr>
            ) : (
              sortedAssets.map(asset => (
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
                  {col('area') && (
                    <td className='px-4 py-3 hidden sm:table-cell'>
                      <FamilyBadge family={asset.family} size='sm' />
                    </td>
                  )}
                  <td className='px-4 py-3 font-medium text-foreground'>{asset.name}</td>
                  {col('codigo') && (
                    <td className='px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell'>
                      {asset.code ?? asset.id.slice(0, 8)}
                    </td>
                  )}
                  {col('estado') && (
                    <td className='px-4 py-3 hidden lg:table-cell'>
                      <StatusBadge status={asset.status} />
                    </td>
                  )}
                  {col('condicion') && (
                    <td className='px-4 py-3 hidden lg:table-cell'>
                      <ConditionBadge condition={asset.condition} />
                    </td>
                  )}
                  {col('propiedad') && (
                    <td className='px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell'>
                      {asset.acquisitionMode ? getAcquisitionModeLabel(asset.acquisitionMode) : ''}
                    </td>
                  )}
                  {col('creado') && (
                    <td className='px-4 py-3 text-muted-foreground hidden lg:table-cell'>
                      {formatDate(asset.createdAt)}
                    </td>
                  )}
                  {col('fechaCompra') && (
                    <td className='px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell'>
                      {asset.purchaseDate ? formatDate(asset.purchaseDate) : '—'}
                    </td>
                  )}
                  {col('factura') && (
                    <td className='px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell font-mono'>
                      {asset.invoiceNumber ?? '—'}
                    </td>
                  )}
                  {col('ordenCompra') && (
                    <td className='px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell font-mono'>
                      {asset.purchaseOrderNumber ?? '—'}
                    </td>
                  )}
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
