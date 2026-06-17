'use client'

import { useRouter } from 'next/navigation'
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
import { Search, ArrowUpDown, ArrowUp, ArrowDown, SlidersHorizontal, Check } from 'lucide-react'
import { MetricsSection } from '@/components/inventory/dashboard/metrics-section'
import { AlertsSection } from '@/components/inventory/dashboard/alerts-section'
import { useInventoryList } from '@/hooks/inventory/use-inventory-list'
import {
  SUBTYPE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  CONDITION_FILTER_OPTIONS,
  OPTIONAL_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
} from '@/types/inventory/unified-asset'
import type { AssetSubtype } from '@/lib/inventory/family-config'

interface UnifiedInventoryListProps {
  initialFamilyId?: string
  personalOnly?: boolean
  showDashboard?: boolean
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAssetStatusColor(status)}`}
    >
      {getAssetStatusLabel(status)}
    </span>
  )
}

function ConditionBadge({ condition }: { condition?: string }) {
  if (!condition) return null
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getAssetConditionColor(condition)}`}
    >
      {getAssetConditionLabel(condition)}
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
  const {
    sortedAssets,
    total,
    totalPages,
    loading,
    families,
    familyComboboxOptions,
    selectedFamilyId,
    selectedSubtype,
    selectedStatus,
    selectedCondition,
    search,
    page,
    setPage,
    handleFamilyChange,
    handleSubtypeChange,
    handleSearchChange,
    handleStatusChange,
    handleConditionChange,
    visibleColumns,
    showColumnPicker,
    setShowColumnPicker,
    toggleColumn,
    resetColumns,
    showAllColumns,
    col,
    requestSort,
    getSortIcon,
    exportCSV,
    exportExcel,
    exportPDF,
    exporting,
  } = useInventoryList({ initialFamilyId, personalOnly })

  const renderSortIcon = (key: string) => {
    const s = getSortIcon(key)
    if (s === 'asc') return <ArrowUp className='inline h-3.5 w-3.5 ml-1' />
    if (s === 'desc') return <ArrowDown className='inline h-3.5 w-3.5 ml-1' />
    return <ArrowUpDown className='inline h-3.5 w-3.5 ml-1 opacity-40' />
  }

  const colCount = 2 + Array.from(visibleColumns).length

  return (
    <div className='space-y-4'>
      {/* Dashboard */}
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

      {/* Filtros */}
      <div className='flex flex-col sm:flex-row gap-2 flex-wrap'>
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

        <select
          value={selectedSubtype}
          onChange={e => handleSubtypeChange(e.target.value as AssetSubtype | '')}
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm sm:w-44'
        >
          {SUBTYPE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm sm:w-44'
        >
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={selectedCondition}
          onChange={e => handleConditionChange(e.target.value)}
          className='flex h-9 rounded-md border border-border bg-card px-3 py-2 text-sm sm:w-44'
        >
          {CONDITION_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className='relative flex-1 min-w-[160px]'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder='Buscar por nombre o código...'
            className='flex h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground'
          />
        </div>

        {/* Selector de columnas */}
        <div className='relative'>
          <button
            type='button'
            onClick={() => setShowColumnPicker(p => !p)}
            className='flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors'
          >
            <SlidersHorizontal className='h-4 w-4' />
            <span className='hidden sm:inline'>Columnas</span>
          </button>
          {showColumnPicker && (
            <>
              <div className='fixed inset-0 z-10' onClick={() => setShowColumnPicker(false)} />
              <div className='absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-popover shadow-lg overflow-hidden'>
                <p className='px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border'>
                  Columnas visibles
                </p>
                <div className='max-h-64 overflow-y-auto py-1'>
                  {OPTIONAL_COLUMNS.map(c => (
                    <button
                      key={c.key}
                      type='button'
                      onClick={() => toggleColumn(c.key)}
                      className='flex w-full items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accent transition-colors'
                    >
                      <span
                        className={`h-4 w-4 shrink-0 rounded border flex items-center justify-center ${visibleColumns.has(c.key) ? 'bg-primary border-primary' : 'border-border bg-background'}`}
                      >
                        {visibleColumns.has(c.key) && (
                          <Check className='h-2.5 w-2.5 text-primary-foreground' />
                        )}
                      </span>
                      <span className='text-left'>{c.label}</span>
                    </button>
                  ))}
                </div>
                <div className='border-t border-border px-3 py-2 flex gap-2'>
                  <button
                    type='button'
                    onClick={resetColumns}
                    className='text-xs text-muted-foreground hover:text-foreground transition-colors'
                  >
                    Predeterminado
                  </button>
                  <span className='text-muted-foreground'>·</span>
                  <button
                    type='button'
                    onClick={showAllColumns}
                    className='text-xs text-muted-foreground hover:text-foreground transition-colors'
                  >
                    Todas
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <ExportButton
          onExportCSV={exportCSV}
          onExportExcel={exportExcel}
          onExportPDF={exportPDF}
          loading={exporting}
          disabled={sortedAssets.length === 0}
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
                className='px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none'
                onClick={() => requestSort('subtype')}
              >
                Tipo {renderSortIcon('subtype')}
              </th>
              {col('area') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell cursor-pointer hover:bg-muted/50 select-none'
                  onClick={() => requestSort('familyName')}
                >
                  Área {renderSortIcon('familyName')}
                </th>
              )}
              <th
                className='px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 select-none'
                onClick={() => requestSort('name')}
              >
                Nombre {renderSortIcon('name')}
              </th>
              {col('codigo') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell cursor-pointer hover:bg-muted/50 select-none'
                  onClick={() => requestSort('code')}
                >
                  Código {renderSortIcon('code')}
                </th>
              )}
              {col('estado') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 select-none'
                  onClick={() => requestSort('status')}
                >
                  Estado {renderSortIcon('status')}
                </th>
              )}
              {col('condicion') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 select-none'
                  onClick={() => requestSort('condition')}
                >
                  Condición {renderSortIcon('condition')}
                </th>
              )}
              {col('propiedad') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 select-none'
                  onClick={() => requestSort('acquisitionMode')}
                >
                  Propiedad {renderSortIcon('acquisitionMode')}
                </th>
              )}
              {col('creado') && (
                <th
                  className='px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell cursor-pointer hover:bg-muted/50 select-none'
                  onClick={() => requestSort('createdAt')}
                >
                  Creado {renderSortIcon('createdAt')}
                </th>
              )}
              {col('fechaCompra') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none whitespace-nowrap'>
                  F. Compra
                </th>
              )}
              {col('factura') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none whitespace-nowrap'>
                  N° Factura
                </th>
              )}
              {col('ordenCompra') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none whitespace-nowrap'>
                  N° OC
                </th>
              )}
              {col('atributos') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none'>
                  Atributos
                </th>
              )}
              {col('accesorios') && (
                <th className='px-4 py-3 text-left font-medium text-muted-foreground hidden xl:table-cell select-none'>
                  Accesorios
                </th>
              )}
            </tr>
          </thead>
          <tbody className='divide-y divide-border bg-card'>
            {loading ? (
              <tr>
                <td colSpan={colCount} className='px-4 py-10 text-center text-muted-foreground'>
                  <div className='flex items-center justify-center gap-2'>
                    <div className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
                    Cargando…
                  </div>
                </td>
              </tr>
            ) : sortedAssets.length === 0 ? (
              <tr>
                <td colSpan={colCount} className='px-4 py-10 text-center text-muted-foreground'>
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
                  {col('atributos') && (
                    <td
                      className='px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell max-w-[180px] truncate'
                      title={asset.attributes ?? ''}
                    >
                      {asset.attributes || '—'}
                    </td>
                  )}
                  {col('accesorios') && (
                    <td
                      className='px-4 py-3 text-muted-foreground text-xs hidden xl:table-cell max-w-[180px] truncate'
                      title={asset.accessories ?? ''}
                    >
                      {asset.accessories || '—'}
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
