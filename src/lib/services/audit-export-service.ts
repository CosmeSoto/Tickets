/**
 * Servicio de Exportación de Auditoría
 * Reutiliza ExportService para mantener consistencia
 */

import {
  translateAction,
  translateEntityType,
  translateRole,
  translateSeverity,
  determineSeverity,
  getDateRange,
  getFilterSuffix,
  getActiveFilters,
  escapeCsv,
  getAuditCategory,
} from './audit-export-helpers'
import { getAppTimezone } from '@/lib/utils/date-utils'
import {
  getAffectedObjectLabel,
  getEventCode,
} from '@/components/audit/utils/audit-affected-object'

export interface AuditExportOptions {
  format: 'csv' | 'json' | 'rows'
  includeHeaders: boolean
  includeMetadata: boolean
  filename?: string
  /** Keys de columnas a exportar */
  columns?: string[]
  /** Permitir columnas sensibles (email, IP, cambios, UA) */
  includeSensitive?: boolean
  /** Enmascarar PII en columnas sensibles (default true) */
  maskPii?: boolean
}

export class AuditExportService {
  private static readonly EXPORT_LIMITS = {
    csv: 100000,
    json: 50000,
    rows: 100000,
  }

  static async exportAuditLogs(
    logs: any[],
    filters: any,
    options: AuditExportOptions
  ): Promise<{
    content: string
    filename: string
    contentType: string
    warnings?: string[]
    rows?: Record<string, string>[]
    columnKeys?: string[]
  }> {
    const warnings: string[] = []
    const recordCount = logs.length
    const limit = this.EXPORT_LIMITS[options.format] ?? 50000

    if (recordCount > limit) {
      warnings.push(
        `Archivo grande: ${recordCount} registros exceden el límite recomendado de ${limit.toLocaleString()} para ${options.format.toUpperCase()}`
      )
    }

    const {
      resolveAuditExportKeys,
      buildAuditExportColumns,
      flattenAuditRows,
      AUDIT_COLUMN_CATALOG,
    } = await import('@/components/audit/utils/audit-export-columns')

    const includeSensitive = options.includeSensitive === true
    const maskPii = options.maskPii !== false
    const columnKeys = resolveAuditExportKeys(options.columns, includeSensitive)
    const exportColumns = buildAuditExportColumns(columnKeys, { maskPii })
    const flatRows = flattenAuditRows(logs, columnKeys, { maskPii })

    if (!includeSensitive) {
      warnings.push(
        'LOPDP: exportación con minimizacion de datos (sin email/IP/cambios/UA). Active "Incluir datos sensibles" si los necesita.'
      )
    } else if (maskPii) {
      warnings.push(
        'LOPDP: datos sensibles incluidos con enmascaramiento (email/IP parcialmente ocultos).'
      )
    } else {
      warnings.push('LOPDP: datos sensibles en claro. Trate el archivo como confidencial.')
    }

    const timestamp = new Date().toISOString().split('T')[0]
    const filterSuffix = getFilterSuffix(filters)
    const filename = options.filename || `audit-logs-${timestamp}${filterSuffix}`

    try {
      switch (options.format) {
        case 'csv':
          return {
            content: this.generateCSVFromColumns(
              flatRows,
              exportColumns.map(column => ({
                key: column.key!,
                header: column.header ?? column.key!,
              })),
              options,
              logs.length
            ),
            filename: `${filename}.csv`,
            contentType: 'text/csv; charset=utf-8',
            warnings,
            columnKeys,
          }
        case 'rows':
          return {
            content: JSON.stringify({
              columns: columnKeys.map(k => ({
                key: k,
                header: AUDIT_COLUMN_CATALOG.find(c => c.key === k)?.label || k,
              })),
              rows: flatRows,
              lopdp: { includeSensitive, maskPii },
            }),
            filename: `${filename}.json`,
            contentType: 'application/json',
            warnings,
            rows: flatRows,
            columnKeys,
          }
        case 'json':
          return {
            content: this.generateJSON(
              logs,
              filters,
              options,
              includeSensitive,
              maskPii,
              columnKeys
            ),
            filename: `${filename}.json`,
            contentType: 'application/json',
            warnings,
            columnKeys,
          }
        default:
          throw new Error(`Formato no soportado: ${options.format}`)
      }
    } catch (error) {
      console.error('Error en exportación de auditoría:', error)
      throw new Error(
        `Error al generar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`
      )
    }
  }

  private static generateCSVFromColumns(
    rows: Record<string, string>[],
    columns: { key: string; header: string }[],
    options: AuditExportOptions,
    total: number
  ): string {
    let csv = '\uFEFF'

    if (options.includeMetadata) {
      const now = new Date()
      csv += `# REGISTRO DE AUDITORÍA DEL SISTEMA\n`
      csv += `# Generado: ${now.toLocaleString('es-ES', { timeZone: getAppTimezone() })}\n`
      csv += `# Total de Registros: ${total.toLocaleString()}\n`
      csv += `# Columnas: ${columns.map(c => c.header).join(' | ')}\n`
      csv += `# LOPDP: ${options.includeSensitive ? (options.maskPii !== false ? 'sensibles enmascarados' : 'sensibles en claro') : 'minimización'}\n`
      csv += `\n`
    }

    if (options.includeHeaders) {
      csv += columns.map(c => `"${escapeCsv(c.header)}"`).join(',') + '\n'
    }

    for (const row of rows) {
      csv += columns.map(c => `"${escapeCsv(String(row[c.key] ?? ''))}"`).join(',') + '\n'
    }

    return csv
  }

  private static formatJsonDateTime(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value)
    return d.toLocaleString('es-EC', {
      timeZone: getAppTimezone(),
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  private static translateFiltersForJson(filters: any): Record<string, string> {
    const active = getActiveFilters(filters)
    const out: Record<string, string> = {}
    const labels: Record<string, string> = {
      days: 'Período (días)',
      search: 'Búsqueda',
      action: 'Acción',
      entityType: 'Módulo',
      familyId: 'Área / familia',
      userId: 'Usuario',
      configModule: 'Config. por módulo',
      actionPreset: 'Preset',
      limit: 'Límite',
      offset: 'Desplazamiento',
    }
    for (const [key, value] of Object.entries(active)) {
      if (key === 'entityType' && value === 'all') continue
      const label = labels[key] || key
      if (key === 'entityType') {
        out[label] = translateEntityType(String(value))
      } else {
        out[label] = String(value)
      }
    }
    return out
  }

  private static columnLabelsEs(keys: string[]): string[] {
    const map: Record<string, string> = {
      fecha: 'Fecha',
      hora: 'Hora',
      action: 'Acción',
      entityType: 'Módulo',
      usuario: 'Usuario',
      rol: 'Rol',
      descripcion: 'Descripción',
      severity: 'Severidad',
      entityId: 'Objeto afectado',
      id: 'Código del evento',
      dispositivo: 'Dispositivo',
      navegador: 'Navegador',
      email: 'Email',
      ip: 'IP',
      cambios: 'Cambios',
      userAgent: 'User-Agent',
    }
    return keys.map(k => map[k] || k)
  }

  private static generateJSON(
    logs: any[],
    filters: any,
    options: AuditExportOptions,
    includeSensitive: boolean,
    maskPii: boolean,
    columnKeys: string[]
  ): string {
    const exportData = {
      metadatos: options.includeMetadata
        ? {
            tipoReporte: 'Logs de auditoría',
            generadoEn: this.formatJsonDateTime(new Date()),
            filtros: this.translateFiltersForJson(filters),
            totalRegistros: logs.length,
            rangoFechas: getDateRange(logs),
            version: '3.1',
            columnas: this.columnLabelsEs(columnKeys),
            lopdp: {
              incluyeDatosSensibles: includeSensitive,
              datosEnmascarados: maskPii,
              exportacionInternaSinMascara: includeSensitive && !maskPii,
            },
          }
        : undefined,
      resumen: {
        totalRegistros: logs.length,
        usuariosUnicos: new Set(logs.map(l => l.userId).filter(Boolean)).size,
        accionesUnicas: new Set(logs.map(l => l.action)).size,
        eventosCriticos: logs.filter(l => determineSeverity(l.action, l.entityType) === 'CRITICAL')
          .length,
      },
      registros: includeSensitive
        ? logs.map(log => {
            const severity = determineSeverity(log.action, log.entityType)
            return {
              codigoEvento: getEventCode(log.id),
              fechaHora: this.formatJsonDateTime(log.createdAt),
              accion: translateAction(log.action),
              modulo: translateEntityType(log.entityType),
              objetoAfectado: getAffectedObjectLabel(log),
              usuario: log.users?.name || 'Sistema',
              email: log.users
                ? maskPii
                  ? String(log.users.email || '').replace(/^(.{0,2}).*(@.*)$/, '$1***$2')
                  : log.users.email
                : null,
              rol: log.users?.role ? translateRole(log.users.role) : 'Sistema',
              severidad: translateSeverity(severity),
              categoria: getAuditCategory(log.action, log.entityType),
              ip:
                maskPii && log.ipAddress
                  ? String(log.ipAddress).replace(/\.\d+$/, '.***')
                  : log.ipAddress || null,
              userAgent: maskPii ? undefined : log.userAgent || null,
              detalles: maskPii
                ? { nota: 'Detalle omitido o reducido (datos enmascarados)' }
                : log.details,
            }
          })
        : logs.map(log => {
            const severity = determineSeverity(log.action, log.entityType)
            return {
              codigoEvento: getEventCode(log.id),
              fechaHora: this.formatJsonDateTime(log.createdAt),
              accion: translateAction(log.action),
              modulo: translateEntityType(log.entityType),
              usuario: log.users?.name || 'Sistema',
              rol: log.users?.role ? translateRole(log.users.role) : 'Sistema',
              severidad: translateSeverity(severity),
            }
          }),
    }

    return JSON.stringify(exportData, null, 2)
  }
}
