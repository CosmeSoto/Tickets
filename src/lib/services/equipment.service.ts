import { PrismaClient, EquipmentStatus, Prisma } from '@prisma/client'
import { QRCodeService } from './qr-code.service'
import type { 
  Equipment, 
  EquipmentFormData, 
  EquipmentFilters, 
  EquipmentListResponse,
  EquipmentDetailResponse,
  EquipmentHistoryEvent,
  EquipmentSummary
} from '@/types/inventory/equipment'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de equipos
 */
export class EquipmentService {
  /**
   * Crea un nuevo equipo
   */
  static async createEquipment(
    data: EquipmentFormData,
    userId: string
  ): Promise<Equipment> {
    try {
      // Verificar que el código sea único
      const existingEquipment = await prisma.equipment.findUnique({
        where: { code: data.code }
      })

      if (existingEquipment) {
        throw new Error('Ya existe un equipo con este código')
      }

      // Generar QR code único
      const qrCodeId = QRCodeService.generateUniqueQRId('EQ')

      // Crear equipo
      const equipment = await prisma.equipment.create({
        data: {
          code: data.code,
          serialNumber: data.serialNumber,
          brand: data.brand,
          model: data.model,
          type: data.type,
          status: data.status || 'AVAILABLE',
          condition: data.condition,
          ownershipType: data.ownershipType,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
          purchasePrice: data.purchasePrice,
          warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration) : undefined,
          specifications: data.specifications || {},
          accessories: data.accessories || [],
          location: data.location,
          notes: data.notes,
          qrCode: qrCodeId,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'CREATE',
          entityType: 'equipment',
          entityId: equipment.id,
          userId: userId,
          details: {
            code: equipment.code,
            type: equipment.type,
            brand: equipment.brand,
            model: equipment.model
          }
        }
      })

      return equipment as Equipment
    } catch (error) {
      console.error('Error creando equipo:', error)
      throw error
    }
  }

  /**
   * Obtiene un equipo por ID
   */
  static async getEquipmentById(id: string): Promise<Equipment | null> {
    try {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
        include: { type: true }
      })

      return equipment as Equipment | null
    } catch (error) {
      console.error('Error obteniendo equipo:', error)
      throw error
    }
  }

  /**
   * Obtiene detalles completos de un equipo
   */
  static async getEquipmentDetail(id: string): Promise<EquipmentDetailResponse> {
    try {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
        include: {
          type: true,
          assignments: {
            include: {
              receiver: { select: { id: true, name: true, email: true } },
              deliverer: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
          },
          maintenanceRecords: {
            include: {
              technician: { select: { id: true, name: true, email: true } },
              ticket: { select: { id: true, title: true } }
            },
            orderBy: { date: 'desc' }
          },
          licenses: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })

      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      // Obtener asignación actual
      const currentAssignment = equipment.assignments.find(a => a.isActive)

      // Construir historial
      const history = await this.buildEquipmentHistory(id)

      return {
        equipment: equipment as any,
        currentAssignment,
        history,
        maintenanceRecords: equipment.maintenanceRecords
      }
    } catch (error) {
      console.error('Error obteniendo detalle de equipo:', error)
      throw error
    }
  }

  /**
   * Lista equipos con filtros y paginación
   */
  static async listEquipment(
    filters: EquipmentFilters,
    page: number = 1,
    limit: number = 10,
    userId?: string,
    userRole?: string
  ): Promise<EquipmentListResponse> {
    try {
      const skip = (page - 1) * limit

      // Construir filtros
      const where: Prisma.equipmentWhereInput = {}

      // Búsqueda de texto
      if (filters.search) {
        where.OR = [
          { code: { contains: filters.search, mode: 'insensitive' } },
          { serialNumber: { contains: filters.search, mode: 'insensitive' } },
          { brand: { contains: filters.search, mode: 'insensitive' } },
          { model: { contains: filters.search, mode: 'insensitive' } }
        ]
      }

      // Filtros por tipo
      if (filters.typeId && filters.typeId.length > 0) {
        where.typeId = { in: filters.typeId }
      }

      // Filtros por estado
      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status }
      }

      // Filtros por condición
      if (filters.condition && filters.condition.length > 0) {
        where.condition = { in: filters.condition }
      }

      // Filtro por usuario asignado (solo para ADMIN y TECHNICIAN)
      if (filters.assignedTo) {
        where.assignments = {
          some: {
            receiverId: filters.assignedTo,
            isActive: true
          }
        }
      }

      // Si es CLIENT, solo ver sus equipos asignados
      if (userRole === 'CLIENT' && userId) {
        where.assignments = {
          some: {
            receiverId: userId,
            isActive: true
          }
        }
      }

      // Obtener total y equipos
      const [total, equipment] = await Promise.all([
        prisma.equipment.count({ where }),
        prisma.equipment.findMany({
          where,
          skip,
          take: limit,
          include: {
            type: true, // Incluir relación con equipment_types
          },
          orderBy: { createdAt: 'desc' }
        })
      ])

      return {
        equipment: equipment as Equipment[],
        total,
        page,
        limit
      }
    } catch (error) {
      console.error('Error listando equipos:', error)
      throw error
    }
  }

  /**
   * Actualiza un equipo
   */
  static async updateEquipment(
    id: string,
    data: Partial<EquipmentFormData>,
    userId: string
  ): Promise<Equipment> {
    try {
      const equipment = await prisma.equipment.findUnique({ where: { id } })
      
      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      // Si hay asignación activa, no permitir cambiar ciertos campos
      const hasActiveAssignment = await prisma.equipment_assignments.findFirst({
        where: { equipmentId: id, isActive: true }
      })

      if (hasActiveAssignment && data.status && data.status !== equipment.status) {
        throw new Error('No se puede cambiar el estado de un equipo con asignación activa')
      }

      const updated = await prisma.equipment.update({
        where: { id },
        data: {
          ...(data.serialNumber && { serialNumber: data.serialNumber }),
          ...(data.brand && { brand: data.brand }),
          ...(data.model && { model: data.model }),
          ...(data.type && { type: data.type }),
          ...(data.status && { status: data.status }),
          ...(data.condition && { condition: data.condition }),
          ...(data.ownershipType && { ownershipType: data.ownershipType }),
          ...(data.purchaseDate !== undefined && { 
            purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null 
          }),
          ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
          ...(data.warrantyExpiration !== undefined && { 
            warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration) : null 
          }),
          ...(data.specifications !== undefined && { specifications: data.specifications }),
          ...(data.accessories !== undefined && { accessories: data.accessories }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'UPDATE',
          entityType: 'equipment',
          entityId: id,
          userId: userId,
          details: {
            before: equipment,
            after: updated
          }
        }
      })

      return updated as Equipment
    } catch (error) {
      console.error('Error actualizando equipo:', error)
      throw error
    }
  }

  /**
   * Elimina un equipo (soft delete - marca como RETIRED)
   */
  static async deleteEquipment(id: string, userId: string): Promise<void> {
    try {
      const equipment = await prisma.equipment.findUnique({ where: { id } })
      
      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      // Verificar que no tenga asignación activa
      const hasActiveAssignment = await prisma.equipment_assignments.findFirst({
        where: { equipmentId: id, isActive: true }
      })

      if (hasActiveAssignment) {
        throw new Error('No se puede eliminar un equipo con asignación activa')
      }

      // Soft delete: cambiar estado a RETIRED
      await prisma.equipment.update({
        where: { id },
        data: { status: 'RETIRED' }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'DELETE',
          entityType: 'equipment',
          entityId: id,
          userId: userId,
          details: {
            code: equipment.code,
            reason: 'Equipo retirado'
          }
        }
      })
    } catch (error) {
      console.error('Error eliminando equipo:', error)
      throw error
    }
  }

  /**
   * Obtiene el resumen de equipos para el dashboard
   */
  static async getEquipmentSummary(): Promise<EquipmentSummary> {
    try {
      const [total, byStatus, byType, byCondition, totalValue] = await Promise.all([
        prisma.equipment.count(),
        prisma.equipment.groupBy({
          by: ['status'],
          _count: true
        }),
        prisma.equipment.groupBy({
          by: ['typeId'],
          _count: true
        }),
        prisma.equipment.groupBy({
          by: ['condition'],
          _count: true
        }),
        prisma.equipment.aggregate({
          _sum: { purchasePrice: true }
        })
      ])

      // Helper para extraer conteo de forma segura
      const getCount = (arr: any[], key: string, value: string): number => {
        return arr.find(item => item[key] === value)?._count ?? 0
      }

      return {
        total,
        available: getCount(byStatus, 'status', 'AVAILABLE'),
        assigned: getCount(byStatus, 'status', 'ASSIGNED'),
        maintenance: getCount(byStatus, 'status', 'MAINTENANCE'),
        damaged: getCount(byStatus, 'status', 'DAMAGED'),
        retired: getCount(byStatus, 'status', 'RETIRED'),
        byType: byType.reduce((acc, item) => ({ ...acc, [item.typeId]: item._count }), {} as Record<string, number>),
        byCondition: byCondition.reduce((acc, item) => ({ ...acc, [item.condition]: item._count }), {} as Record<string, number>),
        totalValue: totalValue._sum.purchasePrice ?? 0
      }
    } catch (error) {
      console.error('Error obteniendo resumen de equipos:', error)
      
      // Log detallado para debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
      
      // Retornar estructura válida con valores en cero en caso de error
      return {
        total: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
        damaged: 0,
        retired: 0,
        byType: {},
        byCondition: {},
        totalValue: 0
      }
    }
  }

  /**
   * Construye el historial de eventos de un equipo
   */
  private static async buildEquipmentHistory(equipmentId: string): Promise<EquipmentHistoryEvent[]> {
    const history: EquipmentHistoryEvent[] = []

    // Obtener eventos de auditoría
    const auditLogs = await prisma.audit_logs.findMany({
      where: {
        entityType: 'equipment',
        entityId: equipmentId
      },
      include: {
        users: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    for (const log of auditLogs) {
      history.push({
        id: log.id,
        type: log.action as any,
        description: this.getAuditLogDescription(log.action, log.details),
        userId: log.userId || undefined,
        userName: log.users?.name,
        timestamp: log.createdAt,
        metadata: log.details as any
      })
    }

    return history
  }

  /**
   * Genera descripción legible de un log de auditoría
   */
  private static getAuditLogDescription(action: string, details: any): string {
    switch (action) {
      case 'CREATE':
        return `Equipo creado: ${details?.code}`
      case 'UPDATE':
        return 'Equipo actualizado'
      case 'DELETE':
        return 'Equipo retirado'
      case 'ASSIGNED':
        return `Equipo asignado a ${details?.receiverName}`
      case 'RETURNED':
        return 'Equipo devuelto'
      default:
        return action
    }
  }
}
