import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import type { MaintenanceRecord, CreateMaintenanceData, UpdateMaintenanceData } from '@/types/inventory/maintenance'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de registros de mantenimiento
 */
export class MaintenanceService {
  /**
   * Crea un registro de mantenimiento
   * Actualiza el estado del equipo a MAINTENANCE
   */
  static async createMaintenance(data: CreateMaintenanceData, userId: string): Promise<MaintenanceRecord> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Crear registro de mantenimiento
        const maintenance = await tx.maintenance_records.create({
          data: {
            equipmentId: data.equipmentId,
            type: data.type,
            description: data.description,
            date: data.scheduledDate,
            cost: data.cost,
            partsReplaced: data.partsReplaced || [],
            ticketId: data.ticketId,
            technicianId: data.technicianId,
          },
          include: {
            equipment: true,
            technician: true,
            ticket: true,
          }
        })

        // Actualizar estado del equipo a MAINTENANCE
        await tx.equipment.update({
          where: { id: data.equipmentId },
          data: { status: 'MAINTENANCE' }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'CREATE',
            entityType: 'maintenance_record',
            entityId: maintenance.id,
            userId,
            details: {
              equipmentId: data.equipmentId,
              type: data.type,
            }
          }
        })

        return maintenance
      })

      return result as MaintenanceRecord
    } catch (error) {
      console.error('Error creando registro de mantenimiento:', error)
      throw error
    }
  }

  /**
   * Completa un mantenimiento
   * Restaura el estado del equipo según su condición
   */
  static async completeMaintenance(
    id: string,
    data: UpdateMaintenanceData,
    userId: string
  ): Promise<MaintenanceRecord> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Actualizar registro
        const maintenance = await tx.maintenance_records.update({
          where: { id },
          data: {
            date: data.completedDate || new Date(),
            cost: data.cost,
            partsReplaced: data.partsReplaced,
          },
          include: {
            equipment: true,
            technician: true,
            ticket: true,
          }
        })

        // Restaurar estado del equipo a AVAILABLE
        await tx.equipment.update({
          where: { id: maintenance.equipmentId },
          data: { status: 'AVAILABLE' }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'COMPLETED',
            entityType: 'maintenance_record',
            entityId: id,
            userId,
            details: {
              cost: data.cost,
              completedDate: data.completedDate,
            }
          }
        })

        return maintenance
      })

      return result as MaintenanceRecord
    } catch (error) {
      console.error('Error completando mantenimiento:', error)
      throw error
    }
  }

  /**
   * Obtiene el historial de mantenimiento de un equipo
   */
  static async getEquipmentMaintenanceHistory(equipmentId: string): Promise<MaintenanceRecord[]> {
    try {
      const records = await prisma.maintenance_records.findMany({
        where: { equipmentId },
        include: {
          equipment: true,
          technician: true,
          ticket: true,
        },
        orderBy: { date: 'desc' }
      })

      return records as MaintenanceRecord[]
    } catch (error) {
      console.error('Error obteniendo historial de mantenimiento:', error)
      throw error
    }
  }

  /**
   * Obtiene un registro de mantenimiento por ID
   */
  static async getById(id: string) {
    const record = await prisma.maintenance_records.findUnique({
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
        ticket: { select: { id: true, title: true, status: true } },
      },
    })
    return record
  }

  /**
   * Reagenda un mantenimiento (cambia fecha y/o descripción)
   */
  static async reschedule(
    id: string,
    data: { scheduledDate: Date; description?: string },
    userId: string
  ): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.maintenance_records.findUnique({
        where: { id },
        include: { equipment: true },
      })
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
          action: 'RESCHEDULED',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
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
   * Cancela un mantenimiento y restaura el equipo a AVAILABLE
   */
  static async cancel(id: string, userId: string): Promise<MaintenanceRecord> {
    const result = await prisma.$transaction(async (tx) => {
      const maintenance = await tx.maintenance_records.findUnique({
        where: { id },
        include: { equipment: true },
      })
      if (!maintenance) throw new Error('Registro de mantenimiento no encontrado')

      // Restaurar estado del equipo a AVAILABLE
      await tx.equipment.update({
        where: { id: maintenance.equipmentId },
        data: { status: 'AVAILABLE' },
      })

      // Eliminar el registro de mantenimiento
      await tx.maintenance_records.delete({ where: { id } })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'CANCELLED',
          entityType: 'maintenance_record',
          entityId: id,
          userId,
          details: {
            equipmentId: maintenance.equipmentId,
            type: maintenance.type,
            description: maintenance.description,
          },
        },
      })

      return { ...maintenance, equipment: maintenance.equipment, technician: null, ticket: null }
    })
    return result as unknown as MaintenanceRecord
  }
}
