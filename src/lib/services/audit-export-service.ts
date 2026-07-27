/**
 * Servicio de Exportación de Auditoría
 * Reutiliza ExportService para mantener consistencia
 */

import {
  translateRole,
  translateAction,
  translateEntityType,
  detectDeviceType,
  detectBrowser,
  detectOS,
  determineSeverity,
  getAuditCategory,
  extractChanges,
  extractMetadata,
  requiresReview,
  getDateRange,
  getFilterSuffix,
  getActiveFilters,
  getTopActions,
  getTopUsers,
  getTopEntities,
  buildSimpleDescription,
  buildSimpleChanges,
  escapeCsv,
  buildActionDescription,
  buildChangesDescription,
} from './audit-export-helpers'
import { getAppTimezone } from '@/lib/utils/date-utils'

export interface AuditExportOptions {
  format: 'csv' | 'json'
  includeHeaders: boolean
  includeMetadata: boolean
  filename?: string
}

export class AuditExportService {
  private static readonly EXPORT_LIMITS = {
    csv: 100000,
    json: 50000,
  }

  static async exportAuditLogs(
    logs: any[],
    filters: any,
    options: AuditExportOptions
  ): Promise<{ content: string; filename: string; contentType: string; warnings?: string[] }> {
    const warnings: string[] = []
    const recordCount = logs.length
    const limit = this.EXPORT_LIMITS[options.format]

    if (recordCount > limit) {
      warnings.push(
        `⚠️ Archivo grande: ${recordCount} registros exceden el límite recomendado de ${limit.toLocaleString()} para formato ${options.format.toUpperCase()}`
      )
      warnings.push(
        `💡 Recomendación: Use filtros más específicos (fecha, módulo, usuario) para reducir el volumen`
      )
    }

    const estimatedSizeMB = this.estimateFileSizeMB(recordCount, options.format)
    if (estimatedSizeMB > 100) {
      warnings.push(`⚠️ Archivo muy grande: Tamaño estimado ${estimatedSizeMB.toFixed(1)}MB`)
      warnings.push(`💡 Considere exportar por períodos más cortos o filtrar por módulo específico`)
    }

    console.log(
      `📤 AuditExportService - Exportando ${recordCount.toLocaleString()} registros (${estimatedSizeMB.toFixed(1)}MB estimado)`
    )

    const timestamp = new Date().toISOString().split('T')[0]
    const filterSuffix = getFilterSuffix(filters)
    const filename = options.filename || `audit-logs-${timestamp}${filterSuffix}`

    try {
      switch (options.format) {
        case 'csv':
          return {
            content: this.generateCSV(logs, options),
            filename: `${filename}.csv`,
            contentType: 'text/csv; charset=utf-8',
            warnings,
          }
        case 'json':
          return {
            content: this.generateJSON(logs, filters, options),
            filename: `${filename}.json`,
            contentType: 'application/json',
            warnings,
          }
        default:
          throw new Error(`Formato no soportado: ${options.format}`)
      }
    } catch (error) {
      console.error('❌ Error en exportación de auditoría:', error)
      throw new Error(
        `Error al generar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`
      )
    }
  }

  private static estimateFileSizeMB(recordCount: number, format: string): number {
    const bytesPerRecord = {
      csv: 1500,
      json: 2500,
    }

    const bytes = (bytesPerRecord[format as keyof typeof bytesPerRecord] || 1500) * recordCount
    return bytes / (1024 * 1024)
  }

  private static generateCSV(logs: any[], options: AuditExportOptions): string {
    let csv = '\uFEFF'

    if (options.includeMetadata) {
      const now = new Date()
      csv += `# REGISTRO DE AUDITORÍA DEL SISTEMA\n`
      csv += `# Generado: ${now.toLocaleString('es-ES', { timeZone: getAppTimezone() })}\n`
      csv += `# Total de Registros: ${logs.length.toLocaleString()}\n`
      csv += `# Período: ${getDateRange(logs)}\n`
      csv += `\n`
    }

    if (options.includeHeaders) {
      csv +=
        [
          'Fecha',
          'Hora',
          'Acción',
          'Módulo',
          'Usuario',
          'Email',
          'Rol',
          'Descripción',
          'Cambios',
          'IP',
          'Dispositivo',
        ].join(',') + '\n'
    }

    logs.forEach((log: any) => {
      const date = new Date(log.createdAt)
      const details = log.details || {}

      const fecha = date.toLocaleDateString('es-EC', { timeZone: getAppTimezone() })
      const hora = date.toLocaleTimeString('es-EC', {
        timeZone: getAppTimezone(),
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      const accion = translateAction(log.action)
      const modulo = translateEntityType(log.entityType)
      const usuario = log.users?.name || 'Sistema'
      const email = log.users?.email || ''
      const rol = translateRole(log.users?.role || 'SYSTEM')
      const descripcion = buildSimpleDescription(log, details)
      const cambios = buildSimpleChanges(details)
      const ip = log.ipAddress && log.ipAddress !== 'Unknown' ? log.ipAddress : ''
      const dispositivo = detectDeviceType(log.userAgent)

      const row = [
        fecha,
        hora,
        `"${escapeCsv(accion)}"`,
        `"${escapeCsv(modulo)}"`,
        `"${escapeCsv(usuario)}"`,
        email,
        rol,
        `"${escapeCsv(descripcion)}"`,
        `"${escapeCsv(cambios)}"`,
        ip,
        dispositivo,
      ]
      csv += row.join(',') + '\n'
    })

    return csv
  }

  private static generateJSON(logs: any[], filters: any, options: AuditExportOptions): string {
    const exportData = {
      metadata: options.includeMetadata
        ? {
            reportType: 'audit_logs',
            generatedAt: new Date().toISOString(),
            generatedBy: 'Sistema de Auditoría',
            filters: getActiveFilters(filters),
            recordCount: logs.length,
            dateRange: getDateRange(logs),
            version: '2.0',
            exportFormat: 'json',
            systemInfo: {
              environment: process.env.NODE_ENV || 'production',
              version: '1.0.0',
            },
          }
        : undefined,
      summary: {
        totalRecords: logs.length,
        uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
        uniqueActions: new Set(logs.map(l => l.action)).size,
        uniqueEntities: new Set(logs.map(l => l.entityType)).size,
        dateRange: getDateRange(logs),
        topActions: getTopActions(logs, 5),
        topUsers: getTopUsers(logs, 5),
        topEntities: getTopEntities(logs, 5),
        criticalEvents: logs.filter(l => determineSeverity(l.action, l.entityType) === 'CRITICAL')
          .length,
        errorEvents: logs.filter(l => l.result === 'ERROR').length,
      },
      logs: logs.map(log => ({
        ...log,
        createdAt: log.createdAt,
        actionTranslated: translateAction(log.action),
        entityTypeTranslated: translateEntityType(log.entityType),
        browserInfo: detectBrowser(log.userAgent),
        osInfo: detectOS(log.userAgent),
        severity: determineSeverity(log.action, log.entityType),
        category: getAuditCategory(log.action, log.entityType),
        requiresReview: requiresReview(log),
        changes: extractChanges(log.details || {}),
        metadata: extractMetadata(log.details || {}),
      })),
    }

    return JSON.stringify(exportData, null, 2)
  }
}
