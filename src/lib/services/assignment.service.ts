import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import type { 
  Assignment, 
  AssignmentFormData, 
  AssignmentFilters,
  AssignmentListResponse,
  AssignmentDetailResponse
} from '@/types/inventory/assignment'

import { db as prisma } from '@/lib/server'

/**
 * Servicio para gestión de asignaciones de equipos
 */
export class AssignmentService {
  /**
   * Crea una nueva asignación
   * Valida que el equipo esté disponible y no tenga asignación activa
   */
  static async createAssignment(
    data: AssignmentFormData,
    delivererId: string
  ): Promise<Assignment> {
    try {
      // Verificar que el equipo existe y está disponible
      const equipment = await prisma.equipment.findUnique({
        where: { id: data.equipmentId }
      })

      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      if (equipment.status !== 'AVAILABLE') {
        throw new Error(`El equipo no está disponible para asignación (estado actual: ${equipment.status})`)
      }

      // Verificar que no haya asignación activa
      const activeAssignment = await prisma.equipment_assignments.findFirst({
        where: {
          equipmentId: data.equipmentId,
          isActive: true
        }
      })

      if (activeAssignment) {
        throw new Error('El equipo ya tiene una asignación activa')
      }

      // Verificar que el receptor existe
      const receiver = await prisma.users.findUnique({
        where: { id: data.receiverId }
      })

      if (!receiver) {
        throw new Error('Usuario receptor no encontrado')
      }

      // Leer configuración de familia para requireDeliveryAct
      const familyConfig = await prisma.inventory_family_config.findFirst({
        where: { family: { equipmentTypes: { some: { id: equipment.typeId } } } },
        select: { requireDeliveryAct: true },
      })
      const requireDeliveryAct = familyConfig?.requireDeliveryAct ?? true

      // Crear asignación en transacción
      const assignment = await prisma.$transaction(async (tx) => {
        // Crear asignación
        const newAssignment = await tx.equipment_assignments.create({
          data: {
            equipmentId: data.equipmentId,
            receiverId: data.receiverId,
            delivererId: delivererId,
            assignmentType: data.assignmentType,
            startDate: new Date(data.startDate),
            endDate: data.endDate ? new Date(data.endDate) : undefined,
            accessories: data.accessories || [],
            observations: data.observations,
            isActive: true,
          },
          include: {
            equipment: true,
            receiver: true,
            deliverer: true,
          }
        })

        // Actualizar estado del equipo a ASSIGNED
        await tx.equipment.update({
          where: { id: data.equipmentId },
          data: { status: 'ASSIGNED' }
        })

        // Registrar en auditoría con información de requireDeliveryAct
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'ASSIGNMENT_CREATED',
            entityType: 'equipment',
            entityId: data.equipmentId,
            userId: delivererId,
            details: {
              assignmentId: newAssignment.id,
              receiverId: data.receiverId,
              receiverName: receiver.name,
              assignmentType: data.assignmentType,
              deliveryActSkipped: !requireDeliveryAct,
            }
          }
        })

        return newAssignment
      })

      return assignment as Assignment
    } catch (error) {
      console.error('Error creando asignación:', error)
      throw error
    }
  }

  /**
   * Obtiene una asignación por ID
   */
  static async getAssignmentById(id: string): Promise<Assignment | null> {
    try {
      const assignment = await prisma.equipment_assignments.findUnique({
        where: { id },
        include: {
          equipment: true,
          receiver: true,
          deliverer: true,
          deliveryAct: true,
          returnAct: true,
        }
      })

      return assignment as Assignment | null
    } catch (error) {
      console.error('Error obteniendo asignación:', error)
      throw error
    }
  }

  /**
   * Obtiene detalles completos de una asignación
   */
  static async getAssignmentDetail(id: string): Promise<AssignmentDetailResponse> {
    try {
      const assignment = await this.getAssignmentById(id)

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      return {
        assignment,
        equipment: assignment.equipment,
        receiver: assignment.receiver,
        deliverer: assignment.deliverer,
        deliveryAct: assignment.deliveryAct,
        returnAct: assignment.returnAct,
      }
    } catch (error) {
      console.error('Error obteniendo detalle de asignación:', error)
      throw error
    }
  }

  /**
   * Lista asignaciones con filtros y paginación
   */
  static async listAssignments(
    filters: AssignmentFilters,
    page: number = 1,
    limit: number = 10
  ): Promise<AssignmentListResponse> {
    try {
      const skip = (page - 1) * limit

      // Construir filtros
      const where: Prisma.equipment_assignmentsWhereInput = {}

      if (filters.equipmentId) {
        where.equipmentId = filters.equipmentId
      }

      if (filters.receiverId) {
        where.receiverId = filters.receiverId
      }

      if (filters.delivererId) {
        where.delivererId = filters.delivererId
      }

      if (filters.assignmentType && filters.assignmentType.length > 0) {
        where.assignmentType = { in: filters.assignmentType }
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      if (filters.startDate) {
        where.startDate = { gte: filters.startDate }
      }

      if (filters.endDate) {
        where.endDate = { lte: filters.endDate }
      }

      // Obtener total y asignaciones
      const [total, assignments] = await Promise.all([
        prisma.equipment_assignments.count({ where }),
        prisma.equipment_assignments.findMany({
          where,
          skip,
          take: limit,
          include: {
            equipment: true,
            receiver: true,
            deliverer: true,
          },
          orderBy: { createdAt: 'desc' }
        })
      ])

      return {
        assignments: assignments as Assignment[],
        total,
        page,
        limit
      }
    } catch (error) {
      console.error('Error listando asignaciones:', error)
      throw error
    }
  }

  /**
   * Completa una asignación (cuando se devuelve el equipo)
   */
  static async completeAssignment(
    id: string,
    actualEndDate: Date,
    userId: string
  ): Promise<Assignment> {
    try {
      const assignment = await prisma.equipment_assignments.findUnique({
        where: { id },
        include: { equipment: true }
      })

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      if (!assignment.isActive) {
        throw new Error('La asignación ya está completada')
      }

      // Completar asignación en transacción
      const updated = await prisma.$transaction(async (tx) => {
        // Actualizar asignación
        const updatedAssignment = await tx.equipment_assignments.update({
          where: { id },
          data: {
            isActive: false,
            actualEndDate,
          },
          include: {
            equipment: true,
            receiver: true,
            deliverer: true,
          }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'RETURNED',
            entityType: 'equipment',
            entityId: assignment.equipmentId,
            userId: userId,
            details: {
              assignmentId: id,
              receiverId: assignment.receiverId,
              actualEndDate: actualEndDate.toISOString(),
            }
          }
        })

        return updatedAssignment
      })

      return updated as Assignment
    } catch (error) {
      console.error('Error completando asignación:', error)
      throw error
    }
  }

  /**
   * Devuelve un equipo — cierra la asignación activa y restaura estado AVAILABLE
   */
  static async returnEquipment(
    assignmentId: string,
    returnDate: Date,
    userId: string,
    observations?: string,
    condition?: string
  ): Promise<Assignment> {
    try {
      const assignment = await prisma.equipment_assignments.findUnique({
        where: { id: assignmentId },
        include: { equipment: true, receiver: true }
      })

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      if (!assignment.isActive) {
        throw new Error('La asignación ya está completada')
      }

      const updated = await prisma.$transaction(async (tx) => {
        // Cerrar asignación
        const updatedAssignment = await tx.equipment_assignments.update({
          where: { id: assignmentId },
          data: {
            isActive: false,
            actualEndDate: returnDate,
            ...(observations && { observations }),
          },
          include: { equipment: true, receiver: true, deliverer: true }
        })

        // Restaurar estado del equipo a AVAILABLE
        await tx.equipment.update({
          where: { id: assignment.equipmentId },
          data: {
            status: 'AVAILABLE',
            ...(condition && { condition: condition as any }),
          }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'RETURNED',
            entityType: 'equipment',
            entityId: assignment.equipmentId,
            userId,
            details: {
              assignmentId,
              receiverId: assignment.receiverId,
              receiverName: (assignment.receiver as any)?.name,
              actualEndDate: returnDate.toISOString(),
              observations: observations || null,
              condition: condition || null,
            }
          }
        })

        return updatedAssignment
      })

      return updated as Assignment
    } catch (error) {
      console.error('Error devolviendo equipo:', error)
      throw error
    }
  }

  /**
   * Cancela una asignación (cuando se rechaza el acta)
   */
  static async cancelAssignment(
    id: string,
    reason: string,
    userId: string
  ): Promise<void> {
    try {
      const assignment = await prisma.equipment_assignments.findUnique({
        where: { id },
        include: { equipment: true }
      })

      if (!assignment) {
        throw new Error('Asignación no encontrada')
      }

      // Cancelar asignación en transacción
      await prisma.$transaction(async (tx) => {
        // Marcar asignación como inactiva
        await tx.equipment_assignments.update({
          where: { id },
          data: {
            isActive: false,
            actualEndDate: new Date(),
          }
        })

        // Restaurar estado del equipo a AVAILABLE
        await tx.equipment.update({
          where: { id: assignment.equipmentId },
          data: { status: 'AVAILABLE' }
        })

        // Registrar en auditoría
        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'CANCELLED',
            entityType: 'equipment_assignment',
            entityId: id,
            userId: userId,
            details: {
              equipmentId: assignment.equipmentId,
              reason,
            }
          }
        })
      })
    } catch (error) {
      console.error('Error cancelando asignación:', error)
      throw error
    }
  }

  /**
   * Obtiene el historial de asignaciones de un equipo
   */
  static async getEquipmentAssignmentHistory(equipmentId: string): Promise<Assignment[]> {
    try {
      const assignments = await prisma.equipment_assignments.findMany({
        where: { equipmentId },
        include: {
          receiver: true,
          deliverer: true,
          deliveryAct: true,
          returnAct: true,
        },
        orderBy: { createdAt: 'desc' }
      })

      return assignments as Assignment[]
    } catch (error) {
      console.error('Error obteniendo historial de asignaciones:', error)
      throw error
    }
  }

  /**
   * Obtiene las asignaciones activas de un usuario
   */
  static async getUserActiveAssignments(userId: string): Promise<Assignment[]> {
    try {
      const assignments = await prisma.equipment_assignments.findMany({
        where: {
          receiverId: userId,
          isActive: true
        },
        include: {
          equipment: true,
          deliverer: true,
          deliveryAct: true,
        },
        orderBy: { createdAt: 'desc' }
      })

      return assignments as Assignment[]
    } catch (error) {
      console.error('Error obteniendo asignaciones del usuario:', error)
      throw error
    }
  }
}
