import { getDatasetGroupByConfig } from './group-by'

export interface ChartMetricOption {
  key: string
  label: string
}

export interface GroupChartPoint {
  name: string
  fullName: string
  value: number
}

/** Convierte valores de celdas agrupadas (número o moneda formateada) a número. */
export function parseGroupedMetricValue(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '')
    const parsed = parseFloat(cleaned)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export function truncateChartLabel(label: string, max = 18): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

export function getGroupedChartMetrics(
  datasetId: string,
  sampleRow?: Record<string, unknown>
): ChartMetricOption[] {
  const metrics: ChartMetricOption[] = [{ key: 'cantidad', label: 'Cantidad' }]
  const config = getDatasetGroupByConfig(datasetId)
  if (config) {
    for (const sum of config.sums) {
      metrics.push({ key: sum.key, label: sum.label })
    }
  } else if (sampleRow) {
    for (const key of Object.keys(sampleRow)) {
      if (key !== 'grupo' && key !== 'cantidad') {
        metrics.push({ key, label: key })
      }
    }
  }
  return metrics
}

export function buildGroupChartPoints(
  rows: Record<string, unknown>[],
  metricKey: string,
  limit = 12
): GroupChartPoint[] {
  return rows.slice(0, limit).map(row => {
    const fullName = String(row.grupo ?? '—')
    return {
      name: truncateChartLabel(fullName),
      fullName,
      value: parseGroupedMetricValue(row[metricKey]),
    }
  })
}

export function formatChartMetricValue(value: number, metricKey: string, datasetId: string): string {
  const config = getDatasetGroupByConfig(datasetId)
  const sumDef = config?.sums.find(s => s.key === metricKey)
  if (sumDef?.format === 'currency') {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(value)
  }
  return value.toLocaleString('es-EC')
}
