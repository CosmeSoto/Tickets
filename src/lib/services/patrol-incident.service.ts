/**
 * Servicio de gestión de novedades (incidentes) de patrulla.
 *
 * Responsabilidades:
 * - CRUD de novedades durante ejecución de ronda
 * - Validación de ventana de edición (gracePeriodMinutes)
 * - Notificación a supervisores al crear novedad
 * - Auditoría de acciones
 *
 * NOTA TÉCNICA: Se usa (prisma as any).patrol_incidents porque el Prisma Client
 * en el repositorio aún no ha sido regenerado después de agregar el modelo
 * patrol_incidents al schema. Al correr `prisma generate` en producción/CI
 * los casts `as any` pueden eliminarse.
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { PatrolPhotoService } from '@/lib/services/patrol-photo.service'
import { NotificationType } from '@prisma/client'
import { getPatrolSupervisors } from '@/lib/patrol/patrol-helpers'

// Acceso al modelo patrol_incidents hasta que se regenere el Prisma Client
const db = prisma as any

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

    // 1. Obtener la patrulla con su ruta y familia
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

    // 2. Solo se pueden registrar novedades en patrullas activas
    if (patrol.status !== 'IN_PROGRESS') {
      throw new Error('La patrulla no está en progreso')
    }

    // 3. Verificar que el agente sea el asignado a esta patrulla
    if (patrol.agentId !== agentId) {
      throw new Error('No autorizado: no es el agente asignado a esta patrulla')
    }

    // 4. El checkpoint debe pertenecer a la ruta de esta patrulla
    const routeCheckpointIds = patrol.route.routeCheckpoints.map((rc: any) => rc.checkpointId)
    if (!routeCheckpointIds.includes(checkpointId)) {
      throw new Error('El checkpoint no pertenece a la ruta de esta patrulla')
    }

    // 5. Guardar foto si se proporciona
    let photoIds: string[] = []
    let savedPhoto: any = null

    if (photoBase64) {
      savedPhoto = await PatrolPhotoService.savePhoto(photoBase64, null, patrolId, new Date())
      photoIds = [savedPhoto.id]
    }

    // 6. Crear el registro de novedad
    const incidentId = randomUUID()
    const incident = await db.patrol_incidents.create({
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

    // Vincular la foto al incidente si existe
    if (savedPhoto) {
      await (prisma.patrol_photos.update as any)({
        where: { id: savedPhoto.id },
        data: { incidentId: incident.id },
      })
    }

    // 8. Notificar a supervisores del área (no bloquea la respuesta)
    try {
      const supervisors = await getPatrolSupervisors(patrol.familyId)
      const checkpoint = await prisma.patrol_checkpoints.findUnique({
        where: { id: checkpointId },
        select: { name: true },
      })

      // Mapear severidad a español
      const severityLabels: Record<string, string> = {
        LOW: 'Baja',
        MEDIUM: 'Media',
        HIGH: 'Alta',
        CRITICAL: 'Crítica',
      }
      const severityLabel = severityLabels[severity] ?? severity

      for (const supervisor of supervisors) {
        await NotificationService.push({
          userId: supervisor.id,
          type: NotificationType.WARNING,
          title: 'Nueva novedad reportada',
          message: `Novedad ${severityLabel} en checkpoint "${checkpoint?.name ?? checkpointId}" - Ruta: ${patrol.route.name}`,
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

    // 9. Registro de auditoría
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
   * Actualiza descripción, severidad o foto de una novedad existente.
   * Solo el agente autor puede editar, dentro de la ventana de gracia,
   * y únicamente si la novedad está en estado OPEN.
   */
  static async update(id: string, data: UpdateIncidentData, agentId: string) {
    // 1. Cargar el incidente con su patrulla para obtener familyId
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: { patrol: { select: { familyId: true, id: true } } },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    // 2. Solo el autor puede modificar la novedad
    if (incident.agentId !== agentId) {
      throw new Error('No autorizado: no es el autor de esta novedad')
    }

    // 3. No se puede editar una novedad resuelta o escalada
    if (incident.status !== 'OPEN') {
      throw new Error('No se puede editar una novedad que ya fue resuelta o escalada')
    }

    // 4. Verificar que no haya expirado la ventana de edición
    const canEdit = await this.isWithinEditWindow(incident, incident.patrol.familyId)
    if (!canEdit) {
      throw new Error('El período de edición ha expirado')
    }

    // 4. Preparar los campos a actualizar
    const updateData: any = {}
    if (data.description !== undefined) updateData.description = data.description
    if (data.severity !== undefined) updateData.severity = data.severity

    // 5. Agregar nueva foto si se proporciona
    if (data.photoBase64) {
      const savedPhoto = await PatrolPhotoService.savePhoto(
        data.photoBase64,
        null,
        incident.patrolId,
        new Date()
      )

      await (prisma.patrol_photos.update as any)({
        where: { id: savedPhoto.id },
        data: { incidentId: incident.id },
      })

      updateData.photoIds = [...incident.photoIds, savedPhoto.id]
    }

    // 6. Persistir cambios
    const updated = await db.patrol_incidents.update({
      where: { id },
      data: updateData,
    })

    return updated
  }

  // ── Eliminar novedad ──────────────────────────────────────────────────────

  /**
   * Elimina definitivamente una novedad.
   * Solo el autor puede eliminarla, dentro de la ventana de gracia,
   * y únicamente si la novedad está en estado OPEN.
   */
  static async delete(id: string, agentId: string) {
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: { patrol: { select: { familyId: true } } },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    if (incident.agentId !== agentId) {
      throw new Error('No autorizado: no es el autor de esta novedad')
    }

    // No se puede eliminar una novedad resuelta o escalada
    if (incident.status !== 'OPEN') {
      throw new Error('No se puede eliminar una novedad que ya fue resuelta o escalada')
    }

    const canEdit = await this.isWithinEditWindow(incident, incident.patrol.familyId)
    if (!canEdit) {
      throw new Error('El período de edición ha expirado')
    }

    await db.patrol_incidents.delete({ where: { id } })
  }

  // ── Obtener por ID ────────────────────────────────────────────────────────

  /**
   * Retorna una novedad con todas sus relaciones enriquecidas.
   */
  static async getById(id: string) {
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: {
        agent: { select: { id: true, name: true } },
        checkpoint: { select: { id: true, name: true, location: true } },
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
        // El ticket solo existe si la novedad fue escalada por un supervisor/admin
        ticket: { select: { id: true, ticketCode: true, status: true } },
      },
    })

    return incident
  }

  // ── Listar novedades ──────────────────────────────────────────────────────

  /**
   * Lista novedades con filtros y paginación.
   * - Agente: filtra por su agentId
   * - Admin/Supervisor: filtros completos (familia, severidad, estado, fechas, patrulla)
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

    if (agentId) where.agentId = agentId
    if (patrolId) where.patrolId = patrolId
    if (familyId) where.patrol = { familyId }
    if (severity) where.severity = severity
    if (status) where.status = status

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = dateFrom
      if (dateTo) where.createdAt.lte = dateTo
    }

    const skip = (page - 1) * limit

    const [incidents, total] = await Promise.all([
      db.patrol_incidents.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true } },
          checkpoint: { select: { id: true, name: true, location: true } },
          patrol: {
            select: {
              id: true,
              scheduledStart: true,
              familyId: true,
              family: { select: { id: true, name: true } },
              route: { select: { id: true, name: true } },
            },
          },
          photos: {
            where: { deletedAt: null },
            select: { id: true, path: true },
          },
          ticket: { select: { id: true, ticketCode: true, status: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.patrol_incidents.count({ where }),
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

  // ── Resolver novedad ──────────────────────────────────────────────────────

  /**
   * Marca una novedad como resuelta. Solo desde estado OPEN.
   * Puede ser resuelta por el supervisor o un administrador.
   */
  static async resolve(id: string, resolvedById: string) {
    const incident = await db.patrol_incidents.findUnique({ where: { id } })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    if (incident.status !== 'OPEN') {
      throw new Error('La novedad ya fue resuelta o escalada')
    }

    const updated = await db.patrol_incidents.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById,
      },
    })

    // Auditoría
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

    // Notificar al agente que reportó la novedad
    try {
      await NotificationService.push({
        userId: incident.agentId,
        type: NotificationType.INFO,
        title: 'Novedad resuelta',
        message: 'Tu novedad ha sido marcada como resuelta.',
        metadata: { incidentId: id, patrolId: incident.patrolId },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error notificando agente:', err)
    }

    return updated
  }

  // ── Escalar novedad a ticket ──────────────────────────────────────────────

  /**
   * Escala una novedad creando un ticket de soporte.
   * Solo supervisores o administradores pueden ejecutar esta acción.
   * La novedad debe estar en estado OPEN.
   *
   * @param id           - ID de la novedad a escalar
   * @param escalatedById - ID del usuario que ejecuta la acción
   * @param targetFamilyId - Familia destino del ticket (opcional).
   *   - TECHNICIAN/supervisor: siempre se usa la familia de la ronda (se ignora este param).
   *   - Admin normal: puede especificar cualquiera de sus familias asignadas.
   *     Si no se provee, se usa la familia de la ronda.
   *   - Super admin: puede especificar cualquier familia del sistema.
   *     Si no se provee, se usa la familia de la ronda.
   */
  static async escalateToTicket(id: string, escalatedById: string, targetFamilyId?: string) {
    // Obtener incidente con datos necesarios para crear el ticket
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: {
        patrol: { select: { familyId: true, id: true } },
        checkpoint: { select: { name: true } },
      },
    })

    if (!incident) {
      throw new Error('Novedad no encontrada')
    }

    if (incident.status !== 'OPEN') {
      throw new Error('La novedad ya fue resuelta o escalada')
    }

    // Resolver la familia destino del ticket:
    // Si no se provee targetFamilyId, hereda la familia de la ronda (comportamiento original).
    const resolvedFamilyId = targetFamilyId ?? incident.patrol.familyId
    const familyChanged = resolvedFamilyId !== incident.patrol.familyId

    // Buscar la categoría configurada para la familia destino, o la primera disponible.
    // Cuando se redirige a otra familia se intenta su config primero.
    const familyConfig = await prisma.patrol_family_config.findUnique({
      where: { familyId: resolvedFamilyId },
      select: { patrolIncidentCategoryId: true },
    })

    // Fallback a la familia de origen si la destino no tiene categoría configurada
    let categoryId = familyConfig?.patrolIncidentCategoryId ?? null

    if (!categoryId && familyChanged) {
      const originConfig = await prisma.patrol_family_config.findUnique({
        where: { familyId: incident.patrol.familyId },
        select: { patrolIncidentCategoryId: true },
      })
      categoryId = originConfig?.patrolIncidentCategoryId ?? null
    }

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

    // Mapear severidad de ronda a prioridad de ticket
    const severityToPriority: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
      CRITICAL: 'HIGH',
      HIGH: 'HIGH',
      MEDIUM: 'MEDIUM',
      LOW: 'LOW',
    }
    const priority = severityToPriority[incident.severity] ?? 'MEDIUM'

    // Crear el ticket en el sistema de soporte
    const ticketId = randomUUID()
    const now = new Date()

    // Título: primeras 100 chars de la descripción real de la novedad
    // Si la descripción es muy corta, se usa completa. El nombre del checkpoint
    // queda disponible en la descripción completa del ticket.
    const truncatedDescription =
      incident.description.length > 100
        ? `${incident.description.substring(0, 97)}…`
        : incident.description
    const ticketTitle = `[${incident.checkpoint.name}] ${truncatedDescription}`

    await prisma.tickets.create({
      data: {
        id: ticketId,
        title: ticketTitle,
        description: incident.description,
        status: 'OPEN',
        priority,
        source: 'PATROL',
        clientId: incident.agentId,
        categoryId,
        familyId: resolvedFamilyId,
        createdById: escalatedById,
        createdAt: now,
        updatedAt: now,
      },
    })

    // Marcar la novedad como escalada, vincularla al ticket y registrar timestamp
    const updated = await db.patrol_incidents.update({
      where: { id },
      data: { status: 'ESCALATED', ticketId, resolvedAt: now, resolvedById: escalatedById },
    })

    // Auditoría — registra si la familia fue redirigida
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
          originFamilyId: incident.patrol.familyId,
          targetFamilyId: resolvedFamilyId,
          familyRedirected: familyChanged,
        },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error en auditoría:', err)
    }

    // Informar al agente que su novedad fue escalada a ticket
    try {
      await NotificationService.push({
        userId: incident.agentId,
        type: NotificationType.INFO,
        title: 'Novedad escalada a ticket',
        message: `Tu novedad en "${incident.checkpoint.name}" ha sido escalada a un ticket para su seguimiento.`,
        metadata: { incidentId: id, patrolId: incident.patrolId, ticketId },
      })
    } catch (err) {
      console.error('[PatrolIncidentService] Error notificando agente:', err)
    }

    return { incident: updated, ticketId }
  }

  // ── Ventana de edición ────────────────────────────────────────────────────

  /**
   * Verifica si todavía se puede editar/eliminar una novedad.
   * Usa gracePeriodMinutes de la configuración del área; default 5 minutos.
   */
  static async isWithinEditWindow(
    incident: { createdAt: Date },
    familyId: string
  ): Promise<boolean> {
    const config = await prisma.patrol_family_config.findUnique({
      where: { familyId },
      select: { gracePeriodMinutes: true },
    })

    const gracePeriodMs = (config?.gracePeriodMinutes ?? 5) * 60 * 1000
    return Date.now() - incident.createdAt.getTime() <= gracePeriodMs
  }
}
