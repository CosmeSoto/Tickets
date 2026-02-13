/**
 * Servicio de Auditoría y Logs - SISTEMA COMPLETO
 * Registra todas las acciones importantes del sistema para compliance y auditorías
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface AuditLogData {
  action: string
  entityType: 'ticket' | 'user' | 'category' | 'department' | 'comment' | 'attachment' | 'system' | 'report' | 'settings' | 'technician' | 'assignment'
  entityId?: string
  userId: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  oldValues?: Record<string, any> // Para cambios
  newValues?: Record<string, any> // Para cambios
}

export interface AuditLogFilter {
  userId?: string
  entityType?: string
  entityId?: string
  action?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
  search?: string
}

export interface AuditExportOptions {
  format: 'csv' | 'json' | 'excel'
  filters: AuditLogFilter
  includeDetails: boolean
  maxRecords: number
}

export class AuditServiceComplete {
  
  /**
   * Registrar una acción de auditoría
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId || '',
          userId: data.userId,
          details: data.details ? JSON.stringify({
            ...data.details,
            oldValues: data.oldValues,
            newValues: data.newValues,
            metadata: data.metadata
          }) : undefined,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
          createdAt: new Date()
        }
      })
    } catch (error) {
      console.error('[AUDIT] Error logging audit entry:', error)
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  /**
   * Obtener logs de auditoría con filtros avanzados
   */
  static async getLogs(filter: AuditLogFilter = {}) {
    const {
      userId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      limit = 50,
      offset = 0,
      search
    } = filter

    const where: any = {}

    if (userId) where.userId = userId
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (action) where.action = { contains: action, mode: 'insensitive' }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { users: { name: { contains: search, mode: 'insensitive' } } },
        { users: { email: { contains: search, mode: 'insensitive' } } }
      ]
    }
    
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = startDate
      if (endDate) where.createdAt.lte = endDate
    }

    const logs = await prisma.audit_logs.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    const total = await prisma.audit_logs.count({ where })

    return {
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details as string) : null
      })),
      total,
      hasMore: offset + limit < total
    }
  }

  /**
   * Obtener estadísticas de auditoría avanzadas
   */
  static async getStats(days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Estadísticas por acción y entidad
    const actionStats = await prisma.audit_logs.groupBy({
      by: ['action', 'entityType'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    // Total de logs
    const totalLogs = await prisma.audit_logs.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    })

    // Actividad por usuario
    const userActivity = await prisma.audit_logs.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    })

    // Estadísticas por módulo
    const moduleStats = await prisma.audit_logs.groupBy({
      by: ['entityType'],
      where: {
        createdAt: {
          gte: startDate
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    })

    return {
      totalLogs,
      actionStats,
      topUsers: userActivity,
      moduleActivity: moduleStats,
      period: `${days} días`
    }
  }

  /**
   * Exportar logs con paginación profesional
   */
  static async exportLogs(options: AuditExportOptions) {
    const { filters, includeDetails, maxRecords } = options
    
    // Limitar registros para evitar problemas de memoria
    const safeLimit = Math.min(maxRecords, 100000) // Máximo 100k registros
    
    const result = await this.getLogs({
      ...filters,
      limit: safeLimit
    })

    return {
      data: result.logs,
      total: result.total,
      exported: result.logs.length,
      truncated: result.total > safeLimit,
      includeDetails
    }
  }

  /**
   * Limpiar logs antiguos con retención inteligente
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Mantener logs críticos por más tiempo
    const criticalActions = [
      'user_deleted', 'user_role_changed', 'system_config_changed',
      'backup_created', 'backup_restored', 'security_breach'
    ]

    // Eliminar logs no críticos
    const result = await prisma.audit_logs.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        action: {
          notIn: criticalActions
        }
      }
    })

    // Log de limpieza
    await this.log({
      action: 'cleanup_audit_logs',
      entityType: 'system',
      userId: 'system',
      details: {
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
        daysToKeep,
        criticalActionsPreserved: criticalActions
      }
    })

    return result.count
  }

  /**
   * Detectar patrones sospechosos
   */
  static async detectSuspiciousActivity(hours: number = 24) {
    const startDate = new Date()
    startDate.setHours(startDate.getHours() - hours)

    // Múltiples intentos de login fallidos
    const failedLogins = await prisma.audit_logs.groupBy({
      by: ['userId', 'ipAddress'],
      where: {
        action: 'user_login_failed',
        createdAt: { gte: startDate }
      },
      _count: { id: true },
      having: {
        id: { _count: { gt: 5 } }
      }
    })

    // Eliminaciones masivas
    const massDeletes = await prisma.audit_logs.groupBy({
      by: ['userId'],
      where: {
        action: { endsWith: '_deleted' },
        createdAt: { gte: startDate }
      },
      _count: { id: true },
      having: {
        id: { _count: { gt: 10 } }
      }
    })

    return {
      failedLogins,
      massDeletes,
      period: `${hours} horas`
    }
  }

  /**
   * Alias para log() - mantiene compatibilidad con código existente
   */
  static async logAction(data: AuditLogData): Promise<void> {
    return this.log(data)
  }
}

// Acciones de auditoría por módulo - COMPLETAS
export const AuditActionsComplete = {
  // Tickets
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_STATUS_CHANGED: 'ticket_status_changed',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_RESOLVED: 'ticket_resolved',
  TICKET_CLOSED: 'ticket_closed',
  TICKET_DELETED: 'ticket_deleted',
  TICKET_PRIORITY_CHANGED: 'ticket_priority_changed',

  // Usuarios
  USER_LOGIN: 'user_login',
  USER_LOGIN_FAILED: 'user_login_failed',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_PASSWORD_CHANGED: 'user_password_changed',
  USER_AVATAR_UPDATED: 'user_avatar_updated',
  USER_PREFERENCES_UPDATED: 'user_preferences_updated',

  // Técnicos
  TECHNICIAN_ASSIGNED: 'technician_assigned',
  TECHNICIAN_UNASSIGNED: 'technician_unassigned',
  TECHNICIAN_PROMOTED: 'technician_promoted',
  TECHNICIAN_DEMOTED: 'technician_demoted',
  TECHNICIAN_CREATED: 'technician_created',
  TECHNICIAN_UPDATED: 'technician_updated',
  TECHNICIAN_DELETED: 'technician_deleted',
  TECHNICIAN_CATEGORY_ASSIGNED: 'technician_category_assigned',
  TECHNICIAN_CATEGORY_REMOVED: 'technician_category_removed',

  // Categorías
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',
  CATEGORY_DELETED: 'category_deleted',
  CATEGORY_MOVED: 'category_moved',
  CATEGORY_TECHNICIAN_ASSIGNED: 'category_technician_assigned',

  // Departamentos
  DEPARTMENT_CREATED: 'department_created',
  DEPARTMENT_UPDATED: 'department_updated',
  DEPARTMENT_DELETED: 'department_deleted',

  // Comentarios
  COMMENT_ADDED: 'comment_added',
  COMMENT_UPDATED: 'comment_updated',
  COMMENT_DELETED: 'comment_deleted',

  // Archivos
  FILE_UPLOADED: 'file_uploaded',
  FILE_DOWNLOADED: 'file_downloaded',
  FILE_DELETED: 'file_deleted',

  // Reportes
  REPORT_GENERATED: 'report_generated',
  REPORT_EXPORTED: 'report_exported',
  REPORT_SCHEDULED: 'report_scheduled',

  // Sistema
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_RESTORE: 'system_restore',
  SYSTEM_CONFIG_CHANGED: 'system_config_changed',
  SYSTEM_MAINTENANCE: 'system_maintenance',
  SYSTEM_UPDATE: 'system_update',

  // Configuración
  SETTINGS_UPDATED: 'settings_updated',
  SETTINGS_VIEW: 'settings_view',

  // Estadísticas y vistas
  STATS_VIEW: 'stats_view',
  CATEGORY_VIEW: 'category_view',

  // Email
  EMAIL_SENT: 'email_sent',
  EMAIL_QUEUED: 'email_queued',
  EMAIL_FAILED: 'email_failed',
  OAUTH_CONFIG_UPDATED: 'oauth_config_updated',
  EMAIL_CONFIG_UPDATED: 'email_config_updated',
  NOTIFICATION_CONFIG_UPDATED: 'notification_config_updated'
} as const

// Helpers para registrar acciones específicas con valores anteriores y nuevos
export const logTicketActionComplete = async (
  action: string,
  ticketId: string,
  userId: string,
  details?: Record<string, any>,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  request?: Request
) => {
  await AuditServiceComplete.log({
    action,
    entityType: 'ticket',
    entityId: ticketId,
    userId,
    details,
    oldValues,
    newValues,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}

export const logUserActionComplete = async (
  action: string,
  targetUserId: string,
  performedBy: string,
  details?: Record<string, any>,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  request?: Request
) => {
  await AuditServiceComplete.log({
    action,
    entityType: 'user',
    entityId: targetUserId,
    userId: performedBy,
    details,
    oldValues,
    newValues,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}

export const logCategoryActionComplete = async (
  action: string,
  categoryId: string,
  userId: string,
  details?: Record<string, any>,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  request?: Request
) => {
  await AuditServiceComplete.log({
    action,
    entityType: 'category',
    entityId: categoryId,
    userId,
    details,
    oldValues,
    newValues,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}

export const logDepartmentActionComplete = async (
  action: string,
  departmentId: string,
  userId: string,
  details?: Record<string, any>,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  request?: Request
) => {
  await AuditServiceComplete.log({
    action,
    entityType: 'department',
    entityId: departmentId,
    userId,
    details,
    oldValues,
    newValues,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}

export const logSystemActionComplete = async (
  action: string,
  userId: string,
  details?: Record<string, any>,
  request?: Request
) => {
  await AuditServiceComplete.log({
    action,
    entityType: 'system',
    userId,
    details,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}