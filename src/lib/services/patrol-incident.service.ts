/**
 * Servicio de gestión de novedades (incidentes) de patrulla.
 *
 * Responsabilidades:
 * - CRUD de novedades durante ejecución de ronda
 * - Validación de ventana de edición (gracePeriodMinutes)
 * - Notificación a supervisores al crear novedad
 * - Auditoría de acciones
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { PatrolPhotoService } from '@/lib/services/patrol-photo.service'
import { NotificationType } from '@prisma/client'
import { getPatrolSupervisors } from '@/lib/patrol/patrol-helpers'

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CreateIncidentData {
  patrolId: string
  checkpointId: string
  agentId: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  photoBase64?: string
}

export interface UpdateIncidentData {
  description?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  photoBase64?: string
}

export interface ListIncidentFilters {
  agentId?: string
  familyId?: string
  patrolId?: string
  severity?: string
  status?: string
  dateFrom?: Date
  dateTo?: Date
  page?: number
  limit?: number
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class PatrolIncidentService {
  // ── Crear novedad ─────────────────────────────────────────────────────────

  /**
   * Crea una novedad durante la ejecución de una ronda.
   *
   * Validaciones:
   * - La patrulla debe estar IN_PROGRESS
   * - El checkpoint debe pertenecer a la ruta de la patrulla
   * - El agente debe ser el asignado a la patrulla
   */
  static async create(data: CreateIncidentData) {
    const { patrolId, checkpointId, agentId, description, severity, photoBase64 } = data

    // 1. Obtener la patrulla con su ruta
    const patrol = await prisma.patrols.findUnique({
      where: { id: patrolId },
      include: {
        route: {
          include: {
            routeCheckpoints: { select: { checkpointId: true } },
          },
        },
        family: { select: { id: true, name: true } },
      },
    })

    if (!patrol) {
      throw new Error('Patrulla no encontrada')
    }

    // 2. Validar que la patrulla está en progreso
    if (patrol.status !== 'IN_PROGRESS') {
      throw new Error('La patrulla no está en progreso')
    }

    // 3. Validar que el agente es el asignado
    if (patrol.agentId !== agentId) {
      throw new Error('No autorizado: no es el agente asignado a esta patrulla')
    }

    // 4. Validar que el checkpoint pertenece a la ruta
    const routeCheckpointIds = patrol.route.routeCheckpoints.map(rc => rc.checkpointId)
    if (!routeCheckpointIds.includes(checkpointId)) {
      throw new Error('El checkpoint no pertenece a la ruta de esta patrulla')
    }

    // 5. Guardar foto si se proporciona
    let photoIds: string[] = []
    let savedPhoto: any = null

    if (photoBase64) {
      savedPhoto = await PatrolPhotoService.savePhoto(
        photoBase64,
        null,
        patrolId,
        new Date()
      )
      photoIds = [savedPhoto.id]
    }

    // 6. Crear registro de incidente
    const incidentId = randomUUID()
    const incident = await prisma.patrol_incidents.create({
      data: {
        id: incidentId,
        patrolId,
        checkpointId,
        agentId,
        description,
        severity,
        status: 'OPEN',
        photoIds,
      },
    })

    // 7. Actualizar la referencia incidentId en la foto
    if (savedPhoto) {
      await prisma.patrol_photos.update({
        where: { id: savedPhoto.id },
        data: { incidentId: incident.id },
      })
    }

    // 8. Notificar a supervisores
    try {
      const supervisors = await getPatrolSupervisors(patrol.familyId)
      const checkpoint = await prisma.patrol_checkpoints.findUnique({
        where: { id: checkpointId },
        select: { name: true },
      })

      for (const supervisor of supervisors) {
        await NotificationService.push({
          userId: supervisor.id,
          type: NotificationType.WARNING,
          title: 'Nueva novedad reportada',
          message: `Novedad ${severity} en checkpoint "${checkpoint?.name ?? checkpointId}" - Ruta: ${patrol.route.name}`,
          metadata: {
            incidentId: incident.id,
            patrolId,
            checkpointId,
            severity,
            familyId: patrol.familyId,
          },
        })
      }
    } catch (err) {
      console.error('[PatrolIncidentService] Error notificando supervisores:', err)
    }

    // 9. Auditoría
    try {
      await AuditServiceComplete.log({
        action: 'patrol_incident_created',
        entityType: 'patrol',
        entityId: incident.id,
        userId: agentId,
        details: {
          patrolId,
          checkpointId,
          severity,
          description: description.substring(0, 100),
          hasPhoto: !!photoBase64,
        },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error en auditoría:', err)
    }

    return incident
  }

  // ── Actualizar novedad ────────────────────────────────────────────────────

  /**
   * Actualiza una novedad existente (descripción, severidad, foto).
   * Verifica propiedad y ventana de edición.
   */
  static async update(id: string, data: UpdateIncidentData, agentId: string) {
    // 1. Obtener incidente
    const incident = await prisma.patrol_incidents.findUnique({
      where: { id },
      include: { patrol: { select: { familyId: true, id: true } } },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    // 2. Verificar propiedad
    if (incident.agentId !== agentId) {
      throw new Error('No autorizado: no es el autor de esta novedad')
    }

    // 3. Verificar ventana de edición
    const canEdit = await this.isWithinEditWindow(incident, incident.patrol.familyId)
    if (!canEdit) {
      throw new Error('El período de edición ha expirado')
    }

    // 4. Preparar datos de actualización
    const updateData: any = {}
    if (data.description !== undefined) updateData.description = data.description
    if (data.severity !== undefined) updateData.severity = data.severity

    // 5. Manejar nueva foto
    if (data.photoBase64) {
      const savedPhoto = await PatrolPhotoService.savePhoto(
        data.photoBase64,
        null,
        incident.patrolId,
        new Date()
      )

      // Actualizar referencia de la foto
      await prisma.patrol_photos.update({
        where: { id: savedPhoto.id },
        data: { incidentId: incident.id },
      })

      // Agregar al array de photoIds
      updateData.photoIds = [...incident.photoIds, savedPhoto.id]
    }

    // 6. Actualizar registro
    const updated = await prisma.patrol_incidents.update({
      where: { id },
      data: updateData,
    })

    return updated
  }

  // ── Eliminar novedad ──────────────────────────────────────────────────────

  /**
   * Elimina una novedad (hard delete).
   * Verifica propiedad y ventana de edición.
   */
  static async delete(id: string, agentId: string) {
    // 1. Obtener incidente
    const incident = await prisma.patrol_incidents.findUnique({
      where: { id },
      include: { patrol: { select: { familyId: true } } },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    // 2. Verificar propiedad
    if (incident.agentId !== agentId) {
      throw new Error('No autorizado: no es el autor de esta novedad')
    }

    // 3. Verificar ventana de edición
    const canEdit = await this.isWithinEditWindow(incident, incident.patrol.familyId)
    if (!canEdit) {
      throw new Error('El período de edición ha expirado')
    }

    // 4. Eliminar registro
    await prisma.patrol_incidents.delete({
      where: { id },
    })
  }

  // ── Obtener por ID ────────────────────────────────────────────────────────

  /**
   * Retorna una novedad con todas sus relaciones enriquecidas.
   */
  static async getById(id: string) {
    const incident = await prisma.patrol_incidents.findUnique({
      where: { id },
      include: {
        agent: {
          select: { id: true, name: true },
        },
        checkpoint: {
          select: { id: true, name: true, location: true },
        },
        patrol: {
          select: {
            id: true,
            scheduledStart: true,
            route: { select: { id: true, name: true } },
          },
        },
        photos: {
          where: { deletedAt: null },
          select: { id: true, path: true },
        },
        ticket: {
          select: { id: true, ticketCode: true, status: true },
        },
      },
    })

    return incident
  }

  // ── Listar novedades ──────────────────────────────────────────────────────

  /**
   * Lista novedades con filtros y paginación.
   * - Para agentes: filtrar por agentId, orden createdAt DESC
   * - Para admin: filtros completos (dateFrom, dateTo, familyId, severity, status, agentId, patrolId)
   */
  static async list(filters: ListIncidentFilters) {
    const {
      agentId,
      familyId,
      patrolId,
      severity,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = filters

    const where: any = {}

    // Filtro por agente
    if (agentId) where.agentId = agentId

    // Filtro por patrulla
    if (patrolId) where.patrolId = patrolId

    // Filtro por familia (a través de la patrulla)
    if (familyId) {
      where.patrol = { familyId }
    }

    // Filtro por severidad
    if (severity) where.severity = severity

    // Filtro por estado
    if (status) where.status = status

    // Filtro por rango de fechas
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = dateFrom
      if (dateTo) where.createdAt.lte = dateTo
    }

    const skip = (page - 1) * limit

    const [incidents, total] = await Promise.all([
      prisma.patrol_incidents.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true } },
          checkpoint: { select: { id: true, name: true, location: true } },
          patrol: {
            select: {
              id: true,
              scheduledStart: true,
              familyId: true,
              route: { select: { id: true, name: true } },
            },
          },
          photos: {
            where: { deletedAt: null },
            select: { id: true, path: true },
          },
          ticket: {
            select: { id: true, ticketCode: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.patrol_incidents.count({ where }),
    ])

    return {
      data: incidents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  // ── Resolver novedad ────────────────────────────────────────────────────

  /**
   * Marca una novedad como resuelta.
   * Solo se puede resolver si el estado es OPEN.
   */
  static async resolve(id: string, resolvedById: string) {
    // 1. Obtener incidente
    const incident = await prisma.patrol_incidents.findUnique({
      where: { id },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    // 2. Validar estado
    if (incident.status !== 'OPEN') {
      throw new Error('La novedad ya fue resuelta o escalada')
    }

    // 3. Actualizar estado a RESOLVED
    const updated = await prisma.patrol_incidents.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById,
      },
    })

    // 4. Auditoría
    try {
      await AuditServiceComplete.log({
        action: 'patrol_incident_resolved',
        entityType: 'patrol',
        entityId: id,
        userId: resolvedById,
        details: {
          patrolId: incident.patrolId,
          checkpointId: incident.checkpointId,
          severity: incident.severity,
        },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error en auditoría:', err)
    }

    // 5. Notificar al agente que reportó la novedad
    try {
      await NotificationService.push({
        userId: incident.agentId,
        type: NotificationType.INFO,
        title: 'Novedad resuelta',
        message: `Tu novedad ha sido marcada como resuelta.`,
        metadata: {
          incidentId: id,
          patrolId: incident.patrolId,
        },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error notificando agente:', err)
    }

    return updated
  }

  // ── Escalar novedad a ticket ──────────────────────────────────────────────

  /**
   * Escala una novedad creando un ticket en el sistema de tickets.
   * Solo se puede escalar si el estado es OPEN.
   */
  static async escalateToTicket(id: string, escalatedById: string) {
    // 1. Obtener incidente con relaciones necesarias
    const incident = await prisma.patrol_incidents.findUnique({
      where: { id },
      include: {
        patrol: {
          select: { familyId: true, id: true },
        },
        checkpoint: {
          select: { name: true },
        },
      },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    // 2. Validar estado
    if (incident.status !== 'OPEN') {
      throw new Error('La novedad ya fue resuelta o escalada')
    }

    // 3. Obtener categoryId de la configuración de la familia
    const familyConfig = await prisma.patrol_family_config.findUnique({
      where: { familyId: incident.patrol.familyId },
      select: { patrolIncidentCategoryId: true },
    })

    let categoryId = familyConfig?.patrolIncidentCategoryId ?? null

    // Si no hay categoría configurada, buscar una por defecto
    if (!categoryId) {
      const defaultCategory = await prisma.categories.findFirst({
        where: { level: 1 },
        orderBy: { createdAt: 'asc' },
      })
      if (defaultCategory) {
        categoryId = defaultCategory.id
      } else {
        throw new Error('No hay categorías configuradas para escalar la novedad')
      }
    }

    // 4. Mapear severidad a prioridad de ticket
    const severityToPriority: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
      CRITICAL: 'HIGH',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    }
    const priority = severityToPriority[incident.severity] ?? 'MEDIUM'

    // 5. Crear ticket
    const ticketId = randomUUID()
    const now = new Date()

    await prisma.tickets.create({
      data: {
        id: ticketId,
        title: `Novedad en ronda - ${incident.checkpoint.name}`,
        description: incident.description,
        status: 'OPEN',
        priority,
        source: 'PATROL',
        clientId: incident.agentId,
        categoryId,
        familyId: incident.patrol.familyId,
        createdById: escalatedById,
        createdAt: now,
        updatedAt: now,
      },
    })

    // 6. Actualizar incidente con estado ESCALATED y ticketId
    const updated = await prisma.patrol_incidents.update({
      where: { id },
      data: {
        status: 'ESCALATED',
        ticketId,
      },
    })

    // 7. Auditoría
    try {
      await AuditServiceComplete.log({
        action: 'patrol_incident_escalated',
        entityType: 'patrol',
        entityId: id,
        userId: escalatedById,
        details: {
          patrolId: incident.patrolId,
          checkpointId: incident.checkpointId,
          severity: incident.severity,
          ticketId,
          familyId: incident.patrol.familyId,
        },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error en auditoría:', err)
    }

    // 8. Notificar al agente que su novedad fue escalada
    try {
      await NotificationService.push({
        userId: incident.agentId,
        type: NotificationType.INFO,
        title: 'Novedad escalada a ticket',
        message: `Tu novedad en "${incident.checkpoint.name}" ha sido escalada a un ticket para su seguimiento.`,
        metadata: {
          incidentId: id,
          patrolId: incident.patrolId,
          ticketId,
        },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error notificando agente:', err)
    }

    return { incident: updated, ticketId }
  }

  // ── Ventana de edición ────────────────────────────────────────────────────

  /**
   * Verifica si una novedad está dentro de la ventana de edición.
   * Consulta `gracePeriodMinutes` de `patrol_family_config` para la familia.
   */
  static async isWithinEditWindow(
    incident: { createdAt: Date },
    familyId: string
  ): Promise<boolean> {
    const config = await prisma.patrol_family_config.findUnique({
      where: { familyId },
      select: { gracePeriodMinutes: true },
    })

    if (!config) {
      // Sin configuración, usar default de 5 minutos
      return (Date.now() - incident.createdAt.getTime()) <= 5 * 60 * 1000
    }

    const gracePeriodMs = config.gracePeriodMinutes * 60 * 1000
    return (Date.now() - incident.createdAt.getTime()) <= gracePeriodMs
  }
}
