/**
 * Audit Filters Component
 * Handles all filter controls for audit logs
 */

import { Filter, Search, Download } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableColumnsMenu } from '@/components/common/table-columns-menu'
import type { AuditFilters } from './utils/audit-types'
import type { Family } from '@/components/reports/utils/report-types'
import { AUDIT_CONFIG_MODULE_OPTIONS } from '@/lib/services/config-audit-filters'
import { AUDIT_QUICK_PRESETS } from '@/components/audit/utils/audit-filter-presets'
import {
  AUDIT_COLUMN_DEFS,
  DEFAULT_AUDIT_VISIBLE_COLUMNS,
  SENSITIVE_AUDIT_COLUMNS,
} from '@/components/audit/utils/audit-export-columns'

interface AuditFiltersProps {
  filters: AuditFilters
  families: Family[]
  hasActiveFilters: boolean
  activePresetId?: string | null
  loading: boolean
  exporting?: boolean
  columnOrder: string[]
  visibleColumns: string[]
  /** Solo JSON: incluir sensibles enmascarados (default true) */
  includeSensitive: boolean
  onColumnOrderChange: (order: string[]) => void
  onVisibleColumnsChange: (visible: string[]) => void
  onIncludeSensitiveChange: (value: boolean) => void
  onFilterChange: (key: keyof AuditFilters, value: string) => void
  onApplyPreset: (
    presetId: import('@/lib/services/config-audit-filters').AuditQuickPresetId
  ) => void
  onClearFilters: () => void
  onExportCSV: () => void
  onExportExcel: () => void
  onExportJSON: () => void
  /** JSON interno sin enmascarar (acceso discreto) */
  onExportJSONInternal?: () => void
  onExportPDF?: () => void
}

export function AuditFiltersComponent({
  filters,
  families,
  hasActiveFilters,
  activePresetId,
  loading,
  exporting,
  columnOrder,
  visibleColumns,
  includeSensitive,
  onColumnOrderChange,
  onVisibleColumnsChange,
  onIncludeSensitiveChange,
  onFilterChange,
  onApplyPreset,
  onClearFilters,
  onExportCSV,
  onExportExcel,
  onExportJSON,
  onExportJSONInternal,
  onExportPDF,
}: AuditFiltersProps) {
  const busy = loading || Boolean(exporting)
  // CSV/Excel/PDF: solo columnas no sensibles (LOPDP)
  const columnDefs = AUDIT_COLUMN_DEFS.filter(
    c => !SENSITIVE_AUDIT_COLUMNS.includes(c.key as never)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Filter className='h-5 w-5' />
          Filtros de Auditoría
        </CardTitle>
        <CardDescription>
          Filtra y exporta logs (máx. 50.000). Columnas y datos sensibles siguen minimización LOPDP.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <label className='text-sm font-medium text-muted-foreground'>Accesos rápidos</label>
          <div className='flex flex-wrap gap-2'>
            {AUDIT_QUICK_PRESETS.map(preset => (
              <Button
                key={preset.id}
                type='button'
                variant={activePresetId === preset.id ? 'default' : 'outline'}
                size='sm'
                className='h-8 text-xs'
                title={preset.description}
                onClick={() => onApplyPreset(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4'>
          <div className='space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-2'>
            <label className='text-sm font-medium'>Búsqueda</label>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
              <Input
                placeholder='Buscar en logs...'
                value={filters.search}
                onChange={e => onFilterChange('search', e.target.value)}
                className='pl-10'
              />
            </div>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Módulo</label>
            <Select value={filters.entityType} onValueChange={v => onFilterChange('entityType', v)}>
              <SelectTrigger>
                <SelectValue placeholder='Módulo' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los Módulos</SelectItem>
                <SelectItem value='ticket'>Tickets</SelectItem>
                <SelectItem value='user'>Usuarios</SelectItem>
                <SelectItem value='equipment'>Inventario</SelectItem>
                <SelectItem value='patrol'>Rondas</SelectItem>
                <SelectItem value='settings'>Configuración</SelectItem>
                <SelectItem value='system'>Sistema</SelectItem>
                <SelectItem value='backup'>Backups</SelectItem>
                <SelectItem value='credential_entry'>Credenciales</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Config. por módulo</label>
            <Select
              value={filters.configModule}
              onValueChange={v => onFilterChange('configModule', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Config' />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_CONFIG_MODULE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Período</label>
            <Select value={filters.days} onValueChange={v => onFilterChange('days', v)}>
              <SelectTrigger>
                <SelectValue placeholder='Período' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='1'>Último día</SelectItem>
                <SelectItem value='7'>Última semana</SelectItem>
                <SelectItem value='30'>Último mes</SelectItem>
                <SelectItem value='90'>Últimos 3 meses</SelectItem>
                <SelectItem value='365'>Último año</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Acción</label>
            <Input
              placeholder='Ej: created, updated...'
              value={filters.action}
              onChange={e => onFilterChange('action', e.target.value)}
            />
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Familia</label>
            <Select
              value={filters.familyId || 'all'}
              onValueChange={v => onFilterChange('familyId', v === 'all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder='Familia' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todas las familias</SelectItem>
                {families.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Exportación a ancho completo — evita que Columnas quede aplastado en el grid */}
        <div className='space-y-3 rounded-lg border bg-muted/20 p-3 sm:p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <p className='text-sm font-medium'>Exportar</p>
              <p className='text-xs text-muted-foreground'>
                LOPDP. JSON: opción de datos sensibles.
              </p>
            </div>
            <div className='flex flex-wrap gap-2 items-center'>
              <TableColumnsMenu
                columns={columnDefs}
                order={columnOrder}
                visible={visibleColumns}
                onOrderChange={onColumnOrderChange}
                onVisibleChange={onVisibleColumnsChange}
                storageKey='audit-export-columns-v1'
                defaultVisible={DEFAULT_AUDIT_VISIBLE_COLUMNS.filter(
                  k => !SENSITIVE_AUDIT_COLUMNS.includes(k as never)
                )}
              />
              <Button
                onClick={onExportCSV}
                variant='outline'
                size='sm'
                disabled={busy}
                className='min-h-9'
              >
                <Download className='h-4 w-4 mr-1' />
                CSV
              </Button>
              <Button
                onClick={onExportExcel}
                variant='outline'
                size='sm'
                disabled={busy}
                className='min-h-9'
              >
                <Download className='h-4 w-4 mr-1' />
                Excel
              </Button>
              {onExportPDF && (
                <Button
                  onClick={onExportPDF}
                  variant='outline'
                  size='sm'
                  disabled={busy}
                  className='min-h-9'
                >
                  <Download className='h-4 w-4 mr-1' />
                  PDF
                </Button>
              )}
              <div className='flex items-center gap-1.5 rounded-md border px-2 py-1'>
                <Button
                  onClick={e => {
                    if (e.shiftKey && onExportJSONInternal) {
                      onExportJSONInternal()
                      return
                    }
                    onExportJSON()
                  }}
                  variant='ghost'
                  size='sm'
                  disabled={busy}
                  className='min-h-8 h-8 text-xs px-2'
                  title='JSON. Shift+clic: exportación interna sin enmascarar'
                >
                  JSON
                </Button>
                <label className='flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none pr-1'>
                  <input
                    type='checkbox'
                    className='rounded border-input'
                    checked={includeSensitive}
                    onChange={e => onIncludeSensitiveChange(e.target.checked)}
                  />
                  Sensibles
                </label>
                {onExportJSONInternal ? (
                  <button
                    type='button'
                    disabled={busy}
                    onClick={onExportJSONInternal}
                    className='h-6 w-3 text-[10px] leading-none text-muted-foreground/30 hover:text-amber-600'
                    title='Exportación interna (PII en claro) — solo uso autorizado'
                    aria-label='Exportación interna sin enmascarar'
                  >
                    ·
                  </button>
                ) : null}
              </div>
              <Button onClick={onClearFilters} variant='outline' size='sm' className='min-h-9'>
                Limpiar
              </Button>
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className='mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg'>
            <div className='text-sm text-blue-800 dark:text-blue-200 break-words'>
              <strong>Filtros activos:</strong>
              {filters.search && ` Búsqueda: "${filters.search}"`}
              {filters.entityType !== 'all' && ` | Módulo: ${filters.entityType}`}
              {filters.configModule !== 'all' &&
                ` | Config: ${AUDIT_CONFIG_MODULE_OPTIONS.find(o => o.value === filters.configModule)?.label ?? filters.configModule}`}
              {filters.actionPreset &&
                ` | Preset: ${filters.actionPreset === 'critical' ? 'Críticas' : filters.actionPreset === 'security' ? 'Seguridad' : filters.actionPreset}`}
              {filters.action && ` | Acción: "${filters.action}"`}
              {filters.familyId && ` | Familia filtrada`}
              {filters.days !== '30' && ` | Período: ${filters.days} días`}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
