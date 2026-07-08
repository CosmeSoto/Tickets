'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { safeFetch } from '@/lib/auth-fetch'
import {
  getAssetStatusLabel,
  getAssetConditionLabel,
  getAcquisitionModeLabel,
} from '@/lib/utils/inventory-utils'
import { useExport } from '@/hooks/common/use-export'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { useFamilyOptions } from '@/hooks/use-family-options'
import type { AssetSubtype } from '@/lib/inventory/family-config'
import type {
  UnifiedAsset,
  UnifiedAssetsResponse,
  ColumnKey,
} from '@/types/inventory/unified-asset'
import {
  DEFAULT_VISIBLE_COLUMNS,
  OPTIONAL_COLUMNS,
  COLUMN_KEY_TO_ASSET_KEY,
} from '@/types/inventory/unified-asset'
import { EQUIPMENT_SHARED_FIELDS } from '@/lib/inventory/equipment-field-definitions'

const PAGE_SIZE = 20

function formatImportCompatibleDate(v: unknown): string {
  if (!v) return ''
  const d = new Date(v as string)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatImportCompatiblePrice(v: unknown): string {
  if (v == null || v === '') return ''
  const n = Number(v)
  return Number.isNaN(n) ? '' : n.toFixed(2)
}

const sharedFieldExportMap = Object.fromEntries(
  EQUIPMENT_SHARED_FIELDS.map(f => [f.key, f.exportLabel])
) as Record<string, string>

// Todas las columnas disponibles para el export con su formato
const ALL_EXPORT_COLUMNS = [
  {
    key: 'subtype',
    label: 'Tipo',
    format: (v: string) =>
      ({ EQUIPMENT: 'Equipo', MRO: 'Material / Consumible', LICENSE: 'Licencia y Contrato' })[v] ??
      v,
  },
  { key: 'family', label: 'Área', format: (v: any) => v?.name ?? '' },
  { key: 'name', label: 'Nombre' },
  { key: 'code', label: 'Código', format: (v: any, r: any) => v ?? r.id.slice(0, 8) },
  {
    key: 'serialNumber',
    label: sharedFieldExportMap.serialNumber,
    format: (v: any) => v ?? '',
  },
  { key: 'status', label: 'Estado', format: (v: string) => getAssetStatusLabel(v) },
  {
    key: 'condition',
    label: sharedFieldExportMap.condition,
    format: (v: string) => (v ? getAssetConditionLabel(v) : ''),
  },
  {
    key: 'acquisitionMode',
    label: 'Propiedad',
    format: (v: string) => (v ? getAcquisitionModeLabel(v) : ''),
  },
  {
    key: 'warehouseName',
    label: sharedFieldExportMap.warehouse,
    format: (v: any) => v ?? '',
  },
  {
    key: 'physicalLocation',
    label: sharedFieldExportMap.physicalLocation,
    format: (v: any) => v ?? '',
  },
  {
    key: 'createdAt',
    label: 'Fecha Creación',
    format: (v: any) => (v ? new Date(v).toLocaleDateString('es-ES') : ''),
  },
  {
    key: 'purchaseDate',
    label: sharedFieldExportMap.purchaseDate,
    format: (v: any) => formatImportCompatibleDate(v),
  },
  {
    key: 'purchasePrice',
    label: sharedFieldExportMap.purchasePrice,
    format: (v: any) => formatImportCompatiblePrice(v),
  },
  { key: 'invoiceNumber', label: sharedFieldExportMap.invoiceNumber, format: (v: any) => v ?? '' },
  { key: 'purchaseOrderNumber', label: 'N° Orden de Compra', format: (v: any) => v ?? '' },
  { key: 'attributes', label: 'Atributos', format: (v: any) => v ?? '' },
  { key: 'accessories', label: sharedFieldExportMap.accessories, format: (v: any) => v ?? '' },
  { key: 'notes', label: sharedFieldExportMap.notes, format: (v: any) => v ?? '' },
  { key: 'batchCode', label: 'Lote', format: (v: any) => v ?? 'Individual' },
]

interface UseInventoryListProps {
  initialFamilyId?: string
  personalOnly?: boolean
}

export function useInventoryList({ initialFamilyId, personalOnly = false }: UseInventoryListProps) {
  const { status } = useSession()
  const { families } = useFamilyOptions()

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(initialFamilyId ?? null)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | ''>('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedCondition, setSelectedCondition] = useState('')
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('')
  const [batchOptions, setBatchOptions] = useState<{ id: string; batchCode: string }[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // ── Columnas configurables ────────────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(DEFAULT_VISIBLE_COLUMNS)
  )
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // ── Datos ─────────────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<UnifiedAsset[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // Opciones de familia para el combobox
  const familyComboboxOptions = useMemo(
    () => families.map(f => ({ id: f.id, name: f.name, code: f.code, color: f.color })),
    [families]
  )

  // ── Ordenamiento ──────────────────────────────────────────────────────────
  const assetsWithFamilyName = useMemo(
    () => assets.map(a => ({ ...a, familyName: a.family?.name ?? '' })),
    [assets]
  )
  const {
    sortedData: sortedAssets,
    requestSort,
    getSortIcon,
  } = useTableSort(assetsWithFamilyName, { key: 'createdAt', direction: 'desc' })

  // ── Debounce búsqueda ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // ── Opciones de lote para filtro ─────────────────────────────────────────
  useEffect(() => {
    if (personalOnly || status !== 'authenticated') return
    fetch('/api/inventory/batches?limit=200')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.batches ?? [])
        setBatchOptions(
          list.map((b: { id: string; batchCode: string }) => ({
            id: b.id,
            batchCode: b.batchCode,
          }))
        )
      })
      .catch(() => setBatchOptions([]))
  }, [personalOnly, status])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(
    async (
      familyId: string | null,
      subtype: AssetSubtype | '',
      q: string,
      currentPage: number,
      statusVal: string,
      conditionVal: string,
      batchVal: string
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
        if (statusVal) params.set('status', statusVal)
        if (conditionVal) params.set('condition', conditionVal)
        if (batchVal) params.set('batchFilter', batchVal)
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
      selectedCondition,
      selectedBatchFilter
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
    selectedBatchFilter,
  ])

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFamilyChange = (familyId: string | null) => {
    setSelectedFamilyId(familyId)
    setPage(1)
  }
  const handleSubtypeChange = (subtype: AssetSubtype | '') => {
    setSelectedSubtype(subtype)
    setPage(1)
  }
  const handleSearchChange = (q: string) => {
    setSearch(q)
    setPage(1)
  }
  const handleStatusChange = (s: string) => {
    setSelectedStatus(s)
    setPage(1)
  }
  const handleConditionChange = (c: string) => {
    setSelectedCondition(c)
    setPage(1)
  }
  const handleBatchFilterChange = (b: string) => {
    setSelectedBatchFilter(b)
    setPage(1)
  }

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const resetColumns = () => setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS))
  const showAllColumns = () => setVisibleColumns(new Set(OPTIONAL_COLUMNS.map(c => c.key)))
  const col = (key: ColumnKey) => visibleColumns.has(key)

  // ── Export — solo columnas visibles ──────────────────────────────────────
  const activeExportColumns = useMemo(() => {
    const byKey = new Map(ALL_EXPORT_COLUMNS.map(c => [c.key, c]))
    return [
      byKey.get('subtype')!, // Tipo — siempre
      byKey.get('name')!, // Nombre — siempre
      ...Array.from(visibleColumns)
        .map(ck => {
          const assetKey = COLUMN_KEY_TO_ASSET_KEY[ck]
          return assetKey ? byKey.get(assetKey) : undefined
        })
        .filter((c): c is (typeof ALL_EXPORT_COLUMNS)[0] => !!c),
    ]
  }, [visibleColumns])

  const exportSubtitle = `${total} activos${selectedFamilyId ? ' (filtrados por área)' : ''}${selectedStatus ? ` · ${getAssetStatusLabel(selectedStatus)}` : ''}${selectedCondition ? ` · ${getAssetConditionLabel(selectedCondition)}` : ''}`

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'inventario',
    title: 'Inventario de Activos',
    subtitle: exportSubtitle,
    getData: () => sortedAssets,
    columns: activeExportColumns,
  })

  return {
    // Data
    assets,
    sortedAssets,
    total,
    totalPages,
    loading,
    families,
    familyComboboxOptions,
    // Filters
    selectedFamilyId,
    selectedSubtype,
    selectedStatus,
    selectedCondition,
    selectedBatchFilter,
    batchOptions,
    search,
    page,
    setPage,
    handleFamilyChange,
    handleSubtypeChange,
    handleSearchChange,
    handleStatusChange,
    handleConditionChange,
    handleBatchFilterChange,
    // Columns
    visibleColumns,
    showColumnPicker,
    setShowColumnPicker,
    toggleColumn,
    resetColumns,
    showAllColumns,
    col,
    // Sort
    requestSort,
    getSortIcon,
    // Export
    exportCSV,
    exportExcel,
    exportPDF,
    exporting,
  }
}
