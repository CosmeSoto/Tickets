import { PrismaClient } from '@prisma/client'
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
            scheduledDate: data.scheduledDate,
            completedDate: data.completedDate,
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
            completedDate: data.completedDate || new Date(),
            cost: data.cost,
            partsReplaced: data.partsReplaced,
            notes: data.notes,
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
        orderBy: { scheduledDate: 'desc' }
      })

      return records as MaintenanceRecord[]
    } catch (error) {
      console.error('Error obteniendo historial de mantenimiento:', error)
      throw error
    }
  }
}
