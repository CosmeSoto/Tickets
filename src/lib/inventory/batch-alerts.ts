import type { BatchMetrics } from '@/types/inventory/batch-inventory'

export type BatchAlertLevel = 'info' | 'warning' | 'critical'

export interface BatchUtilizationAlert {
  level: BatchAlertLevel
  title: string
  message: string
}

/**
 * Genera alertas operativas para un lote según métricas en tiempo real.
 */
export function getBatchUtilizationAlerts(
  metrics: BatchMetrics,
  options?: { lowStockThresholdPct?: number }
): BatchUtilizationAlert[] {
  const alerts: BatchUtilizationAlert[] = []
  if (metrics.total <= 0) return alerts

  const pct = options?.lowStockThresholdPct ?? 15
  const lowStockThreshold = Math.max(1, Math.ceil(metrics.total * (pct / 100)))

  if (metrics.available === 0) {
    alerts.push({
      level: 'critical',
      title: 'Sin unidades disponibles',
      message: `Las ${metrics.total} unidades del lote están asignadas, en mantenimiento o dadas de baja.`,
    })
  } else if (metrics.available <= lowStockThreshold) {
    alerts.push({
      level: 'warning',
      title: 'Stock bajo en el lote',
      message: `Quedan ${metrics.available} disponible(s) de ${metrics.total} unidades.`,
    })
  }

  if (metrics.utilizationRate >= 95) {
    alerts.push({
      level: 'critical',
      title: 'Utilización crítica',
      message: `${metrics.utilizationRate.toFixed(0)}% del lote está asignado — considera una nueva compra.`,
    })
  } else if (metrics.utilizationRate >= 80) {
    alerts.push({
      level: 'warning',
      title: 'Alta utilización',
      message: `${metrics.utilizationRate.toFixed(0)}% del lote está asignado.`,
    })
  }

  if (metrics.maintenance > 0 && metrics.maintenance >= Math.ceil(metrics.total * 0.2)) {
    alerts.push({
      level: 'info',
      title: 'Mantenimientos activos',
      message: `${metrics.maintenance} equipo(s) del lote están en mantenimiento.`,
    })
  }

  return alerts
}
