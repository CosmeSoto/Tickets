/**
 * ContractService — Lógica de negocio del módulo de contratos.
 *
 * Responsabilidades:
 *  - CRUD de contratos y líneas
 *  - Cálculo de estado (ACTIVE / EXPIRING / EXPIRED)
 *  - Notificaciones de vencimiento próximo
 *  - Registro de auditoría en cada operación
 */

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'
import { NotificationService } from '@/lib/services/notification-service'
import { EXPIRING_DAYS, type ContractStatus } from '@/types/contracts'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function computeContractStatus(endDate?: Date | null): {
  status: ContractStatus
  daysUntilExpiry?: number
} {
  if (!endDate) return { status: 'ACTIVE' }
  const now = new Date()
  const diff = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0)              return { status: 'EXPIRED',  daysUntilExpiry: 0 }
  if (diff <= EXPIRING_DAYS) return { status: 'EXPIRING', daysUntilExpiry: diff }
  return                            { status: 'ACTIVE',   daysUntilExpiry: diff }
}

// Selector reutilizable para incluir relaciones en queries
const CONTRACT_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  family:   { select: { id: true, name: true, color: true, code: true } },
  creator:  { select: { id: true, name: true, email: true } },
  lines: {
    orderBy: { order: 'asc' as const },
    include: {
      equipment: { select: { id: true, code: true, brand: true, model: true } },
      license:   { select: { id: true, name: true } },
    },
  },
  attachments: { orderBy: { createdAt: 'asc' as const } },
} as const

// ── Servicio ──────────────────────────────────────────────────────────────────

export class ContractService {

  // ── Listar ──────────────────────────────────────────────────────────────────

  static async list(params: {
    page?: number
    pageSize?: number
    search?: string
    status?: string
    category?: string
    familyId?: string
    supplierId?: string
    userId?: string
    userRole?: string
    isSuperAdmin?: boolean
  }) {
    const { page = 1, pageSize = 20, search, status, category, familyId, supplierId, userId, userRole, isSuperAdmin } = params

    const where: any = {}

    // SuperAdmin ve todo — sin restricción de familias
    // Admin normal: ve contratos de sus familias asignadas (si tiene asignaciones)
    // Gestor (canManageInventory): ve solo contratos de sus familias en inventory_manager_families
    if (userId && userRole && !isSuperAdmin) {
      if (userRole === 'ADMIN') {
        // Admin normal: filtrar por sus familias asignadas si tiene alguna
        const adminFamilies = await prisma.admin_family_assignments.findMany({
          where: { adminId: userId, isActive: true },
          select: { familyId: true },
        })
        if (adminFamilies.length > 0) {
          where.familyId = { in: adminFamilies.map(f => f.familyId) }
        }
        // Si no tiene asignaciones → ve todo (comportamiento existente)
      } else {
        // Gestor: solo sus familias en inventory_manager_families
        const managerFamilies = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        if (managerFamilies.length > 0) {
          where.familyId = { in: managerFamilies.map(f => f.familyId) }
        }
      }
    }

    if (search?.trim()) {
      where.OR = [
        { name:           { contains: search, mode: 'insensitive' } },
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (status   && status   !== 'ALL') where.status   = status
    if (category && category !== 'ALL') where.category = category
    if (familyId)   where.familyId   = familyId   // override explícito
    if (supplierId) where.supplierId = supplierId

    const [rawContracts, total] = await Promise.all([
      prisma.contracts.findMany({
        where,
        include: CONTRACT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
      prisma.contracts.count({ where }),
    ])

    // Recalcular status dinámicamente (puede haber cambiado desde el último guardado)
    const contracts = rawContracts.map(c => {
      const { status: computedStatus, daysUntilExpiry } = computeContractStatus(c.endDate)
      return { ...c, status: computedStatus, daysUntilExpiry }
    })

    // Stats globales (sin paginación)
    const allForStats = await prisma.contracts.findMany({
      where: familyId ? { familyId } : {},
      select: { endDate: true, monthlyCost: true },
    })

    const stats = allForStats.reduce(
      (acc, c) => {
        const { status } = computeContractStatus(c.endDate)
        acc.total++
        if (status === 'ACTIVE')    acc.active++
        if (status === 'EXPIRING')  acc.expiring++
        if (status === 'EXPIRED')   acc.expired++
        if (c.monthlyCost)          acc.monthlyCostTotal += c.monthlyCost
        return acc
      },
      { total: 0, active: 0, expiring: 0, expired: 0, draft: 0, monthlyCostTotal: 0 }
    )

    return {
      contracts,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    }
  }

  // ── Obtener uno ─────────────────────────────────────────────────────────────

  static async getById(id: string) {
    const contract = await prisma.contracts.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    })
    if (!contract) return null
    const { status, daysUntilExpiry } = computeContractStatus(contract.endDate)
    return { ...contract, status, daysUntilExpiry }
  }

  // ── Crear ───────────────────────────────────────────────────────────────────

  static async create(data: {
    contractNumber?: string
    name: string
    description?: string
    category: string
    supplierId?: string
    familyId?: string
    startDate?: string
    endDate?: string
    autoRenew?: boolean
    renewalNoticeDays?: number
    billingCycle?: string
    totalValue?: number
    monthlyCost?: number
    currency?: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    notes?: string
    termsUrl?: string
    lines?: Array<{
      type: string
      description: string
      quantity?: number
      unitPrice?: number
      equipmentId?: string
      licenseId?: string
      notes?: string
      order?: number
    }>
    createdBy: string
  }) {
    const { lines = [], createdBy, ...contractData } = data

    const contract = await prisma.contracts.create({
      data: {
        id:                randomUUID(),
        contractNumber:    contractData.contractNumber || null,
        name:              contractData.name,
        description:       contractData.description || null,
        category:          contractData.category as any,
        status:            'DRAFT',
        supplierId:        contractData.supplierId || null,
        familyId:          contractData.familyId || null,
        startDate:         contractData.startDate ? new Date(contractData.startDate) : null,
        endDate:           contractData.endDate   ? new Date(contractData.endDate)   : null,
        autoRenew:         contractData.autoRenew         ?? false,
        renewalNoticeDays: contractData.renewalNoticeDays ?? 30,
        billingCycle:      (contractData.billingCycle as any) ?? 'MONTHLY',
        totalValue:        contractData.totalValue  ?? null,
        monthlyCost:       contractData.monthlyCost ?? null,
        currency:          contractData.currency    ?? 'USD',
        contactName:       contractData.contactName  || null,
        contactEmail:      contractData.contactEmail || null,
        contactPhone:      contractData.contactPhone || null,
        notes:             contractData.notes    || null,
        termsUrl:          contractData.termsUrl || null,
        createdBy,
        lines: lines.length > 0 ? {
          create: lines.map((l, i) => ({
            id:          randomUUID(),
            type:        l.type as any,
            description: l.description,
            quantity:    l.quantity    ?? 1,
            unitPrice:   l.unitPrice   ?? null,
            totalPrice:  l.unitPrice && l.quantity ? l.unitPrice * l.quantity : null,
            equipmentId: l.equipmentId || null,
            licenseId:   l.licenseId   || null,
            notes:       l.notes       || null,
            order:       l.order       ?? i,
          })),
        } : undefined,
      },
      include: CONTRACT_INCLUDE,
    })

    // Auditoría
    await createAuditLog({
      entityType: 'contract',
      entityId:   contract.id,
      action:     'contract_created',
      userId:     createdBy,
      changes: {
        name:     contract.name,
        category: contract.category,
        status:   contract.status,
      },
    })

    return contract
  }

  // ── Actualizar ──────────────────────────────────────────────────────────────

  static async update(id: string, data: Partial<{
    contractNumber: string
    name: string
    description: string
    category: string
    supplierId: string
    familyId: string
    startDate: string
    endDate: string
    autoRenew: boolean
    renewalNoticeDays: number
    billingCycle: string
    totalValue: number
    monthlyCost: number
    currency: string
    contactName: string
    contactEmail: string
    contactPhone: string
    notes: string
    termsUrl: string
    status: string
  }>, updatedBy: string) {
    const before = await prisma.contracts.findUnique({ where: { id }, select: { name: true, status: true, endDate: true } })
    if (!before) throw new Error('Contrato no encontrado')

    const contract = await prisma.contracts.update({
      where: { id },
      data: {
        ...(data.contractNumber !== undefined && { contractNumber: data.contractNumber || null }),
        ...(data.name           !== undefined && { name: data.name }),
        ...(data.description    !== undefined && { description: data.description || null }),
        ...(data.category       !== undefined && { category: data.category as any }),
        ...(data.supplierId     !== undefined && { supplierId: data.supplierId || null }),
        ...(data.familyId       !== undefined && { familyId: data.familyId || null }),
        ...(data.startDate      !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
        ...(data.endDate        !== undefined && { endDate:   data.endDate   ? new Date(data.endDate)   : null }),
        ...(data.autoRenew      !== undefined && { autoRenew: data.autoRenew }),
        ...(data.renewalNoticeDays !== undefined && { renewalNoticeDays: data.renewalNoticeDays }),
        ...(data.billingCycle   !== undefined && { billingCycle: data.billingCycle as any }),
        ...(data.totalValue     !== undefined && { totalValue: data.totalValue }),
        ...(data.monthlyCost    !== undefined && { monthlyCost: data.monthlyCost }),
        ...(data.currency       !== undefined && { currency: data.currency }),
        ...(data.contactName    !== undefined && { contactName: data.contactName || null }),
        ...(data.contactEmail   !== undefined && { contactEmail: data.contactEmail || null }),
        ...(data.contactPhone   !== undefined && { contactPhone: data.contactPhone || null }),
        ...(data.notes          !== undefined && { notes: data.notes || null }),
        ...(data.termsUrl       !== undefined && { termsUrl: data.termsUrl || null }),
        ...(data.status         !== undefined && { status: data.status as any }),
      },
      include: CONTRACT_INCLUDE,
    })

    await createAuditLog({
      entityType: 'contract',
      entityId:   id,
      action:     'contract_updated',
      userId:     updatedBy,
      changes: {
        before: { name: before.name, status: before.status },
        after:  { name: contract.name, status: contract.status },
      },
    })

    return contract
  }

  // ── Eliminar ────────────────────────────────────────────────────────────────

  static async delete(id: string, deletedBy: string) {
    const contract = await prisma.contracts.findUnique({
      where: { id },
      select: { name: true, status: true },
    })
    if (!contract) throw new Error('Contrato no encontrado')

    await prisma.contracts.delete({ where: { id } })

    await createAuditLog({
      entityType: 'contract',
      entityId:   id,
      action:     'contract_deleted',
      userId:     deletedBy,
      changes:    { name: contract.name, status: contract.status },
    })
  }

  // ── Líneas ──────────────────────────────────────────────────────────────────

  static async upsertLines(contractId: string, lines: Array<{
    id?: string
    type: string
    description: string
    quantity?: number
    unitPrice?: number
    equipmentId?: string
    licenseId?: string
    notes?: string
    order?: number
  }>, updatedBy: string) {
    // Eliminar líneas existentes y recrear (más simple que diff)
    await prisma.contract_lines.deleteMany({ where: { contractId } })

    if (lines.length > 0) {
      await prisma.contract_lines.createMany({
        data: lines.map((l, i) => ({
          id:          randomUUID(),
          contractId,
          type:        l.type as any,
          description: l.description,
          quantity:    l.quantity    ?? 1,
          unitPrice:   l.unitPrice   ?? null,
          totalPrice:  l.unitPrice && l.quantity ? l.unitPrice * l.quantity : null,
          equipmentId: l.equipmentId || null,
          licenseId:   l.licenseId   || null,
          notes:       l.notes       || null,
          order:       l.order       ?? i,
        })),
      })
    }

    await createAuditLog({
      entityType: 'contract',
      entityId:   contractId,
      action:     'contract_lines_updated',
      userId:     updatedBy,
      changes:    { linesCount: lines.length },
    })
  }

  // ── Job: alertas de vencimiento ─────────────────────────────────────────────
  // Llamado por el cron job de expiración. Envía notificaciones a los
  // administradores cuando un contrato está próximo a vencer.

  static async checkExpirations() {
    const now = new Date()
    const alertThreshold = new Date(now.getTime() + EXPIRING_DAYS * 24 * 60 * 60 * 1000)

    // Contratos que vencen en los próximos EXPIRING_DAYS días y no han sido alertados
    const expiring = await prisma.contracts.findMany({
      where: {
        status:           { in: ['ACTIVE', 'EXPIRING'] },
        endDate:          { lte: alertThreshold, gte: now },
        expiryAlertSentAt: null,
      },
      include: {
        supplier: { select: { name: true } },
        family:   { select: { name: true } },
        creator:  { select: { id: true, name: true } },
      },
    })

    for (const contract of expiring) {
      const { daysUntilExpiry } = computeContractStatus(contract.endDate)
      const supplierName = contract.supplier?.name ?? 'Sin proveedor'
      const familyName   = contract.family?.name   ?? ''

      // Notificar al creador del contrato
      await NotificationService.push({
        userId:  contract.createdBy,
        type:    'WARNING',
        title:   `Contrato por vencer: ${contract.name}`,
        message: `El contrato "${contract.name}" con ${supplierName}${familyName ? ` (${familyName})` : ''} vence en ${daysUntilExpiry} día(s).`,
        metadata: {
          contractId:      contract.id,
          contractName:    contract.name,
          daysUntilExpiry,
          endDate:         contract.endDate?.toISOString(),
        },
      })

      // Marcar como alertado
      await prisma.contracts.update({
        where: { id: contract.id },
        data:  { expiryAlertSentAt: now, status: 'EXPIRING' },
      })

      await createAuditLog({
        entityType: 'contract',
        entityId:   contract.id,
        action:     'contract_expiry_alert_sent',
        userId:     contract.createdBy,
        changes:    { daysUntilExpiry, endDate: contract.endDate?.toISOString() },
      })
    }

    // Marcar como EXPIRED los que ya vencieron
    const expired = await prisma.contracts.updateMany({
      where: {
        status:  { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    return { alertsSent: expiring.length, markedExpired: expired.count }
  }
}
