/**
 * Sistema de Auditoría
 * Registra todos los cambios importantes en el sistema
 */

import prisma from './prisma'
import { randomUUID } from 'crypto'

export interface AuditLogInput {
  entityType: string
  entityId: string
  action: string
  userId: string
  changes?: Record<string, any>
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Crea un registro de auditoría
 */
export async function createAuditLog({
  entityType,
  entityId,
  action,
  userId,
  changes,
  metadata,
  ipAddress,
  userAgent
}: AuditLogInput): Promise<void> {
  try {
    // Obtener email del usuario
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true }
    })

    // Combinar changes y metadata en details
    const details: Record<string, any> = {}
    if (changes) details.changes = changes
    if (metadata) details.metadata = metadata

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        entityType,
        entityId,
        action,
        userId,
        userEmail: user?.email || null,
        details: Object.keys(details).length > 0 ? details : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        createdAt: new Date()
      }
    })
  } catch (error) {
    console.error('[AUDIT] Error creating audit log:', error)
    // No lanzar error para no interrumpir el flujo principal
  }
}

/**
 * Obtiene logs de auditoría para una entidad
 */
export async function getAuditLogs(
  entityType: string,
  entityId: string,
  limit: number = 50
) {
  try {
    const logs = await prisma.audit_logs.findMany({
      where: {
        entityType,
        entityId
      },
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
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return logs.map(log => {
      const details = log.details as Record<string, any> | null
      return {
        id: log.id,
        entityType: log.entityType,
        entityId: log.entityId,
        action: log.action,
        user: log.users,
        changes: details?.changes || null,
        metadata: details?.metadata || null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString()
      }
    })
  } catch (error) {
    console.error('[AUDIT] Error fetching audit logs:', error)
    return []
  }
}

/**
 * Helpers específicos para tipos de auditoría comunes
 */

export async function auditTicketChange(
  ticketId: string,
  userId: string,
  action: string,
  changes?: Record<string, any>,
  metadata?: Record<string, any>
) {
  await createAuditLog({
    entityType: 'ticket',
    entityId: ticketId,
    action,
    userId,
    changes,
    metadata
  })
}

export async function auditCommentCreated(
  commentId: string,
  ticketId: string,
  userId: string,
  isInternal: boolean
) {
  await createAuditLog({
    entityType: 'comment',
    entityId: commentId,
    action: 'created',
    userId,
    metadata: {
      ticketId,
      isInternal
    }
  })
}

export async function auditFileUploaded(
  fileId: string,
  ticketId: string,
  userId: string,
  fileName: string,
  fileSize: number
) {
  await createAuditLog({
    entityType: 'attachment',
    entityId: fileId,
    action: 'uploaded',
    userId,
    metadata: {
      ticketId,
      fileName,
      fileSize
    }
  })
}

export async function auditResolutionPlanChange(
  planId: string,
  ticketId: string,
  userId: string,
  action: string,
  changes?: Record<string, any>
) {
  await createAuditLog({
    entityType: 'resolution_plan',
    entityId: planId,
    action,
    userId,
    changes,
    metadata: {
      ticketId
    }
  })
}

export async function auditTaskChange(
  taskId: string,
  planId: string,
  userId: string,
  action: string,
  changes?: Record<string, any>
) {
  await createAuditLog({
    entityType: 'resolution_task',
    entityId: taskId,
    action,
    userId,
    changes,
    metadata: {
      planId
    }
  })
}
