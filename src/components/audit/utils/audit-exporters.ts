/**
 * Export utilities for Audit module
 * Handles CSV and JSON exports
 */

import type { AuditFilters } from './audit-types'

/**
 * Export audit logs to CSV or JSON
 */
export async function exportAuditReport(
  format: 'csv' | 'json',
  filters: AuditFilters,
  onSuccess: (message: string) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch('/api/admin/audit/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format,
        includeHeaders: true,
        includeMetadata: true,
        filters: {
          ...filters,
          limit: 50000, // Límite de seguridad
          offset: 0,
        },
      }),
    })

    if (response.ok) {
      // Obtener advertencias del header
      const warnings = response.headers.get('X-Warnings')
      const totalRecords = response.headers.get('X-Total-Records')
      const exportedRecords = response.headers.get('X-Exported-Records')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // Obtener nombre del archivo del header Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
      const filename = filenameMatch
        ? filenameMatch[1]
        : `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`

      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Construir mensaje de éxito
      let message = `✅ ${exportedRecords || 0} registros exportados`
      if (totalRecords && exportedRecords && totalRecords !== exportedRecords) {
        message += ` de ${totalRecords} total`
      }
      if (warnings && JSON.parse(warnings).length > 0) {
        message += `\n⚠️ Advertencias: ${JSON.parse(warnings).join(', ')}`
      }

      onSuccess(message)
    } else {
      const error = await response.json()
      throw new Error(error.details || error.error || 'Error desconocido')
    }
  } catch (error) {
    console.error('Error en exportación:', error)
    onError(error instanceof Error ? error.message : 'No se pudo exportar el reporte')
  }
}
