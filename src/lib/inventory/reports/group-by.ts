import { formatCurrency } from '@/lib/inventory/report-format'
import type { ReportColumnDef, ReportRunParams } from './types'

const ALL_GROUP = 'all'

/** Fila interna con valores de agrupación y campos numéricos para sumar. */
export interface GroupableRow {
  groupValues: Record<string, string>
  sums: Record<string, number>
}

export interface GroupByFieldDef {
  key: string
  label: string
}

export interface GroupBySumDef {
  key: string
  label: string
  format?: 'currency' | 'number'
}

export interface DatasetGroupByConfig {
  fields: GroupByFieldDef[]
  sums: GroupBySumDef[]
}

export const GROUPED_COLUMN_DEFS: ReportColumnDef[] = [
  { key: 'grupo', label: 'Grupo', defaultVisible: true },
  { key: 'cantidad', label: 'Cantidad', defaultVisible: true },
]

export const DATASET_GROUP_BY: Record<string, DatasetGroupByConfig> = {
  equipment: {
    fields: [
      { key: 'familia', label: 'Familia' },
      { key: 'estado', label: 'Estado' },
      { key: 'modalidad', label: 'Modalidad' },
      { key: 'tipo', label: 'Tipo de equipo' },
      { key: 'mesCompra', label: 'Mes de compra' },
    ],
    sums: [
      { key: 'valorCompra', label: 'Valor compra', format: 'currency' },
      { key: 'rentaMensual', label: 'Renta mensual', format: 'currency' },
    ],
  },
  licenses: {
    fields: [
      { key: 'familia', label: 'Familia' },
      { key: 'tipo', label: 'Tipo de licencia' },
      { key: 'mesVencimiento', label: 'Mes de vencimiento' },
    ],
    sums: [
      { key: 'costo', label: 'Costo total', format: 'currency' },
      { key: 'renovacion', label: 'Renovación total', format: 'currency' },
    ],
  },
  consumables: {
    fields: [
      { key: 'familia', label: 'Familia' },
      { key: 'estado', label: 'Estado' },
    ],
    sums: [{ key: 'valorStock', label: 'Valor en stock', format: 'currency' }],
  },
  contracts: {
    fields: [
      { key: 'familia', label: 'Familia' },
      { key: 'estado', label: 'Estado' },
      { key: 'categoria', label: 'Categoría' },
    ],
    sums: [{ key: 'costoMensual', label: 'Costo mensual total', format: 'currency' }],
  },
  assignments: {
    fields: [
      { key: 'familia', label: 'Familia' },
      { key: 'departamento', label: 'Departamento' },
    ],
    sums: [],
  },
  maintenance: {
    fields: [
      { key: 'estado', label: 'Estado' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'mes', label: 'Mes' },
      { key: 'familia', label: 'Familia' },
    ],
    sums: [{ key: 'costo', label: 'Costo total', format: 'currency' }],
  },
  sales: {
    fields: [
      { key: 'estado', label: 'Estado' },
      { key: 'mes', label: 'Mes de venta' },
    ],
    sums: [
      { key: 'precioVenta', label: 'Precio venta total', format: 'currency' },
      { key: 'resultado', label: 'Resultado neto', format: 'currency' },
    ],
  },
  rentals: {
    fields: [
      { key: 'familia', label: 'Familia' },
      { key: 'mesFin', label: 'Mes fin contrato' },
    ],
    sums: [{ key: 'rentaMensual', label: 'Renta mensual total', format: 'currency' }],
  },
}

export function getDatasetGroupByConfig(datasetId: string): DatasetGroupByConfig | undefined {
  return DATASET_GROUP_BY[datasetId]
}

export function isGroupByActive(params: ReportRunParams): boolean {
  const groupBy = params.groupBy ? String(params.groupBy) : ''
  return !!groupBy && groupBy !== ALL_GROUP && groupBy !== 'none'
}

export function getGroupedColumnDefs(datasetId: string): ReportColumnDef[] {
  const config = getDatasetGroupByConfig(datasetId)
  if (!config) return GROUPED_COLUMN_DEFS
  const cols: ReportColumnDef[] = [
    { key: 'grupo', label: 'Grupo', defaultVisible: true },
    { key: 'cantidad', label: 'Cantidad', defaultVisible: true },
  ]
  for (const sum of config.sums) {
    cols.push({ key: sum.key, label: sum.label, defaultVisible: true })
  }
  return cols
}

export function aggregateGroupableRows(
  rows: GroupableRow[],
  groupByKey: string,
  config: DatasetGroupByConfig
): Record<string, unknown>[] {
  const field = config.fields.find(f => f.key === groupByKey)
  if (!field) return []

  const buckets = new Map<string, { count: number; sums: Record<string, number> }>()

  for (const row of rows) {
    const groupLabel = row.groupValues[groupByKey] || '—'
    const existing = buckets.get(groupLabel) ?? {
      count: 0,
      sums: Object.fromEntries(config.sums.map(s => [s.key, 0])),
    }
    existing.count += 1
    for (const sum of config.sums) {
      existing.sums[sum.key] = (existing.sums[sum.key] ?? 0) + (row.sums[sum.key] ?? 0)
    }
    buckets.set(groupLabel, existing)
  }

  return Array.from(buckets.entries())
    .map(([grupo, agg]) => {
      const result: Record<string, unknown> = {
        grupo,
        cantidad: agg.count,
      }
      for (const sum of config.sums) {
        const value = agg.sums[sum.key] ?? 0
        result[sum.key] =
          sum.format === 'currency' ? formatCurrency(value) : value
      }
      return result
    })
    .sort((a, b) => Number(b.cantidad) - Number(a.cantidad))
}

export function monthKey(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toISOString().slice(0, 7)
}

export function buildGroupedDatasetResponse(
  datasetId: string,
  groupedRows: Record<string, unknown>[],
  params: ReportRunParams,
  groupByKey: string
) {
  const { page, limit, skip } = parseGroupedPagination(params)
  const total = groupedRows.length
  const pageRows = groupedRows.slice(skip, skip + limit)
  const config = getDatasetGroupByConfig(datasetId)
  const fieldLabel = config?.fields.find(f => f.key === groupByKey)?.label ?? groupByKey

  return {
    summary: [
      {
        title: 'Grupos',
        value: total,
        description: `Agrupado por ${fieldLabel}`,
      },
      {
        title: 'Registros totales',
        value: groupedRows.reduce((s, r) => s + Number(r.cantidad ?? 0), 0),
        description: 'Suma de cantidades en todos los grupos',
      },
    ],
    data: pageRows,
    filters: { ...params, dataset: datasetId, groupBy: groupByKey },
    generatedAt: new Date().toISOString(),
    totalCount: total,
    meta: {
      dataset: datasetId,
      page,
      limit,
      groupBy: groupByKey,
      grouped: true,
    },
  }
}

function parseGroupedPagination(params: ReportRunParams) {
  const page = Math.max(1, parseInt(String(params.page ?? 1), 10) || 1)
  const limit = Math.min(500, Math.max(1, parseInt(String(params.limit ?? 100), 10) || 100))
  return { page, limit, skip: (page - 1) * limit }
}

/** Opciones de filtro groupBy para el catálogo (select). */
export function buildGroupByFilterOptions(datasetId: string) {
  const config = getDatasetGroupByConfig(datasetId)
  if (!config) return null
  return {
    key: 'groupBy',
    label: 'Agrupar por',
    type: 'select' as const,
    defaultValue: ALL_GROUP,
    options: [
      { value: ALL_GROUP, label: 'Sin agrupar (detalle)' },
      ...config.fields.map(f => ({ value: f.key, label: f.label })),
    ],
  }
}

export const GROUP_BY_ROW_LIMIT = 5000
