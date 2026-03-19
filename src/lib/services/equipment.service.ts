import { PrismaClient, EquipmentStatus, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
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
          typeId: data.typeId,
          status: data.status || 'AVAILABLE',
          condition: data.condition,
          ownershipType: data.ownershipType,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate as string | number) : undefined,
          purchasePrice: data.purchasePrice,
          warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration as string | number) : undefined,
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
          id: randomUUID(),
          action: 'CREATE',
          entityType: 'equipment',
          entityId: equipment.id,
          userId: userId,
          details: {
            code: equipment.code,
            typeId: equipment.typeId,
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
          ...(data.typeId && { typeId: data.typeId }),
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

      // Registrar en auditoría con cambios legibles
      const changedFields: Record<string, { antes: any; después: any }> = {}
      const fieldLabels: Record<string, string> = {
        serialNumber: 'Número de Serie',
        brand: 'Marca',
        model: 'Modelo',
        typeId: 'Tipo',
        status: 'Estado',
        condition: 'Condición',
        ownershipType: 'Tipo de Propiedad',
        purchaseDate: 'Fecha de Compra',
        purchasePrice: 'Precio de Compra',
        warrantyExpiration: 'Vencimiento de Garantía',
        location: 'Ubicación',
        notes: 'Notas',
        accessories: 'Accesorios',
        specifications: 'Especificaciones',
      }

      for (const key of Object.keys(data)) {
        const oldVal = (equipment as any)[key]
        const newVal = (updated as any)[key]
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal) && fieldLabels[key]) {
          changedFields[fieldLabels[key]] = { antes: oldVal ?? '—', después: newVal ?? '—' }
        }
      }

      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'UPDATE',
          entityType: 'equipment',
          entityId: id,
          userId: userId,
          details: {
            code: updated.code,
            changes: changedFields,
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
          id: randomUUID(),
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
   * Elimina permanentemente un equipo de la base de datos.
   * Solo ADMIN. Requiere estado RETIRED y sin asignaciones activas.
   */
  static async permanentDeleteEquipment(id: string, userId: string): Promise<void> {
    try {
      const equipment = await prisma.equipment.findUnique({ where: { id } })

      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      if (equipment.status !== 'RETIRED') {
        throw new Error('Solo se pueden eliminar permanentemente equipos retirados')
      }

      const hasActiveAssignment = await prisma.equipment_assignments.findFirst({
        where: { equipmentId: id, isActive: true }
      })

      if (hasActiveAssignment) {
        throw new Error('No se puede eliminar un equipo con asignación activa')
      }

      const equipmentData = {
        code: equipment.code,
        serialNumber: equipment.serialNumber,
        brand: equipment.brand,
        model: equipment.model,
        typeId: equipment.typeId,
      }

      await prisma.$transaction(async (tx) => {
        const assignments = await tx.equipment_assignments.findMany({
          where: { equipmentId: id },
          select: { id: true }
        })
        const assignmentIds = assignments.map(a => a.id)

        if (assignmentIds.length > 0) {
          await tx.delivery_acts.deleteMany({ where: { assignmentId: { in: assignmentIds } } })
          await tx.return_acts.deleteMany({ where: { assignmentId: { in: assignmentIds } } })
        }

        await tx.maintenance_records.deleteMany({ where: { equipmentId: id } })
        await tx.equipment_assignments.deleteMany({ where: { equipmentId: id } })
        await tx.equipment.delete({ where: { id } })

        await tx.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'PERMANENT_DELETE',
            entityType: 'equipment',
            entityId: id,
            userId,
            details: equipmentData,
          }
        })
      })
    } catch (error) {
      console.error('Error eliminando equipo permanentemente:', error)
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

    // Acciones duplicadas del AuditServiceComplete que ya se registran desde el servicio
    const duplicateActions = new Set([
      'equipment_created', 'equipment_updated', 'equipment_deleted',
      'equipment_status_changed', 'assignment_created',
    ])

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

    // Deduplicar: agrupar por timestamp (mismo segundo) y quedarse con el más descriptivo
    const seen = new Map<string, boolean>()

    for (const log of auditLogs) {
      // Saltar acciones duplicadas del AuditServiceComplete
      if (duplicateActions.has(log.action)) continue

      // Deduplicar por acción + timestamp (mismo minuto)
      const timeKey = `${log.action}_${Math.floor(log.createdAt.getTime() / 60000)}`
      if (seen.has(timeKey)) continue
      seen.set(timeKey, true)

      const details = log.details as any

      // Construir metadata legible (sin objetos anidados)
      const metadata: Record<string, string> = {}

      if (log.action === 'UPDATE' && details?.changes) {
        for (const [field, change] of Object.entries(details.changes as Record<string, any>)) {
          const antes = this.formatValue(change?.antes)
          const después = this.formatValue(change?.después)
          metadata[field] = `${antes} → ${después}`
        }
      } else if (log.action === 'ASSIGNED') {
        if (details?.receiverName) metadata['Asignado a'] = details.receiverName
        if (details?.assignmentType) {
          const typeLabels: Record<string, string> = { PERMANENT: 'Permanente', TEMPORARY: 'Temporal', LOAN: 'Préstamo' }
          metadata['Tipo'] = typeLabels[details.assignmentType] || details.assignmentType
        }
      } else if (log.action === 'RETURNED') {
        if (details?.actualEndDate) metadata['Fecha de devolución'] = new Date(details.actualEndDate).toLocaleDateString('es-ES')
      }

      history.push({
        id: log.id,
        type: this.mapActionToEventType(log.action),
        description: this.getAuditLogDescription(log.action, details),
        userId: log.userId || undefined,
        userName: log.users?.name,
        timestamp: log.createdAt,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      })
    }

    return history
  }

  /**
   * Mapea acciones de auditoría a tipos de evento del historial
   */
  private static mapActionToEventType(action: string): string {
    const map: Record<string, string> = {
      CREATE: 'CREATED',
      UPDATE: 'UPDATED',
      DELETE: 'STATUS_CHANGE',
      PERMANENT_DELETE: 'STATUS_CHANGE',
      ASSIGNED: 'ASSIGNED',
      RETURNED: 'RETURNED',
      CANCELLED: 'RETURNED',
      CREATE_MAINTENANCE: 'MAINTENANCE',
      COMPLETED: 'MAINTENANCE',
    }
    return map[action] || 'UPDATED'
  }

  /**
   * Formatea un valor para mostrar en el historial de forma legible
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined || value === '—') return '—'
    if (value instanceof Date) return new Date(value).toLocaleDateString('es-ES')
    if (typeof value === 'object') {
      if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—'
      // Para objetos, intentar mostrar algo legible
      try {
        const entries = Object.entries(value)
        if (entries.length === 0) return '—'
        return entries.map(([k, v]) => `${k}: ${v}`).join(', ')
      } catch {
        return '—'
      }
    }
    // Traducir valores de enums comunes
    const labels: Record<string, string> = {
      AVAILABLE: 'Disponible', ASSIGNED: 'Asignado', MAINTENANCE: 'Mantenimiento',
      DAMAGED: 'Dañado', RETIRED: 'Retirado',
      NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
      FIXED_ASSET: 'Activo Fijo', RENTAL: 'Alquiler', LOAN: 'Préstamo',
    }
    return labels[String(value)] || String(value)
  }

  /**
   * Genera descripción legible de un log de auditoría
   */
  private static getAuditLogDescription(action: string, details: any): string {
    switch (action) {
      case 'CREATE':
        return `Equipo registrado: ${details?.code || ''} — ${details?.brand || ''} ${details?.model || ''}`
      case 'UPDATE': {
        const changes = details?.changes
        if (changes && typeof changes === 'object') {
          const fields = Object.keys(changes)
          if (fields.length === 0) return 'Equipo actualizado (sin cambios detectados)'
          return `Equipo actualizado — Se modificó: ${fields.join(', ')}`
        }
        return 'Equipo actualizado'
      }
      case 'DELETE':
        return 'Equipo retirado del inventario'
      case 'PERMANENT_DELETE':
        return `Equipo eliminado permanentemente: ${details?.code || ''} (${details?.brand || ''} ${details?.model || ''})`
      case 'ASSIGNED':
        return `Equipo asignado a ${details?.receiverName || 'un usuario'}`
      case 'RETURNED':
        return 'Equipo devuelto al inventario'
      case 'CANCELLED':
        return `Asignación cancelada${details?.reason ? ': ' + details.reason : ''}`
      case 'CREATE_MAINTENANCE':
      case 'MAINTENANCE':
        return `Mantenimiento ${details?.type === 'PREVENTIVE' ? 'preventivo' : 'correctivo'} registrado`
      case 'COMPLETED':
        return 'Mantenimiento completado'
      default:
        // Manejar acciones con formato snake_case del AuditServiceComplete
        if (action.includes('_')) {
          const readable = action
            .replace('equipment_', 'Equipo ')
            .replace('assignment_', 'Asignación ')
            .replace('_', ' ')
          return readable.charAt(0).toUpperCase() + readable.slice(1)
        }
        return action
    }
  }
}
