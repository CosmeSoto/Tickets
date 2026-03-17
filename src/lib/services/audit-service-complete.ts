/**
 * Servicio de Auditoría y Logs - SISTEMA COMPLETO
 * Registra todas las acciones importantes del sistema para compliance y auditorías
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditContextEnricher, EnrichedContext } from './audit-context-enricher'
import { NextRequest } from 'next/server'

export interface AuditLogData {
  action: string
  entityType: 'ticket' | 'user' | 'category' | 'department' | 'comment' | 'attachment' | 'system' | 'report' | 'settings' | 'technician' | 'assignment' | 'equipment' | 'inventory'
  entityId?: string
  userId: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  oldValues?: Record<string, any> // Para cambios
  newValues?: Record<string, any> // Para cambios
  // NUEVO: Contexto enriquecido
  request?: NextRequest
  sessionId?: string
  result?: 'SUCCESS' | 'ERROR' | 'PARTIAL'
  errorCode?: string
  errorMessage?: string
  startTime?: number
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
   * Registrar una acción de auditoría con contexto enriquecido
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      // Enriquecer contexto automáticamente
      const enrichedContext = data.request 
        ? AuditContextEnricher.enrichContext(data.request, {
            sessionId: data.sessionId,
            startTime: data.startTime,
            result: data.result,
            errorCode: data.errorCode,
            errorMessage: data.errorMessage
          })
        : AuditContextEnricher.createSystemContext({
            result: data.result,
            errorCode: data.errorCode,
            errorMessage: data.errorMessage
          })
      
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId || '',
          userId: data.userId,
          details: {
            // Datos originales
            ...data.details,
            oldValues: data.oldValues,
            newValues: data.newValues,
            metadata: data.metadata,
            
            // NUEVO: Contexto enriquecido
            context: {
              // Trazabilidad
              sessionId: enrichedContext.sessionId,
              requestId: enrichedContext.requestId,
              correlationId: enrichedContext.correlationId,
              
              // Resultado
              result: enrichedContext.result,
              errorCode: enrichedContext.errorCode,
              errorMessage: enrichedContext.errorMessage,
              duration: enrichedContext.duration,
              
              // Contexto técnico
              source: enrichedContext.source,
              endpoint: enrichedContext.endpoint,
              method: enrichedContext.method,
              statusCode: enrichedContext.statusCode,
              
              // Dispositivo
              deviceType: enrichedContext.deviceType,
              browser: enrichedContext.browser,
              browserVersion: enrichedContext.browserVersion,
              os: enrichedContext.os,
              osVersion: enrichedContext.osVersion,
              
              // Timestamp
              timestamp: enrichedContext.timestamp
            }
          },
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
   * MEJORADO: Resuelve IDs a nombres legibles automáticamente
   */
  static async getLogs(filter: AuditLogFilter = {}) {
    try {
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

      // NUEVO: Resolver IDs a nombres legibles
      const enrichedLogs = await Promise.all(logs.map(async (log) => {
        const enrichedDetails = await this.enrichLogDetails(log)
        return {
          ...log,
          details: enrichedDetails
        }
      }))

      return {
        logs: enrichedLogs,
        total,
        hasMore: offset + limit < total
      }
    } catch (error) {
      console.error('[AUDIT SERVICE] Error in getLogs:', error)
      throw error
    }
  }

  /**
   * NUEVO: Enriquece los detalles del log resolviendo IDs a nombres
   */
  private static async enrichLogDetails(log: any): Promise<any> {
    const details = log.details || {}
    const enriched: any = { ...details }

    try {
      // Resolver entityId según el tipo
      if (log.entityId) {
        enriched.entityName = await this.resolveEntityId(log.entityType, log.entityId)
      }

      // Resolver IDs en oldValues y newValues
      if (details.oldValues && details.newValues) {
        enriched.changes = await this.resolveChanges(details.oldValues, details.newValues)
      }

      // Resolver IDs comunes en details
      if (details.userId) {
        enriched.userName = await this.resolveUserId(details.userId)
      }
      if (details.assigneeId) {
        enriched.assigneeName = await this.resolveUserId(details.assigneeId)
      }
      if (details.categoryId) {
        enriched.categoryName = await this.resolveCategoryId(details.categoryId)
      }
      if (details.departmentId) {
        enriched.departmentName = await this.resolveDepartmentId(details.departmentId)
      }
      if (details.ticketId) {
        enriched.ticketTitle = await this.resolveTicketId(details.ticketId)
      }

      return enriched
    } catch (error) {
      console.error('[AUDIT] Error enriching log details:', error)
      return details
    }
  }

  /**
   * Resuelve un entityId según su tipo
   */
  private static async resolveEntityId(entityType: string, entityId: string): Promise<string> {
    try {
      switch (entityType.toLowerCase()) {
        case 'user':
          return await this.resolveUserId(entityId)
        case 'ticket':
          return await this.resolveTicketId(entityId)
        case 'category':
          return await this.resolveCategoryId(entityId)
        case 'department':
          return await this.resolveDepartmentId(entityId)
        default:
          return entityId
      }
    } catch {
      return entityId
    }
  }

  /**
   * Resuelve cambios (oldValues -> newValues) a nombres legibles
   */
  private static async resolveChanges(oldValues: any, newValues: any): Promise<Record<string, { old: string; new: string; field: string }>> {
    const changes: Record<string, { old: string; new: string; field: string }> = {}

    for (const key of Object.keys(newValues)) {
      if (oldValues[key] !== newValues[key]) {
        const oldResolved = await this.resolveFieldValue(key, oldValues[key])
        const newResolved = await this.resolveFieldValue(key, newValues[key])
        
        changes[key] = {
          field: this.getFieldDisplayName(key),
          old: oldResolved,
          new: newResolved
        }
      }
    }

    return changes
  }

  /**
   * Resuelve un valor de campo según su nombre
   */
  private static async resolveFieldValue(fieldName: string, value: any): Promise<string> {
    if (value === null || value === undefined) return 'vacío'
    if (typeof value !== 'string') return String(value)
    
    // Si no parece un UUID, retornar como está
    if (!value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // Traducir valores especiales
      if (fieldName.toLowerCase().includes('role')) {
        return this.getRoleDisplayName(value)
      }
      if (fieldName.toLowerCase().includes('status')) {
        return this.getStatusDisplayName(value)
      }
      if (fieldName.toLowerCase().includes('priority')) {
        return this.getPriorityDisplayName(value)
      }
      if (typeof value === 'boolean') {
        return value ? 'Activo' : 'Inactivo'
      }
      return value
    }
    
    // Resolver UUID según el tipo de campo
    const fieldLower = fieldName.toLowerCase()
    
    if (fieldLower.includes('user') || fieldLower.includes('createdby') || fieldLower.includes('assignee')) {
      return await this.resolveUserId(value)
    }
    if (fieldLower.includes('department')) {
      return await this.resolveDepartmentId(value)
    }
    if (fieldLower.includes('category')) {
      return await this.resolveCategoryId(value)
    }
    if (fieldLower.includes('ticket')) {
      return await this.resolveTicketId(value)
    }
    
    return value
  }

  /**
   * Resuelve un ID de usuario a nombre legible
   */
  private static async resolveUserId(userId: string): Promise<string> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      })
      return user ? `${user.name} (${user.email})` : userId
    } catch {
      return userId
    }
  }

  /**
   * Resuelve un ID de ticket a título legible
   */
  private static async resolveTicketId(ticketId: string): Promise<string> {
    try {
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        select: { title: true }
      })
      return ticket ? ticket.title : ticketId
    } catch {
      return ticketId
    }
  }

  /**
   * Resuelve un ID de categoría a nombre legible
   */
  private static async resolveCategoryId(categoryId: string): Promise<string> {
    try {
      const category = await prisma.categories.findUnique({
        where: { id: categoryId },
        select: { name: true }
      })
      return category ? category.name : categoryId
    } catch {
      return categoryId
    }
  }

  /**
   * Resuelve un ID de departamento a nombre legible
   */
  private static async resolveDepartmentId(departmentId: string): Promise<string> {
    try {
      const department = await prisma.departments.findUnique({
        where: { id: departmentId },
        select: { name: true }
      })
      return department ? department.name : departmentId
    } catch {
      return departmentId
    }
  }

  /**
   * Traduce nombres de campos técnicos a nombres amigables
   */
  private static getFieldDisplayName(fieldName: string): string {
    const fieldNames: Record<string, string> = {
      'name': 'Nombre',
      'email': 'Correo Electrónico',
      'role': 'Rol',
      'departmentId': 'Departamento',
      'phone': 'Teléfono',
      'isActive': 'Estado',
      'avatar': 'Avatar',
      'password': 'Contraseña',
      'createdById': 'Creado por',
      'assigneeId': 'Asignado a',
      'ticketId': 'Ticket',
      'title': 'Título',
      'description': 'Descripción',
      'status': 'Estado',
      'priority': 'Prioridad',
      'categoryId': 'Categoría',
      'ticketNumber': 'Número de Ticket',
      'color': 'Color',
      'parentId': 'Categoría Padre',
      'level': 'Nivel',
      'order': 'Orden',
      'createdAt': 'Fecha de Creación',
      'updatedAt': 'Última Actualización',
      'isEmailVerified': 'Email Verificado',
      'lastLogin': 'Último Acceso'
    }
    return fieldNames[fieldName] || fieldName
  }

  /**
   * Traduce valores de roles a nombres amigables
   */
  private static getRoleDisplayName(role: string): string {
    const roleNames: Record<string, string> = {
      'ADMIN': 'Administrador',
      'TECHNICIAN': 'Técnico',
      'CLIENT': 'Cliente'
    }
    return roleNames[role] || role
  }

  /**
   * Traduce valores de estado a nombres amigables
   */
  private static getStatusDisplayName(status: string): string {
    const statusNames: Record<string, string> = {
      'OPEN': 'Abierto',
      'IN_PROGRESS': 'En Progreso',
      'PENDING': 'Pendiente',
      'RESOLVED': 'Resuelto',
      'CLOSED': 'Cerrado',
      'CANCELLED': 'Cancelado'
    }
    return statusNames[status] || status
  }

  /**
   * Traduce valores de prioridad a nombres amigables
   */
  private static getPriorityDisplayName(priority: string): string {
    const priorityNames: Record<string, string> = {
      'LOW': 'Baja',
      'MEDIUM': 'Media',
      'HIGH': 'Alta',
      'URGENT': 'Urgente'
    }
    return priorityNames[priority] || priority
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
        action: 'login_failed',
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
  USER_LOGIN_FAILED: 'login_failed', // Cambiado para coincidir con auth.ts
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  USER_ROLE_CHANGED: 'user_role_changed',
  USER_PASSWORD_CHANGED: 'user_password_changed',
  USER_AVATAR_UPDATED: 'user_avatar_updated',
  USER_PREFERENCES_UPDATED: 'user_preferences_updated',
  PASSWORD_RESET: 'password_reset',

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
  NOTIFICATION_CONFIG_UPDATED: 'notification_config_updated',

  // Inventario - Equipos
  EQUIPMENT_CREATED: 'equipment_created',
  EQUIPMENT_UPDATED: 'equipment_updated',
  EQUIPMENT_DELETED: 'equipment_deleted',
  EQUIPMENT_STATUS_CHANGED: 'equipment_status_changed',

  // Inventario - Asignaciones
  ASSIGNMENT_CREATED: 'assignment_created',
  ASSIGNMENT_COMPLETED: 'assignment_completed',
  ASSIGNMENT_CANCELLED: 'assignment_cancelled',

  // Inventario - Actas
  ACT_CREATED: 'act_created',
  ACT_ACCEPTED: 'act_accepted',
  ACT_REJECTED: 'act_rejected',
  ACT_EXPIRED: 'act_expired',

  // Inventario - Mantenimiento
  MAINTENANCE_CREATED: 'maintenance_created',
  MAINTENANCE_UPDATED: 'maintenance_updated',

  // Inventario - Licencias
  LICENSE_CREATED: 'license_created',
  LICENSE_UPDATED: 'license_updated',
  LICENSE_DELETED: 'license_deleted',
  LICENSE_ASSIGNED: 'license_assigned',
  LICENSE_UNASSIGNED: 'license_unassigned',

  // Inventario - Consumibles
  CONSUMABLE_CREATED: 'consumable_created',
  CONSUMABLE_UPDATED: 'consumable_updated',
  CONSUMABLE_DELETED: 'consumable_deleted',
  STOCK_MOVEMENT_CREATED: 'stock_movement_created',

  // Inventario - Reportes
  INVENTORY_REPORT_GENERATED: 'inventory_report_generated',

  // Catálogos - Tipos de Equipo
  EQUIPMENT_TYPE_CREATED: 'equipment_type_created',
  EQUIPMENT_TYPE_UPDATED: 'equipment_type_updated',
  EQUIPMENT_TYPE_DELETED: 'equipment_type_deleted',

  // Catálogos - Tipos de Licencia
  LICENSE_TYPE_CREATED: 'license_type_created',
  LICENSE_TYPE_UPDATED: 'license_type_updated',
  LICENSE_TYPE_DELETED: 'license_type_deleted',

  // Catálogos - Tipos de Consumible
  CONSUMABLE_TYPE_CREATED: 'consumable_type_created',
  CONSUMABLE_TYPE_UPDATED: 'consumable_type_updated',
  CONSUMABLE_TYPE_DELETED: 'consumable_type_deleted',

  // Catálogos - Unidades de Medida
  UNIT_OF_MEASURE_CREATED: 'unit_of_measure_created',
  UNIT_OF_MEASURE_UPDATED: 'unit_of_measure_updated',
  UNIT_OF_MEASURE_DELETED: 'unit_of_measure_deleted',
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