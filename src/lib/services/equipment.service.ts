import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { QRCodeService } from './qr-code.service'
import type {
  Equipment,
  EquipmentFormData,
  EquipmentFilters,
  EquipmentListResponse,
  EquipmentDetailResponse,
  EquipmentHistoryEvent,
  EquipmentSummary,
} from '@/types/inventory/equipment'
import type { BatchMetrics } from '@/types/inventory/batch-inventory'
import { db as prisma } from '@/lib/server'
import { getLinkedBusinessContractId } from '@/lib/inventory/equipment-contract'

/**
 * Servicio para gestión de equipos
 */
export class EquipmentService {
  /**
   * Crea un nuevo equipo
   */
  static async createEquipment(data: EquipmentFormData, userId: string): Promise<Equipment> {
    try {
      // Verificar que el código sea único
      const existingEquipment = await prisma.equipment.findUnique({
        where: { code: data.code },
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
          modelDeprecated: data.model,
          condition: data.condition as any,
          ownershipType: data.ownershipType as any,
          purchaseDate: data.purchaseDate
            ? new Date(data.purchaseDate as string | number)
            : undefined,
          purchasePrice: data.purchasePrice,
          warrantyExpiration: data.warrantyExpiration
            ? new Date(data.warrantyExpiration as string | number)
            : undefined,
          accessories: data.accessories || [],
          customValues: (data as any).customValues || [],
          location: data.location,
          notes: data.notes,
          qrCode: qrCodeId,
          estimatedPrice: (data as any).estimatedPrice,
          ...((data as any).departmentId !== undefined && {
            departmentId: (data as any).departmentId,
          }),
        } as any,
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
            model: equipment.modelDeprecated,
          },
        },
      })

      return equipment as unknown as Equipment
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
        include: { type: true },
      })

      return equipment as unknown as Equipment | null
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
      const equipment = await (prisma.equipment.findUnique as any)({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true, taxId: true } },
          type: { include: { family: true } },
          model: { include: { brand: true } },
          warehouse: true,
          customValues: true,
          assignments: {
            include: {
              receiver: { select: { id: true, name: true, email: true } },
              deliverer: { select: { id: true, name: true, email: true } },
              deliveryAct: {
                select: { id: true, status: true, folio: true, expirationDate: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          maintenanceRecords: {
            include: {
              technician: { select: { id: true, name: true, email: true } },
              ticket: { select: { id: true, title: true } },
            },
            orderBy: { date: 'desc' },
          },
          licenses: {
            orderBy: { createdAt: 'desc' },
          },
          decommission_requests: {
            where: { status: 'APPROVED' },
            include: {
              act: { select: { id: true, folio: true, pdfPath: true } },
              reviewer: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          attachments: {
            orderBy: { createdAt: 'desc' },
          },
          batch: {
            select: {
              id: true,
              batchCode: true,
              quantity: true,
              purchaseDate: true,
              unitPrice: true,
            },
          },
        },
      })

      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      // Obtenga los campos personalizados de la familia por separado para evitar problemas de análisis.
      if (equipment.type?.family?.id) {
        const familyCustomFields = await prisma.family_custom_fields.findMany({
          where: { familyId: equipment.type.family.id },
          orderBy: { order: 'asc' },
        })
        ;(equipment.type.family as any).customFields = familyCustomFields
      }

      // Obtener asignación actual
      const currentAssignment = (equipment.assignments as any[]).find((a: any) => a.isActive)

      const businessContractId = await getLinkedBusinessContractId(id)

      // Construir historial
      const history = await this.buildEquipmentHistory(id)

      let batchMetrics: BatchMetrics | undefined
      if (equipment.batchId) {
        const batchEquipment = await prisma.equipment.findMany({
          where: { batchId: equipment.batchId },
          select: { status: true },
        })
        const total = batchEquipment.length
        const available = batchEquipment.filter(e => e.status === 'AVAILABLE').length
        const assigned = batchEquipment.filter(e => e.status === 'ASSIGNED').length
        const maintenance = batchEquipment.filter(e => e.status === 'MAINTENANCE').length
        const retired = batchEquipment.filter(e => e.status === 'RETIRED').length
        batchMetrics = {
          total,
          available,
          assigned,
          maintenance,
          retired,
          utilizationRate: total > 0 ? (assigned / total) * 100 : 0,
        }
      }

      return {
        equipment: { ...(equipment as any), businessContractId },
        currentAssignment,
        history,
        maintenanceRecords: (equipment as any).maintenanceRecords,
        batch: (equipment as any).batch ?? undefined,
        batchMetrics,
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
    userRole?: string,
    familyFilter?: any
  ): Promise<EquipmentListResponse> {
    try {
      const skip = (page - 1) * limit

      // Construir filtros
      const where: Prisma.equipmentWhereInput = {}

      // Aplicar filtro de familia/permisos PRIMERO (más restrictivo)
      if (familyFilter) {
        Object.assign(where, familyFilter)
      }

      // Búsqueda de texto
      if (filters.search) {
        const q = filters.search
        where.OR = [
          { code: { contains: q, mode: 'insensitive' } },
          { serialNumber: { contains: q, mode: 'insensitive' } },
          { brand: { contains: q, mode: 'insensitive' } },
          { modelDeprecated: { contains: q, mode: 'insensitive' } },
          {
            model: {
              OR: [
                { brand: { name: { contains: q, mode: 'insensitive' } } },
                { model: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
        ]
      }

      // Filtros por tipo
      if (filters.typeId && filters.typeId.length > 0) {
        where.typeId = { in: filters.typeId }
      }

      // Filtro por familia (a través del departamento del equipo, no del tipo)
      if ((filters as any).familyId) {
        ;(where as any).department = { familyId: (filters as any).familyId }
      }

      // Filtro por departamento
      if (filters.departmentId) {
        ;(where as any).departmentId = filters.departmentId
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
            isActive: true,
          },
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
            type: { include: { family: true } }, // Incluir familia en la respuesta
          },
          orderBy: { createdAt: 'desc' },
        }),
      ])

      return {
        equipment: equipment as unknown as Equipment[],
        total,
        page,
        limit,
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
        where: { equipmentId: id, isActive: true },
      })

      if (hasActiveAssignment && data.status && data.status !== equipment.status) {
        throw new Error('No se puede cambiar el estado de un equipo con asignación activa')
      }

      const updated = await prisma.equipment.update({
        where: { id },
        data: {
          ...(data.serialNumber && { serialNumber: data.serialNumber }),
          ...(data.brand && { brand: data.brand }),
          ...(data.model && { modelDeprecated: data.model }),
          ...(data.typeId && { typeId: data.typeId }),
          ...(data.status && { status: data.status as any }),
          ...(data.condition && { condition: data.condition as any }),
          ...(data.ownershipType && { ownershipType: data.ownershipType as any }),
          ...(data.purchaseDate !== undefined && {
            purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
          }),
          ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
          ...(data.warrantyExpiration !== undefined && {
            warrantyExpiration: data.warrantyExpiration ? new Date(data.warrantyExpiration) : null,
          }),
          ...(data.accessories !== undefined && { accessories: data.accessories }),
          ...((data as any).customValues !== undefined && {
            customValues: (data as any).customValues,
          }),
          ...(data.location !== undefined && { location: data.location }),
          ...(data.notes !== undefined && { notes: data.notes }),
          // Campos adicionales que el formulario de edición puede enviar
          ...((data as any).physicalLocation !== undefined && {
            physicalLocation: (data as any).physicalLocation || null,
          }),
          ...((data as any).invoiceNumber !== undefined && {
            invoiceNumber: (data as any).invoiceNumber || null,
          }),
          ...((data as any).usefulLifeYears !== undefined && {
            usefulLifeYears: (data as any).usefulLifeYears ?? null,
          }),
          ...((data as any).residualValue !== undefined && {
            residualValue: (data as any).residualValue ?? null,
          }),
          ...((data as any).depreciationMethod !== undefined && {
            depreciationMethod: (data as any).depreciationMethod || null,
          }),
          ...((data as any).estimatedPrice !== undefined && {
            estimatedPrice: (data as any).estimatedPrice ?? null,
          }),
          ...((data as any).saleListingPrice !== undefined && {
            saleListingPrice: (data as any).saleListingPrice ?? null,
          }),
          ...((data as any).rentalDeliveryDate !== undefined && {
            rentalDeliveryDate: (data as any).rentalDeliveryDate
              ? new Date((data as any).rentalDeliveryDate)
              : null,
          }),
          ...((data as any).rentalBuyoutValue !== undefined && {
            rentalBuyoutValue: (data as any).rentalBuyoutValue ?? null,
          }),
          ...((data as any).rentalClientResponse !== undefined && {
            rentalClientResponse: (data as any).rentalClientResponse,
          }),
        } as Prisma.equipmentUpdateInput,
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
        estimatedPrice: 'Precio Estimado',
        saleListingPrice: 'Precio de Venta',
        rentalDeliveryDate: 'Fecha de entrega (renta)',
        rentalBuyoutValue: 'Valor opción de compra',
        rentalClientResponse: 'Respuesta del cliente (renta)',
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
          },
        },
      })

      return updated as unknown as Equipment
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
        where: { equipmentId: id, isActive: true },
      })

      if (hasActiveAssignment) {
        throw new Error('No se puede eliminar un equipo con asignación activa')
      }

      // Soft delete: cambiar estado a RETIRED
      await prisma.equipment.update({
        where: { id },
        data: { status: 'RETIRED' },
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
            reason: 'Equipo retirado',
          },
        },
      })
    } catch (error) {
      console.error('Error eliminando equipo:', error)
      throw error
    }
  }

  /**
   * Elimina permanentemente un equipo de la base de datos.
   * Admin normal: requiere estado RETIRED.
   * SuperAdmin: puede eliminar cualquier equipo no asignado.
   */
  static async permanentDeleteEquipment(
    id: string,
    userId: string,
    skipStatusCheck = false
  ): Promise<void> {
    try {
      const equipment = await prisma.equipment.findUnique({ where: { id } })

      if (!equipment) {
        throw new Error('Equipo no encontrado')
      }

      if (!skipStatusCheck && equipment.status !== 'RETIRED') {
        throw new Error('Solo se pueden eliminar permanentemente equipos retirados')
      }

      const hasActiveAssignment = await prisma.equipment_assignments.findFirst({
        where: { equipmentId: id, isActive: true },
      })

      if (hasActiveAssignment) {
        throw new Error('No se puede eliminar un equipo con asignación activa')
      }

      const equipmentData = {
        code: equipment.code,
        serialNumber: equipment.serialNumber,
        brand: equipment.brand,
        model: equipment.modelDeprecated,
      }

      await prisma.$transaction(async tx => {
        const assignments = await tx.equipment_assignments.findMany({
          where: { equipmentId: id },
          select: { id: true },
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
          },
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
  static async getEquipmentSummary(familyIds?: string[]): Promise<EquipmentSummary> {
    try {
      const { buildEquipmentFamilyWhere } = await import('@/lib/inventory/scope-filter')
      const scopeWhere = buildEquipmentFamilyWhere(familyIds)

      const [total, byStatus, byType, byCondition, totalValue] = await Promise.all([
        prisma.equipment.count({ where: scopeWhere }),
        prisma.equipment.groupBy({
          by: ['status'],
          where: scopeWhere,
          _count: true,
        }),
        prisma.equipment.groupBy({
          by: ['typeId'],
          where: scopeWhere,
          _count: true,
        }),
        prisma.equipment.groupBy({
          by: ['condition'],
          where: scopeWhere,
          _count: true,
        }),
        prisma.equipment.aggregate({
          where: scopeWhere,
          _sum: { purchasePrice: true },
        }),
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
        byType: byType.reduce(
          (acc, item) => ({ ...acc, [item.typeId]: item._count }),
          {} as Record<string, number>
        ),
        byCondition: byCondition.reduce(
          (acc, item) => ({ ...acc, [item.condition]: item._count }),
          {} as Record<string, number>
        ),
        totalValue: totalValue._sum.purchasePrice ?? 0,
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
        byCondition: {} as any,
        totalValue: 0,
      }
    }
  }

  /**
   * Construye el historial de eventos de un equipo
   */
  private static async buildEquipmentHistory(
    equipmentId: string
  ): Promise<EquipmentHistoryEvent[]> {
    const history: EquipmentHistoryEvent[] = []

    // Acciones duplicadas del AuditServiceComplete que ya se registran desde el servicio
    const duplicateActions = new Set([
      'equipment_created',
      'equipment_updated',
      'equipment_deleted',
      'equipment_status_changed',
      'assignment_created',
    ])

    // Obtener eventos de auditoría
    const auditLogs = await prisma.audit_logs.findMany({
      where: {
        entityType: 'equipment',
        entityId: equipmentId,
      },
      include: {
        users: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
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
      } else if (log.action === 'ASSIGNED' || log.action === 'ASSIGNMENT_CREATED') {
        if (details?.receiverName) metadata['Asignado a'] = details.receiverName
        if (details?.assignmentType) {
          const typeLabels: Record<string, string> = {
            PERMANENT: 'Permanente',
            TEMPORARY: 'Temporal',
            LOAN: 'Préstamo',
          }
          metadata['Tipo'] = typeLabels[details.assignmentType] || details.assignmentType
        }
      } else if (log.action === 'RETURNED') {
        if (details?.actualEndDate)
          metadata['Fecha de devolución'] = new Date(details.actualEndDate).toLocaleDateString(
            'es-ES'
          )
      }

      history.push({
        id: log.id,
        type: this.mapActionToEventType(log.action) as any,
        description: this.getAuditLogDescription(log.action, details),
        userId: log.userId || undefined,
        userName: log.users?.name,
        timestamp: log.createdAt,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
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
      ASSIGNMENT_CREATED: 'ASSIGNED',
      RETURNED: 'RETURNED',
      CANCELLED: 'RETURNED',
      CREATE_MAINTENANCE: 'MAINTENANCE',
      COMPLETED: 'MAINTENANCE',
      EQUIPMENT_ATTACHMENT_UPLOAD: 'UPDATED',
      EQUIPMENT_ATTACHMENT_DELETE: 'UPDATED',
      ASSET_FAMILY_TRANSFER: 'FAMILY_TRANSFER',
    }
    return map[action] || map[action.toUpperCase()] || 'UPDATED'
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
      AVAILABLE: 'Disponible',
      ASSIGNED: 'Asignado',
      MAINTENANCE: 'Mantenimiento',
      DAMAGED: 'Dañado',
      RETIRED: 'Retirado',
      NEW: 'Nuevo',
      LIKE_NEW: 'Como Nuevo',
      GOOD: 'Bueno',
      FAIR: 'Regular',
      POOR: 'Malo',
      FIXED_ASSET: 'Activo Fijo',
      RENTAL: 'Alquiler',
      LOAN: 'Préstamo',
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
      case 'ASSIGNMENT_CREATED':
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
      case 'EQUIPMENT_ATTACHMENT_UPLOAD':
        return details?.descripcion || 'Archivo adjunto subido al equipo'
      case 'ASSET_FAMILY_TRANSFER':
        return `Transferido de área "${details?.fromFamilyName ?? details?.fromFamilyId ?? '—'}" a "${details?.toFamilyName ?? details?.toFamilyId ?? '—'}"${details?.attributesLost?.length ? ` · ${details.attributesLost.length} atributo(s) no migrados` : ''}`
      default:
        // Manejar acciones con formato snake_case del AuditServiceComplete
        if (action.includes('_')) {
          // Diccionario de traducciones completas para acciones conocidas
          const actionTranslations: Record<string, string> = {
            equipment_attachment_upload: 'Archivo adjunto subido al equipo',
            equipment_attachment_delete: 'Archivo adjunto eliminado del equipo',
            equipment_status_changed: 'Estado del equipo actualizado',
            equipment_condition_changed: 'Condición del equipo actualizada',
            assignment_completed: 'Asignación completada',
            assignment_cancelled: 'Asignación cancelada',
            maintenance_created: 'Mantenimiento registrado',
            maintenance_completed: 'Mantenimiento completado',
            decommission_requested: 'Solicitud de baja creada',
            decommission_approved: 'Solicitud de baja aprobada',
            decommission_rejected: 'Solicitud de baja rechazada',
          }
          const lowerAction = action.toLowerCase()
          if (actionTranslations[lowerAction]) {
            return actionTranslations[lowerAction]
          }
          // Fallback genérico para acciones desconocidas
          const readable = lowerAction
            .replace(/^equipment_/, '')
            .replace(/^assignment_/, '')
            .replace(/_/g, ' ')
          return `Acción: ${readable.charAt(0).toUpperCase() + readable.slice(1)}`
        }
        return action
    }
  }
}
