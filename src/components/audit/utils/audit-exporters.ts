/**
 * Export utilities for Audit module — CSV, Excel (vía rows), JSON técnico.
 */

import { exportToExcel, exportToPDF } from '@/lib/utils/export'
import type { AuditFilters } from './audit-types'
import { buildAuditExportColumns } from './audit-export-columns'

export type AuditExportFormat = 'csv' | 'json' | 'excel' | 'pdf'

export interface AuditExportClientOptions {
  columns: string[]
  includeSensitive: boolean
  maskPii?: boolean
}

async function postExport(
  format: 'csv' | 'json' | 'rows',
  filters: AuditFilters,
  opts: AuditExportClientOptions
) {
  return fetch('/api/admin/audit/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format,
      includeHeaders: true,
      includeMetadata: format !== 'rows',
      columns: opts.columns,
      includeSensitive: opts.includeSensitive,
      maskPii: opts.maskPii !== false,
      filters: {
        ...filters,
        limit: 50000,
        offset: 0,
      },
    }),
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  if (a.parentNode) a.parentNode.removeChild(a)
}

function parseWarningsHeader(raw: string | null): string[] {
  if (!raw) return []
  try {
    const decoded = decodeURIComponent(raw)
    const parsed = JSON.parse(decoded) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    try {
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
}

function appendWarnings(message: string, warnings: string[]): string {
  if (!warnings.length) return message
  return `${message}\n${warnings[0]}`
}

/**
 * Export audit logs according to selected columns and LOPDP options.
 */
export async function exportAuditReport(
  format: AuditExportFormat,
  filters: AuditFilters,
  opts: AuditExportClientOptions,
  onSuccess: (message: string) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    if (format === 'excel' || format === 'pdf') {
      const response = await postExport('rows', filters, opts)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.details || error.error || 'Error desconocido')
      }
      const data = await response.json()
      const columnKeys: string[] = (data.columns || []).map((c: { key: string }) => c.key)
      const rows: Record<string, string>[] = data.rows || []
      const exportColumns = buildAuditExportColumns(columnKeys, {
        maskPii: opts.maskPii !== false,
      }).map(c => ({
        ...c,
        // Filas ya aplanadas: accessor lee por key
        accessor: (row: any) => row[c.key] ?? '',
      }))

      if (rows.length === 0) {
        throw new Error('No hay registros para exportar con los filtros actuales')
      }

      const date = new Date().toISOString().split('T')[0]
      const filename = `audit-logs-${date}`
      const warnings = parseWarningsHeader(response.headers.get('X-Warnings'))
      const exportedRecords = response.headers.get('X-Exported-Records') || String(rows.length)

      if (format === 'excel') {
        await exportToExcel({
          filename,
          title: 'Registro de Auditoría',
          subtitle: `LOPDP · ${opts.includeSensitive ? 'con datos sensibles' : 'minimizado'} · ${rows.length} registros`,
          columns: exportColumns,
          rows,
        })
      } else {
        exportToPDF({
          filename,
          title: 'Registro de Auditoría',
          subtitle: `LOPDP · ${opts.includeSensitive ? 'con datos sensibles' : 'minimizado'} · ${rows.length} registros`,
          columns: exportColumns,
          rows,
        })
      }

      onSuccess(
        appendWarnings(`${exportedRecords} registros exportados (${format.toUpperCase()})`, warnings)
      )
      return
    }

    const response = await postExport(format, filters, opts)
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.details || error.error || 'Error desconocido')
    }

    const warnings = parseWarningsHeader(response.headers.get('X-Warnings'))
    const totalRecords = response.headers.get('X-Total-Records')
    const exportedRecords = response.headers.get('X-Exported-Records')

    const blob = await response.blob()
    const contentDisposition = response.headers.get('Content-Disposition')
    const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
    const filename = filenameMatch
      ? filenameMatch[1]
      : `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`

    downloadBlob(blob, filename)

    let message = `${exportedRecords || 0} registros exportados`
    if (totalRecords && exportedRecords && totalRecords !== exportedRecords) {
      message += ` de ${totalRecords} total`
    }
    onSuccess(appendWarnings(message, warnings))
  } catch (error) {
    console.error('Error en exportación:', error)
    onError(error instanceof Error ? error.message : 'No se pudo exportar el reporte')
  }
}
