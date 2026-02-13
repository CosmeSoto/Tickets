/**
 * Servicio de Auditoría y Logs
 * Registra todas las acciones importantes del sistema
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface AuditLogData {
  action: string
  entityType: 'ticket' | 'user' | 'category' | 'department' | 'comment' | 'attachment' | 'system'
  entityId?: string | null
  userId: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
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
}

export class AuditService {
  
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
          details: data.details ? JSON.stringify(data.details) : undefined,
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
   * Obtener logs de auditoría con filtros
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
      offset = 0
    } = filter

    const where: any = {}

    if (userId) where.userId = userId
    if (entityType) where.entityType = entityType
    if (entityId) where.entityId = entityId
    if (action) where.action = { contains: action, mode: 'insensitive' }
    
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
   * Obtener estadísticas de auditoría
   */
  static async getStats(days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const stats = await prisma.audit_logs.groupBy({
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

    const totalLogs = await prisma.audit_logs.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    })

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

    return {
      totalLogs,
      actionStats: stats,
      topUsers: userActivity,
      period: `${days} días`
    }
  }

  /**
   * Limpiar logs antiguos
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const result = await prisma.audit_logs.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    await AuditService.log({
      action: 'cleanup_audit_logs',
      entityType: 'system',
      userId: 'system',
      details: {
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString(),
        daysToKeep
      }
    })

    return result.count
  }
}

// Funciones de conveniencia para acciones comunes
export const AuditActions = {
  // Tickets
  TICKET_CREATED: 'ticket_created',
  TICKET_UPDATED: 'ticket_updated',
  TICKET_STATUS_CHANGED: 'ticket_status_changed',
  TICKET_ASSIGNED: 'ticket_assigned',
  TICKET_RESOLVED: 'ticket_resolved',
  TICKET_CLOSED: 'ticket_closed',
  TICKET_DELETED: 'ticket_deleted',

  // Comentarios
  COMMENT_ADDED: 'comment_added',
  COMMENT_UPDATED: 'comment_updated',
  COMMENT_DELETED: 'comment_deleted',

  // Archivos
  FILE_UPLOADED: 'file_uploaded',
  FILE_DOWNLOADED: 'file_downloaded',
  FILE_DELETED: 'file_deleted',

  // Usuarios
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',

  // Sistema
  SYSTEM_BACKUP: 'system_backup',
  SYSTEM_RESTORE: 'system_restore',
  SYSTEM_CONFIG_CHANGED: 'system_config_changed',
  SYSTEM_MAINTENANCE: 'system_maintenance',

  // Categorías
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',
  CATEGORY_DELETED: 'category_deleted',

  // Departamentos
  DEPARTMENT_CREATED: 'department_created',
  DEPARTMENT_UPDATED: 'department_updated',
  DEPARTMENT_DELETED: 'department_deleted'
} as const

// Helper para registrar acciones de tickets
export const logTicketAction = async (
  action: string,
  ticketId: string,
  userId: string,
  details?: Record<string, any>,
  request?: Request
) => {
  await AuditService.log({
    action,
    entityType: 'ticket',
    entityId: ticketId,
    userId,
    details,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}

// Helper para registrar acciones de usuarios
export const logUserAction = async (
  action: string,
  targetUserId: string,
  performedBy: string,
  details?: Record<string, any>,
  request?: Request
) => {
  await AuditService.log({
    action,
    entityType: 'user',
    entityId: targetUserId,
    userId: performedBy,
    details,
    ipAddress: request?.headers.get('x-forwarded-for') || 
               request?.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request?.headers.get('user-agent') || 'unknown'
  })
}

// Helper para registrar acciones del sistema
export const logSystemAction = async (
  action: string,
  userId: string,
  details?: Record<string, any>,
  request?: Request
) => {
  await AuditService.log({
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