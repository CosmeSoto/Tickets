import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type {
  MaintenanceRecord,
  CreateMaintenanceData,
  UpdateMaintenanceData,
} from '@/types/inventory/maintenance'

/**
 * Servicio para gestión de registros de mantenimiento
 * Flujo de estados:
 *   REQUESTED (cliente solicita) → SCHEDULED (admin/técnico programa, equipo → MAINTENANCE)
 *   → ACCEPTED (cliente acepta) → COMPLETED (técnico completa, equipo → AVAILABLE/ASSIGNED)
 *   O CANCELLED en cualquier punto
 */
export class MaintenanceService {
  /**
   * Valida que un equipo pueda entrar en mantenimiento
   */
  private static async validateEquipmentForMaintenance(
    equipmentId: string,
    tx: any
  ): Promise<{ valid: boolean; reason?: string; warning?: string }> {
    const equipment = await tx.equipment.findUnique({
      where: { id: equipmentId },
      select: { status: true, code: true },
    })

    if (!equipment) {
      return { valid: false, reason: 'Equipo no encontrado' }
    }

    // Estados que NO permiten mantenimiento
    const invalidStatuses = ['RETIRED', 'SOLD', 'FOR_SALE']
    if (invalidStatuses.includes(equipment.status)) {
      return {
        valid: false,
        reason: `El equipo ${equipment.code} está en estado ${equipment.status} y no puede recibir mantenimiento`,
      }
    }

    // Verificar si ya tiene mantenimiento activo
    if (equipment.status === 'MAINTENANCE') {
      const existingMaintenance = await tx.maintenance_records.findFirst({
        where: {
          equipmentId,
          status: { in: ['SCHEDULED', 'ACCEPTED'] },
        },
      })
      if (existingMaintenance) {
        return {
          valid: false,
          reason: `El equipo ${equipment.code} ya tiene un mantenimiento activo`,
        }
      }
    }

    // Advertencia si está asignado
    if (equipment.status === 'ASSIGNED') {
      return {
        valid: true,
        warning: `El equipo ${equipment.code} está asignado a un usuario. Se notificará al usuario sobre el mantenimiento.`,
      }
    }

    return { valid: true }
  }
  /**
   * Admin/Técnico crea un mantenimiento directamente (SCHEDULED)
   * El equipo pasa a MAINTENANCE inmediatamente
   */
  static async createMaintenance(
    data: CreateMaintenanceData,
    userId: string
  ): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async tx => {
      // Validar que el equipo pueda entrar en mantenimiento
      const validation = await this.validateEquipmentForMaintenance(data.equipmentId, tx)
      if (!validation.valid) {
        throw new Error(validation.reason)
      }

      const equipment = await tx.equipment.findUnique({
        where: { id: data.equipmentId },
        select: { status: true },
      })

      const equipmentFull = await tx.equipment.findUnique({
        where: { id: data.equipmentId },
        select: { status: true, departmentId: true },
      })

      const maintenance = await tx.maintenance_records.create({
        data: {
          equipmentId: data.equipmentId,
          type: data.type,
          description: data.description,
          date: data.scheduledDate,
          cost: data.cost,
          partsReplaced: data.partsReplaced || [],
          ticketId: data.ticketId,
          technicianId: data.technicianId || userId,
          supplierId: data.supplierId || null,
          requestedById: data.requestedById,
          status: 'SCHEDULED',
          notes: data.notes,
          previousStatus: equipment?.status ?? null,
          previousDepartmentId: equipmentFull?.departmentId ?? null,
        },
        include: { equipment: true, technician: true, supplier: true, ticket: true },
      })

      await tx.equipment.update({
        where: { id: data.equipmentId },
        data: { status: 'MAINTENANCE' },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_START',
          entityType: 'maintenance_record',
          entityId: maintenance.id,
          userId,
          details: {
            descripcion: `Se programó mantenimiento ${data.type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para el equipo ${(maintenance as any).equipment?.code || data.equipmentId}. Fecha: ${new Date(data.scheduledDate).toLocaleDateString('es-EC')}. Motivo: ${data.description}${validation.warning ? ` NOTA: ${validation.warning}` : ''}`,
            equipmentId: data.equipmentId,
            type: data.type,
            scheduledDate: data.scheduledDate,
            supplierId: data.supplierId || null,
            supplierName: (maintenance as any).supplier?.name || null,
            previousStatus: equipment?.status ?? null,
            warning: validation.warning,
          },
        },
      })

      return maintenance
    })

    return result as MaintenanceRecord
  }

  /**
   * Cliente solicita mantenimiento de su equipo asignado (REQUESTED)
   * El equipo NO cambia de estado todavía
   */
  static async requestMaintenance(
    data: CreateMaintenanceData,
    userId: string
  ): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async tx => {
      // Verificar que el equipo está asignado al cliente
      const assignment = await tx.equipment_assignments.findFirst({
        where: { equipmentId: data.equipmentId, receiverId: userId, isActive: true },
      })
      if (!assignment) {
        throw new Error('No tienes este equipo asignado')
      }

      const maintenance = await tx.maintenance_records.create({
        data: {
          equipmentId: data.equipmentId,
          type: data.type,
          description: data.description,
          date: data.scheduledDate,
          partsReplaced: [],
          requestedById: userId,
          status: 'REQUESTED',
          notes: data.notes,
        },
        include: { equipment: true, technician: true, ticket: true },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_REQUESTED',
          entityType: 'maintenance_record',
          entityId: maintenance.id,
          userId,
          details: {
            descripcion: `El usuario solicitó mantenimiento ${data.type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para el equipo ${(maintenance as any).equipment?.code || data.equipmentId}. Motivo: ${data.description}. Fecha sugerida: ${new Date(data.scheduledDate).toLocaleDateString('es-EC')}`,
            equipmentId: data.equipmentId,
            type: data.type,
            description: data.description,
          },
        },
      })

      return maintenance
    })

    return result as MaintenanceRecord
  }

  /**
   * Admin/Técnico aprueba y programa una solicitud de mantenimiento (REQUESTED → SCHEDULED)
   * El equipo pasa a MAINTENANCE
   */
  static async approveMaintenance(
    id: string,
    data: { scheduledDate: Date; technicianId?: string; notes?: string },
    userId: string
  ): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.maintenance_records.findUnique({
        where: { id },
        include: { equipment: true },
      })
      if (!existing) throw new Error('Registro de mantenimiento no encontrado')
      if (existing.status !== 'REQUESTED')
        throw new Error('Solo se pueden aprobar solicitudes en estado REQUESTED')

      const equipmentFull = await tx.equipment.findUnique({
        where: { id: existing.equipmentId },
        select: { status: true, departmentId: true },
      })

      const maintenance = await tx.maintenance_records.update({
        where: { id },
        data: {
          status: 'SCHEDULED',
          date: data.scheduledDate,
          technicianId: data.technicianId || userId,
          notes: data.notes,
          previousStatus: existing.equipment.status,
          previousDepartmentId: equipmentFull?.departmentId ?? null,
        },
        include: { equipment: true, technician: true, ticket: true },
      })

      await tx.equipment.update({
        where: { id: existing.equipmentId },
        data: { status: 'MAINTENANCE' },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_START',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
            descripcion: `Se aprobó la solicitud de mantenimiento del equipo ${existing.equipment.code}. Fecha programada: ${new Date(data.scheduledDate).toLocaleDateString('es-EC')}. El equipo pasó a estado "En mantenimiento".`,
            scheduledDate: data.scheduledDate,
            technicianId: data.technicianId || userId,
            previousStatus: existing.equipment.status,
          },
        },
      })

      return maintenance
    })

    return result as MaintenanceRecord
  }

  /**
   * Cliente acepta/confirma el mantenimiento programado (SCHEDULED → ACCEPTED)
   */
  static async acceptMaintenance(id: string, userId: string): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.maintenance_records.findUnique({ where: { id } })
      if (!existing) throw new Error('Registro de mantenimiento no encontrado')
      if (existing.status !== 'SCHEDULED')
        throw new Error('Solo se pueden aceptar mantenimientos en estado SCHEDULED')

      const maintenance = await tx.maintenance_records.update({
        where: { id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
        include: { equipment: true, technician: true, ticket: true },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_ACCEPTED',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
            descripcion: `El usuario confirmó y aceptó el mantenimiento programado.`,
            acceptedAt: new Date(),
          },
        },
      })

      return maintenance
    })

    return result as MaintenanceRecord
  }

  /**
   * Completa un mantenimiento (SCHEDULED/ACCEPTED → COMPLETED)
   * returnTo: 'available' (bodega) | 'previous_user' (reasignar al último usuario)
   */
  static async completeMaintenance(
    id: string,
    data: UpdateMaintenanceData & { returnTo?: 'available' | 'previous_user' },
    userId: string
  ): Promise<MaintenanceRecord & { reAssigned?: boolean }> {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.maintenance_records.findUnique({
        where: { id },
        include: {
          equipment: {
            include: {
              assignments: {
                where: { isActive: false },
                orderBy: { updatedAt: 'desc' },
                take: 1,
                include: { receiver: true },
              },
            },
          },
        },
      })
      if (!existing) throw new Error('Registro de mantenimiento no encontrado')

      const allowedStatuses = ['SCHEDULED', 'ACCEPTED']
      if (!allowedStatuses.includes(existing.status)) {
        throw new Error('El mantenimiento ya fue completado o cancelado')
      }

      const maintenance = await tx.maintenance_records.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          ...(data.cost !== undefined && { cost: data.cost }),
          ...(data.partsReplaced && { partsReplaced: data.partsReplaced }),
          ...(data.notes && { notes: data.notes }),
          ...(data.supplierInvoice && { supplierInvoice: data.supplierInvoice }),
          ...(data.warrantyExpiresAt && { warrantyExpiresAt: data.warrantyExpiresAt }),
        },
        include: { equipment: true, technician: true, supplier: true, ticket: true },
      })

      let reAssigned = false

      if (data.returnTo === 'previous_user') {
        const lastAssignment = existing.equipment.assignments?.[0]
        if (lastAssignment) {
          const receiver = await tx.users.findUnique({
            where: { id: lastAssignment.receiverId },
          })
          await tx.equipment_assignments.create({
            data: {
              equipmentId: existing.equipmentId,
              receiverId: lastAssignment.receiverId,
              delivererId: userId,
              assignmentType: lastAssignment.assignmentType,
              startDate: new Date(),
              accessories: lastAssignment.accessories,
              observations: `Reasignado tras mantenimiento completado el ${new Date().toLocaleDateString('es-ES')}`,
              isActive: true,
            },
          })
          await tx.equipment.update({
            where: { id: existing.equipmentId },
            data: {
              status: 'ASSIGNED',
              departmentId: (receiver as any).departmentId ?? null,
            },
          })
          await tx.audit_logs.create({
            data: {
              id: randomUUID(),
              action: 'ASSIGNED',
              entityType: 'equipment',
              entityId: existing.equipmentId,
              userId,
              details: {
                descripcion: `El equipo ${existing.equipment.code} fue reasignado a ${(lastAssignment.receiver as any)?.name || lastAssignment.receiverId} tras completar el mantenimiento.`,
                receiverId: lastAssignment.receiverId,
                receiverName: (lastAssignment.receiver as any)?.name,
                reason: 'Reasignado tras mantenimiento',
              },
            },
          })
          reAssigned = true
        } else {
          await tx.equipment.update({
            where: { id: existing.equipmentId },
            data: {
              status: 'AVAILABLE',
              departmentId: null,
            },
          })
        }
      } else {
        const statusToRestore = (existing as any).previousStatus ?? 'AVAILABLE'
        const departmentToRestore = (existing as any).previousDepartmentId ?? null

        let finalDepartmentId = departmentToRestore
        if (statusToRestore === 'AVAILABLE') {
          finalDepartmentId = null
        }

        await tx.equipment.update({
          where: { id: existing.equipmentId },
          data: {
            status: statusToRestore,
            departmentId: finalDepartmentId,
          },
        })
      }

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_END',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
            descripcion: `Mantenimiento completado para el equipo ${existing.equipment.code}. ${data.returnTo === 'previous_user' ? 'El equipo fue reasignado al usuario anterior.' : 'El equipo quedó disponible en bodega.'}${data.cost ? ` Costo: $${data.cost}.` : ''}${data.partsReplaced?.length ? ` Partes reemplazadas: ${data.partsReplaced.join(', ')}.` : ''}`,
            cost: data.cost,
            completedAt: new Date().toISOString(),
            returnTo: data.returnTo || 'available',
            previousStatus: (existing as any).previousStatus ?? null,
            restoredStatus:
              data.returnTo === 'previous_user'
                ? 'ASSIGNED'
                : ((existing as any).previousStatus ?? 'AVAILABLE'),
          },
        },
      })

      return { ...maintenance, reAssigned }
    })

    return result as MaintenanceRecord & { reAssigned?: boolean }
  }

  /**
   * Cancela un mantenimiento y restaura el equipo a AVAILABLE (si estaba en MAINTENANCE)
   */
  static async cancel(id: string, userId: string): Promise<void> {
    await prisma.$transaction(async tx => {
      const maintenance = await tx.maintenance_records.findUnique({
        where: { id },
        include: { equipment: true },
      })
      if (!maintenance) throw new Error('Registro de mantenimiento no encontrado')

      // Solo restaurar equipo si estaba en MAINTENANCE (no si era solo REQUESTED)
      if (maintenance.status !== 'REQUESTED') {
        await tx.equipment.update({
          where: { id: maintenance.equipmentId },
          data: {
            status: 'AVAILABLE',
            departmentId: null,
          },
        })
      }

      await tx.maintenance_records.update({
        where: { id },
        data: { status: 'CANCELLED' },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_CANCELLED',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
            descripcion: `Se canceló el mantenimiento del equipo ${maintenance.equipment.code}. Estado anterior: ${maintenance.status === 'REQUESTED' ? 'Solicitado' : maintenance.status === 'SCHEDULED' ? 'Programado' : 'Aceptado'}.${maintenance.status !== 'REQUESTED' ? ' El equipo volvió a estar disponible.' : ''}`,
            equipmentId: maintenance.equipmentId,
            previousStatus: maintenance.status,
          },
        },
      })
    })
  }

  /**
   * Reagenda un mantenimiento (cambia fecha y/o descripción)
   */
  static async reschedule(
    id: string,
    data: { scheduledDate: Date; description?: string },
    userId: string
  ): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async tx => {
      const existing = await tx.maintenance_records.findUnique({ where: { id } })
      if (!existing) throw new Error('Registro de mantenimiento no encontrado')

      const maintenance = await tx.maintenance_records.update({
        where: { id },
        data: {
          date: data.scheduledDate,
          ...(data.description && { description: data.description }),
        },
        include: { equipment: true, technician: true, ticket: true },
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'MAINTENANCE_RESCHEDULED',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
            descripcion: `Se reagendó el mantenimiento del equipo. Fecha anterior: ${new Date(existing.date).toLocaleDateString('es-EC')}. Nueva fecha: ${new Date(data.scheduledDate).toLocaleDateString('es-EC')}.`,
            previousDate: existing.date.toISOString(),
            newDate: data.scheduledDate.toISOString(),
          },
        },
      })

      return maintenance
    })
    return result as MaintenanceRecord
  }

  /**
   * Crea mantenimiento para todos los equipos de un modelo
   */
  static async createMaintenanceByModel(
    data: {
      modelId: string
      type: 'PREVENTIVE' | 'CORRECTIVE'
      description: string
      scheduledDate: Date
      technicianId?: string
      statusFilter?: string[]
      familyId?: string
      cost?: number
      notes?: string
    },
    userId: string
  ): Promise<{ created: MaintenanceRecord[]; skipped: Array<{ code: string; reason: string }> }> {
    const equipment = await prisma.equipment.findMany({
      where: {
        modelId: data.modelId,
        status: data.statusFilter
          ? { in: data.statusFilter as any }
          : { notIn: ['RETIRED', 'SOLD'] },
        // Familia vive en el tipo del equipo (equipment no tiene familyId)
        ...(data.familyId ? { type: { familyId: data.familyId } } : {}),
      },
      select: { id: true, code: true, status: true },
    })

    const created: MaintenanceRecord[] = []
    const skipped: Array<{ code: string; reason: string }> = []

    for (const eq of equipment) {
      try {
        const maintenance = await this.createMaintenance(
          {
            equipmentId: eq.id,
            type: data.type,
            description: data.description,
            scheduledDate: data.scheduledDate,
            technicianId: data.technicianId,
            cost: data.cost,
            notes: data.notes,
          },
          userId
        )
        created.push(maintenance)
      } catch (error) {
        skipped.push({
          code: eq.code,
          reason: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    // Auditoría de la operación masiva
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'MAINTENANCE_BULK_CREATE',
        entityType: 'equipment_model',
        entityId: data.modelId,
        userId,
        details: {
          descripcion: `Se creó mantenimiento ${data.type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para ${created.length} equipos del modelo. ${skipped.length > 0 ? `${skipped.length} equipos omitidos.` : ''}`,
          modelId: data.modelId,
          type: data.type,
          created: created.length,
          skipped: skipped.length,
          scheduledDate: data.scheduledDate,
        },
      },
    })

    return { created, skipped }
  }

  /**
   * Crea mantenimiento para todos los equipos de un tipo (ej. Laptops, Impresoras).
   */
  static async createMaintenanceByType(
    data: {
      typeId: string
      type: 'PREVENTIVE' | 'CORRECTIVE'
      description: string
      scheduledDate: Date
      technicianId?: string
      statusFilter?: string[]
      familyId?: string
      cost?: number
      notes?: string
    },
    userId: string
  ): Promise<{ created: MaintenanceRecord[]; skipped: Array<{ code: string; reason: string }> }> {
    const equipment = await prisma.equipment.findMany({
      where: {
        typeId: data.typeId,
        status: data.statusFilter
          ? { in: data.statusFilter as any }
          : { notIn: ['RETIRED', 'SOLD'] },
        ...(data.familyId ? { type: { familyId: data.familyId } } : {}),
      },
      select: { id: true, code: true, status: true },
    })

    const created: MaintenanceRecord[] = []
    const skipped: Array<{ code: string; reason: string }> = []

    for (const eq of equipment) {
      try {
        const maintenance = await this.createMaintenance(
          {
            equipmentId: eq.id,
            type: data.type,
            description: data.description,
            scheduledDate: data.scheduledDate,
            technicianId: data.technicianId,
            cost: data.cost,
            notes: data.notes,
          },
          userId
        )
        created.push(maintenance)
      } catch (error) {
        skipped.push({
          code: eq.code,
          reason: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'MAINTENANCE_BULK_CREATE',
        entityType: 'equipment_type',
        entityId: data.typeId,
        userId,
        details: {
          descripcion: `Se creó mantenimiento ${data.type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para ${created.length} equipos del tipo. ${skipped.length > 0 ? `${skipped.length} equipos omitidos.` : ''}`,
          typeId: data.typeId,
          maintenanceType: data.type,
          created: created.length,
          skipped: skipped.length,
          scheduledDate: data.scheduledDate,
        },
      },
    })

    return { created, skipped }
  }

  /**
   * Crea mantenimiento para todos los equipos de un lote
   */
  static async createMaintenanceByBatch(
    data: {
      batchId: string
      type: 'PREVENTIVE' | 'CORRECTIVE'
      description: string
      scheduledDate: Date
      technicianId?: string
      cost?: number
      notes?: string
    },
    userId: string
  ): Promise<{ created: MaintenanceRecord[]; skipped: Array<{ code: string; reason: string }> }> {
    const equipment = await prisma.equipment.findMany({
      where: {
        batchId: data.batchId,
        status: { notIn: ['RETIRED', 'SOLD'] },
      },
      select: { id: true, code: true, status: true },
    })

    const created: MaintenanceRecord[] = []
    const skipped: Array<{ code: string; reason: string }> = []

    for (const eq of equipment) {
      try {
        const maintenance = await this.createMaintenance(
          {
            equipmentId: eq.id,
            type: data.type,
            description: data.description,
            scheduledDate: data.scheduledDate,
            technicianId: data.technicianId,
            cost: data.cost,
            notes: data.notes,
          },
          userId
        )
        created.push(maintenance)
      } catch (error) {
        skipped.push({
          code: eq.code,
          reason: error instanceof Error ? error.message : 'Error desconocido',
        })
      }
    }

    // Auditoría de la operación masiva
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'MAINTENANCE_BULK_CREATE',
        entityType: 'equipment_batch',
        entityId: data.batchId,
        userId,
        details: {
          descripcion: `Se creó mantenimiento ${data.type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} para ${created.length} equipos del lote. ${skipped.length > 0 ? `${skipped.length} equipos omitidos.` : ''}`,
          batchId: data.batchId,
          type: data.type,
          created: created.length,
          skipped: skipped.length,
          scheduledDate: data.scheduledDate,
        },
      },
    })

    return { created, skipped }
  }

  /**
   * Obtiene estadísticas de mantenimiento por modelo
   */
  static async getMaintenanceStatsByModel(modelId: string) {
    const [total, byType, byStatus, avgCost, recentMaintenances] = await Promise.all([
      prisma.maintenance_records.count({
        where: { equipment: { modelId } },
      }),
      prisma.maintenance_records.groupBy({
        by: ['type'],
        where: { equipment: { modelId } },
        _count: true,
      }),
      prisma.maintenance_records.groupBy({
        by: ['status'],
        where: { equipment: { modelId } },
        _count: true,
      }),
      prisma.maintenance_records.aggregate({
        where: { equipment: { modelId }, cost: { not: null } },
        _avg: { cost: true },
        _sum: { cost: true },
      }),
      prisma.maintenance_records.findMany({
        where: { equipment: { modelId } },
        include: { equipment: { select: { code: true } }, technician: { select: { name: true } } },
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ])

    return {
      total,
      byType: Object.fromEntries(byType.map(t => [t.type, t._count])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      avgCost: avgCost._avg.cost || 0,
      totalCost: avgCost._sum.cost || 0,
      recentMaintenances,
    }
  }

  /**
   * Obtiene estadísticas de mantenimiento por lote
   */
  static async getMaintenanceStatsByBatch(batchId: string) {
    const [total, byType, byStatus, avgCost] = await Promise.all([
      prisma.maintenance_records.count({
        where: { equipment: { batchId } },
      }),
      prisma.maintenance_records.groupBy({
        by: ['type'],
        where: { equipment: { batchId } },
        _count: true,
      }),
      prisma.maintenance_records.groupBy({
        by: ['status'],
        where: { equipment: { batchId } },
        _count: true,
      }),
      prisma.maintenance_records.aggregate({
        where: { equipment: { batchId }, cost: { not: null } },
        _avg: { cost: true },
        _sum: { cost: true },
      }),
    ])

    return {
      total,
      byType: Object.fromEntries(byType.map(t => [t.type, t._count])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      avgCost: avgCost._avg.cost || 0,
      totalCost: avgCost._sum.cost || 0,
    }
  }

  /**
   * Obtiene el historial de mantenimiento de un equipo
   */
  static async getEquipmentMaintenanceHistory(equipmentId: string): Promise<MaintenanceRecord[]> {
    const records = await prisma.maintenance_records.findMany({
      where: { equipmentId },
      include: { equipment: true, technician: true, ticket: true },
      orderBy: { date: 'desc' },
    })
    return records as MaintenanceRecord[]
  }

  /**
   * Obtiene un registro de mantenimiento por ID
   */
  static async getById(id: string) {
    return prisma.maintenance_records.findUnique({
      where: { id },
      include: {
        equipment: {
          include: {
            type: true,
            assignments: {
              where: { isActive: true },
              include: { receiver: { select: { id: true, name: true, email: true } } },
              take: 1,
            },
          },
        },
        technician: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, name: true, phone: true, email: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        ticket: { select: { id: true, title: true, status: true } },
      },
    })
  }
}
