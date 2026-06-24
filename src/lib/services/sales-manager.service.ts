/**
 * SalesManagerService — Gestión de ventas de equipos
 *
 * Responsabilidades:
 *  - Activar/desactivar equipos para venta
 *  - Gestión de precios
 *  - Activar/desactivar lotes completos
 *  - Estadísticas de ventas
 *  - Obtener equipos disponibles y en venta
 */

import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { NotificationService } from '@/lib/services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ActivateForSaleParams {
  equipmentIds: string[]
  salePrice: number
  saleCurrency?: string
  saleNotes?: string
  userId: string
}

interface DeactivateFromSaleParams {
  equipmentIds: string[]
  reason: string
  userId: string
}

interface UpdateSalePriceParams {
  equipmentIds: string[]
  newPrice: number
  userId: string
}

interface SalesStats {
  totalForSale: number
  totalAvailable: number
  totalValue: number
  byFamily: Array<{
    familyId: string
    familyName: string
    count: number
    value: number
  }>
  byModel: Array<{
    modelId: string
    modelName: string
    count: number
    value: number
  }>
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class SalesManagerService {
  // ── Activar equipos para venta ─────────────────────────────────────────────

  static async activateForSale(params: ActivateForSaleParams) {
    const { equipmentIds, salePrice, saleCurrency = 'USD', saleNotes, userId } = params

    // Validaciones
    if (equipmentIds.length === 0) {
      throw new Error('Debe seleccionar al menos un equipo')
    }

    if (salePrice <= 0) {
      throw new Error('El precio de venta debe ser mayor a 0')
    }

    // Verificar que los equipos existan y estén disponibles
    const equipment = await prisma.equipment.findMany({
      where: {
        id: { in: equipmentIds },
        status: { in: ['AVAILABLE', 'ASSIGNED'] }, // Permitir ASSIGNED con advertencia
      },
      include: {
        model: { select: { brand: true, model: true } },
        type: { include: { family: { select: { id: true, name: true } } } },
      },
    })

    if (equipment.length === 0) {
      throw new Error('No se encontraron equipos disponibles')
    }

    if (equipment.length !== equipmentIds.length) {
      throw new Error('Algunos equipos no están disponibles o no existen')
    }

    // Actualizar equipos
    const updated = await prisma.equipment.updateMany({
      where: { id: { in: equipmentIds } },
      data: {
        status: 'FOR_SALE',
        saleListingPrice: salePrice,
      },
    })

    // Auditoría
    for (const eq of equipment) {
      await createAuditLog({
        entityType: 'equipment',
        entityId: eq.id,
        action: 'equipment_activated_for_sale',
        userId,
        changes: {
          code: eq.code,
          serialNumber: eq.serialNumber,
          model: eq.model ? `${eq.model.brand} ${eq.model.model}` : null,
          salePrice,
          saleCurrency,
        },
      })
    }

    // Notificar a administradores de familias
    const familyIds = [
      ...new Set(equipment.map(eq => eq.type.family?.id).filter((id): id is string => Boolean(id))),
    ]
    for (const familyId of familyIds) {
      const family = equipment.find(eq => eq.type.family?.id === familyId)?.type.family
      const count = equipment.filter(eq => eq.type.family?.id === familyId).length

      await this.notifyFamilyAdmins(familyId, {
        type: 'EQUIPMENT_FOR_SALE',
        title: `${count} equipo(s) activado(s) para venta`,
        message: `Se han activado ${count} equipo(s) de la familia ${family?.name} para venta con precio de $${salePrice.toLocaleString()} ${saleCurrency}`,
        metadata: {
          count,
          salePrice,
          saleCurrency,
          familyId,
        },
      })
    }

    return {
      success: true,
      updated: updated.count,
      equipment,
    }
  }

  // ── Desactivar equipos de venta ────────────────────────────────────────────

  static async deactivateFromSale(params: DeactivateFromSaleParams) {
    const { equipmentIds, reason, userId } = params

    // Validaciones
    if (equipmentIds.length === 0) {
      throw new Error('Debe seleccionar al menos un equipo')
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error('Debe proporcionar una razón (mínimo 5 caracteres)')
    }

    // Verificar que los equipos existan y estén en venta
    const equipment = await prisma.equipment.findMany({
      where: {
        id: { in: equipmentIds },
        status: 'FOR_SALE',
      },
      include: {
        model: { select: { brand: true, model: true } },
      },
    })

    if (equipment.length === 0) {
      throw new Error('No se encontraron equipos en venta')
    }

    // Actualizar equipos (volver a AVAILABLE)
    const updated = await prisma.equipment.updateMany({
      where: { id: { in: equipmentIds } },
      data: {
        status: 'AVAILABLE',
        saleListingPrice: null,
      },
    })

    // Auditoría
    for (const eq of equipment) {
      await createAuditLog({
        entityType: 'equipment',
        entityId: eq.id,
        action: 'equipment_deactivated_from_sale',
        userId,
        changes: {
          code: eq.code,
          serialNumber: eq.serialNumber,
          model: eq.model ? `${eq.model.brand} ${eq.model.model}` : null,
          reason,
          previousPrice: eq.saleListingPrice,
        },
      })
    }

    return {
      success: true,
      updated: updated.count,
      equipment,
    }
  }

  // ── Actualizar precio de venta ─────────────────────────────────────────────

  static async updateSalePrice(params: UpdateSalePriceParams) {
    const { equipmentIds, newPrice, userId } = params

    // Validaciones
    if (equipmentIds.length === 0) {
      throw new Error('Debe seleccionar al menos un equipo')
    }

    if (newPrice <= 0) {
      throw new Error('El precio debe ser mayor a 0')
    }

    // Verificar que los equipos existan y estén en venta
    const equipment = await prisma.equipment.findMany({
      where: {
        id: { in: equipmentIds },
        status: 'FOR_SALE',
      },
      select: {
        id: true,
        code: true,
        serialNumber: true,
        saleListingPrice: true,
      },
    })

    if (equipment.length === 0) {
      throw new Error('No se encontraron equipos en venta')
    }

    // Actualizar precios
    const updated = await prisma.equipment.updateMany({
      where: { id: { in: equipmentIds } },
      data: { saleListingPrice: newPrice },
    })

    // Auditoría
    for (const eq of equipment) {
      await createAuditLog({
        entityType: 'equipment',
        entityId: eq.id,
        action: 'equipment_sale_price_updated',
        userId,
        changes: {
          code: eq.code,
          serialNumber: eq.serialNumber,
          previousPrice: eq.saleListingPrice,
          newPrice,
        },
      })
    }

    return {
      success: true,
      updated: updated.count,
      equipment,
    }
  }

  // ── Activar lote completo para venta ───────────────────────────────────────

  static async activateBatchForSale(params: {
    batchId: string
    salePrice: number
    saleCurrency?: string
    saleNotes?: string
    userId: string
  }) {
    const { batchId, salePrice, saleCurrency = 'USD', saleNotes, userId } = params

    // Obtener equipos del lote que estén disponibles
    const equipment = await prisma.equipment.findMany({
      where: {
        batchId,
        status: { in: ['AVAILABLE', 'ASSIGNED'] },
      },
      select: { id: true },
    })

    if (equipment.length === 0) {
      throw new Error('No hay equipos disponibles en este lote')
    }

    // Usar el método de activación individual
    return await this.activateForSale({
      equipmentIds: equipment.map(eq => eq.id),
      salePrice,
      saleCurrency,
      saleNotes: saleNotes || `Lote completo activado para venta`,
      userId,
    })
  }

  // ── Desactivar lote completo de venta ──────────────────────────────────────

  static async deactivateBatchFromSale(params: {
    batchId: string
    reason: string
    userId: string
  }) {
    const { batchId, reason, userId } = params

    // Obtener equipos del lote que estén en venta
    const equipment = await prisma.equipment.findMany({
      where: {
        batchId,
        status: 'FOR_SALE',
      },
      select: { id: true },
    })

    if (equipment.length === 0) {
      throw new Error('No hay equipos en venta en este lote')
    }

    // Usar el método de desactivación individual
    return await this.deactivateFromSale({
      equipmentIds: equipment.map(eq => eq.id),
      reason,
      userId,
    })
  }

  // ── Obtener estadísticas de ventas ─────────────────────────────────────────

  static async getSalesStats(familyId?: string): Promise<SalesStats> {
    const typeFamilyFilter = familyId ? { type: { familyId } } : {}
    const whereForSale: any = { status: 'FOR_SALE', ...typeFamilyFilter }
    const whereAvailable: any = { status: 'AVAILABLE', ...typeFamilyFilter }

    const totalForSale = await prisma.equipment.count({ where: whereForSale })
    const totalAvailable = await prisma.equipment.count({ where: whereAvailable })

    const valueAgg = await prisma.equipment.aggregate({
      where: whereForSale,
      _sum: { saleListingPrice: true },
    })
    const totalValue = valueAgg._sum.saleListingPrice ?? 0

    const forSaleRows = await prisma.equipment.findMany({
      where: whereForSale,
      select: { typeId: true, saleListingPrice: true },
    })
    const typeIds = [...new Set(forSaleRows.map(r => r.typeId))]
    const types =
      typeIds.length > 0
        ? await prisma.equipment_types.findMany({
            where: { id: { in: typeIds } },
            select: { id: true, familyId: true },
          })
        : []

    const famIds = [
      ...new Set(types.map(t => t.familyId).filter((id): id is string => Boolean(id))),
    ]
    const families =
      famIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: famIds } },
            select: { id: true, name: true },
          })
        : []
    const familyNameById = new Map(families.map(f => [f.id, f.name] as const))

    const byFamilyMap = new Map<string, { count: number; value: number }>()
    for (const row of forSaleRows) {
      const fid = types.find(t => t.id === row.typeId)?.familyId
      if (!fid) continue
      const cur = byFamilyMap.get(fid) || { count: 0, value: 0 }
      cur.count += 1
      cur.value += row.saleListingPrice ?? 0
      byFamilyMap.set(fid, cur)
    }
    const byFamily = Array.from(byFamilyMap.entries()).map(([id, v]) => ({
      familyId: id,
      familyName: familyNameById.get(id) || 'Sin familia',
      count: v.count,
      value: v.value,
    }))

    const byModelRaw = await prisma.equipment.groupBy({
      by: ['modelId'],
      where: whereForSale,
      _count: { _all: true },
      _sum: { saleListingPrice: true },
    })

    const modelIds = byModelRaw.map(m => m.modelId).filter((id): id is string => Boolean(id))
    const models = await prisma.equipment_models.findMany({
      where: { id: { in: modelIds } },
      select: { id: true, brand: true, model: true },
    })

    const byModel = byModelRaw
      .filter(m => m.modelId)
      .map(m => {
        const model = models.find(mod => mod.id === m.modelId)
        return {
          modelId: m.modelId!,
          modelName: model ? `${model.brand} ${model.model}` : 'Sin modelo',
          count: m._count._all,
          value: m._sum.saleListingPrice ?? 0,
        }
      })

    return {
      totalForSale,
      totalAvailable,
      totalValue,
      byFamily,
      byModel,
    }
  }

  // ── Obtener equipos disponibles ────────────────────────────────────────────

  static async getAvailableEquipment(params: {
    familyId?: string
    modelId?: string
    warehouseId?: string
    search?: string
    page?: number
    pageSize?: number
    familyFilter?: any // NUEVO: filtro de permisos
  }) {
    const { familyId, modelId, warehouseId, search, page = 1, pageSize = 50, familyFilter } = params

    const where: any = {
      status: { in: ['AVAILABLE', 'ASSIGNED'] },
    }

    // Aplicar filtro de permisos PRIMERO
    if (familyFilter) {
      Object.assign(where, familyFilter)
    }

    if (familyId) where.type = { familyId }
    if (modelId) where.modelId = modelId
    if (warehouseId) where.warehouseId = warehouseId
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          model: { select: { brand: true, model: true, sku: true } },
          type: { include: { family: { select: { name: true, color: true } } } },
          warehouse: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment.count({ where }),
    ])

    return {
      equipment,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  // ── Obtener equipos en venta ───────────────────────────────────────────────

  static async getForSaleEquipment(params: {
    familyId?: string
    modelId?: string
    search?: string
    page?: number
    pageSize?: number
    familyFilter?: any // NUEVO: filtro de permisos
  }) {
    const { familyId, modelId, search, page = 1, pageSize = 50, familyFilter } = params

    const where: any = {
      status: 'FOR_SALE',
    }

    // Aplicar filtro de permisos PRIMERO
    if (familyFilter) {
      Object.assign(where, familyFilter)
    }

    if (familyId) where.type = { familyId }
    if (modelId) where.modelId = modelId
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: {
          model: { select: { brand: true, model: true, sku: true } },
          type: { include: { family: { select: { name: true, color: true } } } },
          warehouse: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment.count({ where }),
    ])

    return {
      equipment,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  // ── Notificar a administradores de familia ─────────────────────────────────

  private static async notifyFamilyAdmins(
    familyId: string,
    notification: {
      type: string
      title: string
      message: string
      metadata?: any
    }
  ) {
    const admins = await getFamilyScopedAdmins(familyId, { id: true })

    for (const admin of admins) {
      await NotificationService.push({
        userId: admin.id,
        type: 'INVENTORY',
        title: notification.title,
        message: notification.message,
        metadata: { ...notification.metadata, kind: notification.type },
      })
    }
  }
}
