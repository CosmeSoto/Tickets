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
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { EXPIRING_DAYS, type ContractStatus } from '@/types/contracts'
import {
  CONTRACT_CATEGORY_VALUES,
  CONTRACT_BILLING_CYCLE_VALUES,
  CONTRACT_LINE_TYPE_VALUES,
} from '@/lib/validations/contracts'
import {
  getBillingCompletenessIssues,
  methodNeedsPortal,
} from '@/lib/contracts/billing-completeness'
import { syncContractLicenseLines } from '@/lib/contracts/license-sync'
import { syncContractEquipmentLines } from '@/lib/contracts/equipment-sync'

// ── Guard helpers ─────────────────────────────────────────────────────────────

function toValidCategory(value: unknown): (typeof CONTRACT_CATEGORY_VALUES)[number] {
  if (
    typeof value === 'string' &&
    (CONTRACT_CATEGORY_VALUES as readonly string[]).includes(value)
  ) {
    return value as (typeof CONTRACT_CATEGORY_VALUES)[number]
  }
  return 'SERVICE' // fallback seguro
}

function toValidBillingCycle(value: unknown): (typeof CONTRACT_BILLING_CYCLE_VALUES)[number] {
  if (
    typeof value === 'string' &&
    (CONTRACT_BILLING_CYCLE_VALUES as readonly string[]).includes(value)
  ) {
    return value as (typeof CONTRACT_BILLING_CYCLE_VALUES)[number]
  }
  return 'MONTHLY'
}

function toValidLineType(value: unknown): (typeof CONTRACT_LINE_TYPE_VALUES)[number] {
  if (
    typeof value === 'string' &&
    (CONTRACT_LINE_TYPE_VALUES as readonly string[]).includes(value)
  ) {
    return value as (typeof CONTRACT_LINE_TYPE_VALUES)[number]
  }
  return 'SERVICE'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function computeContractStatus(endDate?: Date | null): {
  status: ContractStatus
  daysUntilExpiry?: number
} {
  if (!endDate) return { status: 'ACTIVE' }
  const now = new Date()
  const diff = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { status: 'EXPIRED', daysUntilExpiry: 0 }
  if (diff <= EXPIRING_DAYS) return { status: 'EXPIRING', daysUntilExpiry: diff }
  return { status: 'ACTIVE', daysUntilExpiry: diff }
}

// Selector reutilizable para incluir relaciones en queries
const CONTRACT_INCLUDE = {
  supplier: { select: { id: true, name: true } },
  family: { select: { id: true, name: true, color: true, code: true } },
  model: { select: { id: true, brand: true, model: true, sku: true } },
  batch: {
    select: {
      id: true,
      batchCode: true,
      description: true,
      quantity: true,
      purchaseDate: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
  creator: { select: { id: true, name: true, email: true } },
  custodian: { select: { id: true, name: true, email: true, role: true } },
  backupCustodian: { select: { id: true, name: true, email: true, role: true } },
  lines: {
    orderBy: { order: 'asc' as const },
    include: {
      equipment: { select: { id: true, code: true, brand: true, modelDeprecated: true } },
      license: { select: { id: true, name: true } },
    },
  },
  attachments: { orderBy: { createdAt: 'asc' as const } },
} as const

type BillingGovernanceInput = {
  serviceSubtype?: string | null
  paymentMethodType?: string
  paymentAccountRef?: string | null
  custodianUserId?: string | null
  backupCustodianUserId?: string | null
  billingAccountEmail?: string | null
  billingPortalUrl?: string | null
  vendorAccountId?: string | null
  paymentCardBrand?: string | null
  paymentCardLast4?: string | null
  paymentCardBank?: string | null
  paymentCardExpiry?: string | null
  corporateCardLabel?: string | null
  lastChargeDate?: string | null
  lastChargeAmount?: number | null
  lastTransactionRef?: string | null
  subscriptionUsageStatus?: string
  cancellationNoticeDays?: number | null
}

function mapBillingFields(data: BillingGovernanceInput) {
  const mapped: Record<string, unknown> = {}
  if (data.serviceSubtype !== undefined) mapped.serviceSubtype = data.serviceSubtype || null
  if (data.paymentMethodType !== undefined) mapped.paymentMethodType = data.paymentMethodType
  if (data.paymentAccountRef !== undefined)
    mapped.paymentAccountRef = data.paymentAccountRef || null
  if (data.custodianUserId !== undefined) mapped.custodianUserId = data.custodianUserId || null
  if (data.backupCustodianUserId !== undefined) {
    mapped.backupCustodianUserId = data.backupCustodianUserId || null
  }
  if (data.billingAccountEmail !== undefined) {
    mapped.billingAccountEmail = data.billingAccountEmail || null
  }
  if (data.billingPortalUrl !== undefined) mapped.billingPortalUrl = data.billingPortalUrl || null
  if (data.vendorAccountId !== undefined) mapped.vendorAccountId = data.vendorAccountId || null
  if (data.paymentCardBrand !== undefined) mapped.paymentCardBrand = data.paymentCardBrand || null
  if (data.paymentCardLast4 !== undefined) mapped.paymentCardLast4 = data.paymentCardLast4 || null
  if (data.paymentCardBank !== undefined) mapped.paymentCardBank = data.paymentCardBank || null
  if (data.paymentCardExpiry !== undefined)
    mapped.paymentCardExpiry = data.paymentCardExpiry || null
  if (data.corporateCardLabel !== undefined) {
    mapped.corporateCardLabel = data.corporateCardLabel || null
  }
  if (data.lastChargeDate !== undefined) {
    mapped.lastChargeDate = data.lastChargeDate ? new Date(data.lastChargeDate) : null
  }
  if (data.lastChargeAmount !== undefined) mapped.lastChargeAmount = data.lastChargeAmount ?? null
  if (data.lastTransactionRef !== undefined) {
    mapped.lastTransactionRef = data.lastTransactionRef || null
  }
  if (data.subscriptionUsageStatus !== undefined) {
    mapped.subscriptionUsageStatus = data.subscriptionUsageStatus
  }
  if (data.cancellationNoticeDays !== undefined) {
    mapped.cancellationNoticeDays = data.cancellationNoticeDays ?? null
  }
  return mapped
}

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
    modelId?: string
    batchId?: string
    userId?: string
    userRole?: string
    isSuperAdmin?: boolean
  }) {
    const {
      page = 1,
      pageSize = 20,
      search,
      status,
      category,
      familyId,
      supplierId,
      modelId,
      batchId,
      userId,
      userRole,
      isSuperAdmin,
    } = params

    const where: any = {}

    // SuperAdmin ve todo — sin restricción de familias
    // Admin normal: ve contratos de sus familias asignadas (si tiene asignaciones)
    // Gestor (canManageInventory): ve contratos de sus familias en user_family_access (inventory)
    if (userId && userRole && !isSuperAdmin) {
      if (userRole === 'CLIENT') {
        where.assignments = { some: { clientId: userId } }
      } else if (userRole === 'ADMIN') {
        // Admin normal: filtrar por sus familias (asignadas + nativa)
        const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
        const scope = await getAdminFamilyScope(userId, false)
        if (scope.familyIds && scope.familyIds.length > 0) {
          where.familyId = { in: scope.familyIds }
        }
      } else {
        const { getUserModuleFamilyGrantIds } = await import('@/lib/auth/user-family-access')
        const managerFamilyIds = await getUserModuleFamilyGrantIds(userId, 'inventory')
        if (managerFamilyIds.length > 0) {
          where.familyId = { in: managerFamilyIds }
        }
      }
    }

    if (search?.trim()) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ]
    }
    if (status && status !== 'ALL') where.status = status
    if (category && category !== 'ALL') where.category = category
    if (familyId) where.familyId = familyId // override explícito
    if (supplierId) where.supplierId = supplierId
    if (modelId) where.modelId = modelId
    if (batchId) where.batchId = batchId

    const [rawContracts, total] = await Promise.all([
      prisma.contracts.findMany({
        where,
        include: CONTRACT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contracts.count({ where }),
    ])

    // Recalcular status dinámicamente (puede haber cambiado desde el último guardado)
    const contracts = rawContracts.map(c => {
      const { status: computedStatus, daysUntilExpiry } = computeContractStatus(c.endDate)
      return { ...c, status: computedStatus, daysUntilExpiry }
    })

    // Stats globales (sin paginación) — respetan el mismo scope de familias del usuario
    const statsWhere: any = {}
    if (where.familyId) statsWhere.familyId = where.familyId
    else if (familyId) statsWhere.familyId = familyId
    const allForStats = await prisma.contracts.findMany({
      where: statsWhere,
      select: { endDate: true, monthlyCost: true },
    })

    const stats = allForStats.reduce(
      (acc, c) => {
        const { status } = computeContractStatus(c.endDate)
        acc.total++
        if (status === 'ACTIVE') acc.active++
        if (status === 'EXPIRING') acc.expiring++
        if (status === 'EXPIRED') acc.expired++
        if (c.monthlyCost) acc.monthlyCostTotal += c.monthlyCost
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

  static async create(
    data: {
      contractNumber?: string
      name: string
      description?: string
      category: string
      supplierId?: string
      familyId?: string
      modelId?: string
      batchId?: string
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
    } & BillingGovernanceInput
  ) {
    const { lines = [], createdBy, ...contractData } = data

    const contract = await prisma.contracts.create({
      data: {
        id: randomUUID(),
        contractNumber: contractData.contractNumber || null,
        name: contractData.name,
        description: contractData.description || null,
        category: toValidCategory(contractData.category),
        status: 'DRAFT',
        supplierId: contractData.supplierId || null,
        familyId: contractData.familyId || null,
        modelId: contractData.modelId || null,
        batchId: contractData.batchId || null,
        startDate: contractData.startDate ? new Date(contractData.startDate) : null,
        endDate: contractData.endDate ? new Date(contractData.endDate) : null,
        autoRenew: contractData.autoRenew ?? false,
        renewalNoticeDays:
          contractData.renewalNoticeDays ??
          (toValidCategory(contractData.category) === 'EQUIPMENT_RENTAL' ? 120 : 30),
        billingCycle: toValidBillingCycle(contractData.billingCycle),
        totalValue: contractData.totalValue ?? null,
        monthlyCost: contractData.monthlyCost ?? null,
        currency: contractData.currency ?? 'USD',
        contactName: contractData.contactName || null,
        contactEmail: contractData.contactEmail || null,
        contactPhone: contractData.contactPhone || null,
        notes: contractData.notes || null,
        termsUrl: contractData.termsUrl || null,
        ...mapBillingFields(contractData),
        createdBy,
        lines:
          lines.length > 0
            ? {
                create: lines.map((l, i) => ({
                  id: randomUUID(),
                  type: toValidLineType(l.type),
                  description: l.description,
                  quantity: l.quantity ?? 1,
                  unitPrice: l.unitPrice ?? null,
                  totalPrice: l.unitPrice && l.quantity ? l.unitPrice * l.quantity : null,
                  equipmentId: l.equipmentId || null,
                  licenseId: l.licenseId || null,
                  notes: l.notes || null,
                  order: l.order ?? i,
                })),
              }
            : undefined,
      },
      include: CONTRACT_INCLUDE,
    })

    // Auditoría
    await createAuditLog({
      entityType: 'contract',
      entityId: contract.id,
      action: 'contract_created',
      userId: createdBy,
      changes: {
        name: contract.name,
        category: contract.category,
        status: contract.status,
        modelId: contract.modelId,
        batchId: contract.batchId,
      },
    })

    await syncContractLicenseLines(contract.id).catch(err =>
      console.error('[contract] sync licenses on create:', err)
    )
    await syncContractEquipmentLines(contract.id).catch(err =>
      console.error('[contract] sync equipment on create:', err)
    )

    return contract
  }

  static async update(
    id: string,
    data: Partial<
      {
        contractNumber: string
        name: string
        description: string
        category: string
        supplierId: string
        familyId: string
        modelId: string
        batchId: string
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
      } & BillingGovernanceInput
    >,
    updatedBy: string
  ) {
    const before = await prisma.contracts.findUnique({
      where: { id },
      select: { name: true, status: true, endDate: true, modelId: true, batchId: true },
    })
    if (!before) throw new Error('Contrato no encontrado')

    const contract = await prisma.contracts.update({
      where: { id },
      data: {
        ...(data.contractNumber !== undefined && { contractNumber: data.contractNumber || null }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description || null }),
        ...(data.category !== undefined && { category: toValidCategory(data.category) }),
        ...(data.supplierId !== undefined && { supplierId: data.supplierId || null }),
        ...(data.familyId !== undefined && { familyId: data.familyId || null }),
        ...(data.modelId !== undefined && { modelId: data.modelId || null }),
        ...(data.batchId !== undefined && { batchId: data.batchId || null }),
        ...(data.startDate !== undefined && {
          startDate: data.startDate ? new Date(data.startDate) : null,
        }),
        ...(data.endDate !== undefined && {
          endDate: data.endDate ? new Date(data.endDate) : null,
        }),
        ...(data.autoRenew !== undefined && { autoRenew: data.autoRenew }),
        ...(data.renewalNoticeDays !== undefined && { renewalNoticeDays: data.renewalNoticeDays }),
        ...(data.billingCycle !== undefined && {
          billingCycle: toValidBillingCycle(data.billingCycle),
        }),
        ...(data.totalValue !== undefined && { totalValue: data.totalValue }),
        ...(data.monthlyCost !== undefined && { monthlyCost: data.monthlyCost }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.contactName !== undefined && { contactName: data.contactName || null }),
        ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail || null }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone || null }),
        ...(data.notes !== undefined && { notes: data.notes || null }),
        ...(data.termsUrl !== undefined && { termsUrl: data.termsUrl || null }),
        ...(data.status !== undefined && { status: data.status as any }), // status tiene su propio enum con más valores, mantenemos as any para flexibilidad
        ...mapBillingFields(data),
      },
      include: CONTRACT_INCLUDE,
    })

    await createAuditLog({
      entityType: 'contract',
      entityId: id,
      action: 'contract_updated',
      userId: updatedBy,
      changes: {
        before: {
          name: before.name,
          status: before.status,
          modelId: before.modelId,
          batchId: before.batchId,
        },
        after: {
          name: contract.name,
          status: contract.status,
          modelId: contract.modelId,
          batchId: contract.batchId,
        },
      },
    })

    await syncContractLicenseLines(id).catch(err =>
      console.error('[contract] sync licenses on update:', err)
    )
    await syncContractEquipmentLines(id).catch(err =>
      console.error('[contract] sync equipment on update:', err)
    )

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
      entityId: id,
      action: 'contract_deleted',
      userId: deletedBy,
      changes: { name: contract.name, status: contract.status },
    })
  }

  // ── Líneas ──────────────────────────────────────────────────────────────────

  static async upsertLines(
    contractId: string,
    lines: Array<{
      id?: string
      type: string
      description: string
      quantity?: number
      unitPrice?: number
      equipmentId?: string
      licenseId?: string
      notes?: string
      order?: number
    }>,
    updatedBy: string
  ) {
    // Eliminar líneas existentes y recrear (más simple que diff)
    await prisma.contract_lines.deleteMany({ where: { contractId } })

    if (lines.length > 0) {
      await prisma.contract_lines.createMany({
        data: lines.map((l, i) => ({
          id: randomUUID(),
          contractId,
          type: toValidLineType(l.type),
          description: l.description,
          quantity: l.quantity ?? 1,
          unitPrice: l.unitPrice ?? null,
          totalPrice: l.unitPrice && l.quantity ? l.unitPrice * l.quantity : null,
          equipmentId: l.equipmentId || null,
          licenseId: l.licenseId || null,
          notes: l.notes || null,
          order: l.order ?? i,
        })),
      })
    }

    await createAuditLog({
      entityType: 'contract',
      entityId: contractId,
      action: 'contract_lines_updated',
      userId: updatedBy,
      changes: { linesCount: lines.length },
    })

    await syncContractLicenseLines(contractId).catch(err =>
      console.error('[contract] sync licenses on lines:', err)
    )
    await syncContractEquipmentLines(contractId).catch(err =>
      console.error('[contract] sync equipment on lines:', err)
    )
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
        status: { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { lte: alertThreshold, gte: now },
        expiryAlertSentAt: null,
      },
      include: {
        supplier: { select: { name: true } },
        family: { select: { name: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    for (const contract of expiring) {
      const { daysUntilExpiry } = computeContractStatus(contract.endDate)
      const supplierName = contract.supplier?.name ?? 'Sin proveedor'
      const familyName = contract.family?.name ?? ''

      // Notificar al creador del contrato
      await NotificationService.push({
        userId: contract.createdBy,
        type: 'WARNING',
        title: `Contrato por vencer: ${contract.name}`,
        message: `El contrato "${contract.name}" con ${supplierName}${familyName ? ` (${familyName})` : ''} vence en ${daysUntilExpiry} día(s).`,
        metadata: {
          contractId: contract.id,
          contractName: contract.name,
          daysUntilExpiry,
          endDate: contract.endDate?.toISOString(),
        },
      })

      // Super admins + admin nativo de la familia (excluir creador si ya fue notificado)
      const familyAdmins = await getFamilyScopedAdmins(contract.familyId, { id: true })
      await Promise.all(
        familyAdmins
          .filter(admin => admin.id !== contract.createdBy)
          .map(admin =>
            NotificationService.push({
              userId: admin.id,
              type: 'WARNING',
              title: `Contrato por vencer: ${contract.name}`,
              message: `El contrato "${contract.name}" con ${supplierName}${familyName ? ` (${familyName})` : ''} vence en ${daysUntilExpiry} día(s).`,
              metadata: {
                contractId: contract.id,
                contractName: contract.name,
                daysUntilExpiry,
                endDate: contract.endDate?.toISOString(),
              },
            })
          )
      )

      // Marcar como alertado
      await prisma.contracts.update({
        where: { id: contract.id },
        data: { expiryAlertSentAt: now, status: 'EXPIRING' },
      })

      await createAuditLog({
        entityType: 'contract',
        entityId: contract.id,
        action: 'contract_expiry_alert_sent',
        userId: contract.createdBy,
        changes: { daysUntilExpiry, endDate: contract.endDate?.toISOString() },
      })
    }

    // Marcar como EXPIRED los que ya vencieron
    const expired = await prisma.contracts.updateMany({
      where: {
        status: { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { lt: now },
      },
      data: { status: 'EXPIRED' },
    })

    return { alertsSent: expiring.length, markedExpired: expired.count }
  }

  // ── Estadísticas por modelo ─────────────────────────────────────────────────

  static async getStatsByModel(modelId: string) {
    const contracts = await prisma.contracts.findMany({
      where: { modelId },
      select: { status: true, monthlyCost: true, totalValue: true, endDate: true },
    })

    const stats = contracts.reduce(
      (acc, c) => {
        const { status } = computeContractStatus(c.endDate)
        acc.total++
        if (status === 'ACTIVE') acc.active++
        if (status === 'EXPIRING') acc.expiring++
        if (status === 'EXPIRED') acc.expired++
        if (c.monthlyCost) acc.monthlyCostTotal += c.monthlyCost
        if (c.totalValue) acc.totalValueSum += c.totalValue
        return acc
      },
      { total: 0, active: 0, expiring: 0, expired: 0, monthlyCostTotal: 0, totalValueSum: 0 }
    )

    return stats
  }

  // ── Estadísticas por lote ───────────────────────────────────────────────────

  static async getStatsByBatch(batchId: string) {
    const contracts = await prisma.contracts.findMany({
      where: { batchId },
      select: { status: true, monthlyCost: true, totalValue: true, endDate: true },
    })

    const stats = contracts.reduce(
      (acc, c) => {
        const { status } = computeContractStatus(c.endDate)
        acc.total++
        if (status === 'ACTIVE') acc.active++
        if (status === 'EXPIRING') acc.expiring++
        if (status === 'EXPIRED') acc.expired++
        if (c.monthlyCost) acc.monthlyCostTotal += c.monthlyCost
        if (c.totalValue) acc.totalValueSum += c.totalValue
        return acc
      },
      { total: 0, active: 0, expiring: 0, expired: 0, monthlyCostTotal: 0, totalValueSum: 0 }
    )

    return stats
  }

  // ── Renovación de Contratos ─────────────────────────────────────────────────

  /**
   * Renueva un contrato existente creando uno nuevo vinculado
   */
  static async renewContract(params: {
    contractId: string
    newStartDate: Date
    newEndDate: Date
    updateTerms?: {
      totalValue?: number
      monthlyCost?: number
      billingCycle?: string
      notes?: string
      autoRenew?: boolean
      renewalNoticeDays?: number
    }
    userId: string
  }) {
    const { contractId, newStartDate, newEndDate, updateTerms, userId } = params

    // Obtener contrato original
    const originalContract = await prisma.contracts.findUnique({
      where: { id: contractId },
      include: {
        supplier: true,
        family: true,
        model: true,
        batch: true,
        lines: true,
      },
    })

    if (!originalContract) {
      throw new Error('Contrato no encontrado')
    }

    // Validar fechas
    if (newStartDate >= newEndDate) {
      throw new Error('La fecha de inicio debe ser anterior a la fecha de fin')
    }

    // Crear nuevo contrato (renovación)
    const renewedContract = await prisma.contracts.create({
      data: {
        id: randomUUID(),
        contractNumber: null, // Se generará automáticamente si es necesario
        name: `${originalContract.name} (Renovación ${originalContract.renewalCount + 1})`,
        description: originalContract.description,
        category: originalContract.category,
        supplierId: originalContract.supplierId,
        familyId: originalContract.familyId,
        modelId: originalContract.modelId,
        batchId: originalContract.batchId,
        startDate: newStartDate,
        endDate: newEndDate,
        totalValue: updateTerms?.totalValue ?? originalContract.totalValue,
        monthlyCost: updateTerms?.monthlyCost ?? originalContract.monthlyCost,
        billingCycle: updateTerms?.billingCycle
          ? toValidBillingCycle(updateTerms.billingCycle)
          : originalContract.billingCycle,
        currency: originalContract.currency,
        contactName: originalContract.contactName,
        contactEmail: originalContract.contactEmail,
        contactPhone: originalContract.contactPhone,
        notes: updateTerms?.notes ?? originalContract.notes,
        autoRenew: updateTerms?.autoRenew ?? originalContract.autoRenew,
        renewalNoticeDays: updateTerms?.renewalNoticeDays ?? originalContract.renewalNoticeDays,
        status: 'ACTIVE',
        renewedFromId: contractId,
        renewalCount: originalContract.renewalCount + 1,
        // Resetear alertas
        alert60DaysSent: false,
        alert30DaysSent: false,
        alert15DaysSent: false,
        expiryAlertSentAt: null,
        lastAlertSentAt: null,
        createdBy: userId,
      },
    })

    // Copiar líneas del contrato original
    if (originalContract.lines.length > 0) {
      await prisma.contract_lines.createMany({
        data: originalContract.lines.map((line, index) => ({
          id: randomUUID(),
          contractId: renewedContract.id,
          type: line.type,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
          equipmentId: line.equipmentId,
          licenseId: line.licenseId,
          notes: line.notes,
          order: index,
        })),
      })
    }

    // Actualizar contrato original
    await prisma.contracts.update({
      where: { id: contractId },
      data: {
        status: 'RENEWED',
        renewedToId: renewedContract.id,
      },
    })

    // Auditoría
    await createAuditLog({
      entityType: 'contract',
      entityId: renewedContract.id,
      action: 'contract_renewed',
      userId,
      changes: {
        originalContractId: contractId,
        originalContractName: originalContract.name,
        newContractId: renewedContract.id,
        renewalCount: renewedContract.renewalCount,
        termsUpdated: !!updateTerms,
        updatedFields: updateTerms ? Object.keys(updateTerms) : [],
        newStartDate: newStartDate.toISOString(),
        newEndDate: newEndDate.toISOString(),
      },
    })

    return renewedContract
  }

  /**
   * Obtiene historial completo de renovaciones de un contrato
   * Retorna la cadena completa desde el contrato original hasta el más reciente
   */
  static async getRenewalHistory(contractId: string) {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      include: {
        supplier: { select: { name: true } },
        family: { select: { name: true, color: true } },
        model: { select: { brand: true, model: true } },
        batch: { select: { batchCode: true } },
        creator: { select: { name: true, email: true } },
      },
    })

    if (!contract) {
      throw new Error('Contrato no encontrado')
    }

    // Construir cadena de renovaciones
    const chain: any[] = []

    // Ir hacia atrás (contratos anteriores)
    let currentId = contract.renewedFromId
    while (currentId) {
      const prevContract = await prisma.contracts.findUnique({
        where: { id: currentId },
        include: {
          supplier: { select: { name: true } },
          family: { select: { name: true, color: true } },
          model: { select: { brand: true, model: true } },
          batch: { select: { batchCode: true } },
          creator: { select: { name: true, email: true } },
        },
      })
      if (!prevContract) break
      chain.unshift(prevContract)
      currentId = prevContract.renewedFromId
    }

    // Agregar contrato actual
    chain.push(contract)

    // Ir hacia adelante (renovaciones)
    currentId = contract.renewedToId
    while (currentId) {
      const nextContract = await prisma.contracts.findUnique({
        where: { id: currentId },
        include: {
          supplier: { select: { name: true } },
          family: { select: { name: true, color: true } },
          model: { select: { brand: true, model: true } },
          batch: { select: { batchCode: true } },
          creator: { select: { name: true, email: true } },
        },
      })
      if (!nextContract) break
      chain.push(nextContract)
      currentId = nextContract.renewedToId
    }

    // Calcular diferencias entre renovaciones consecutivas
    const chainWithDiffs = chain.map((c, index) => {
      const prev = index > 0 ? chain[index - 1] : null
      const changes: any = {}

      if (prev) {
        if (c.totalValue !== prev.totalValue) {
          changes.totalValue = {
            from: prev.totalValue,
            to: c.totalValue,
            diff: c.totalValue && prev.totalValue ? c.totalValue - prev.totalValue : null,
          }
        }
        if (c.monthlyCost !== prev.monthlyCost) {
          changes.monthlyCost = {
            from: prev.monthlyCost,
            to: c.monthlyCost,
            diff: c.monthlyCost && prev.monthlyCost ? c.monthlyCost - prev.monthlyCost : null,
          }
        }
        if (c.billingCycle !== prev.billingCycle) {
          changes.billingCycle = { from: prev.billingCycle, to: c.billingCycle }
        }
        if (c.autoRenew !== prev.autoRenew) {
          changes.autoRenew = { from: prev.autoRenew, to: c.autoRenew }
        }
      }

      return {
        ...c,
        changes: Object.keys(changes).length > 0 ? changes : null,
        isOriginal: index === 0,
        isCurrent: index === chain.length - 1,
        position: index + 1,
        totalInChain: chain.length,
      }
    })

    return chainWithDiffs
  }

  /**
   * Suscripciones en riesgo: sin custodio, datos de pago incompletos o sin cliente asignado.
   */
  static async listAtRisk(params: {
    familyId?: string
    userId?: string
    userRole?: string
    isSuperAdmin?: boolean
  }) {
    const { familyId, userId, userRole, isSuperAdmin } = params
    const where: any = {
      category: { in: ['SERVICE', 'SOFTWARE_LICENSE', 'SUPPORT', 'MAINTENANCE'] },
      subscriptionUsageStatus: { in: ['ACTIVE', 'UNUSED', 'PENDING_CANCEL'] },
      status: { in: ['ACTIVE', 'EXPIRING', 'DRAFT'] },
    }

    if (familyId) where.familyId = familyId

    if (userId && userRole && !isSuperAdmin) {
      if (userRole === 'ADMIN') {
        const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
        const scope = await getAdminFamilyScope(userId, false)
        if (scope.familyIds?.length) where.familyId = { in: scope.familyIds }
      } else {
        const { getUserModuleFamilyGrantIds } = await import('@/lib/auth/user-family-access')
        const managerFamilyIds = await getUserModuleFamilyGrantIds(userId, 'inventory')
        if (managerFamilyIds.length > 0) {
          where.familyId = { in: managerFamilyIds }
        }
      }
    }

    const contracts = await prisma.contracts.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        family: { select: { id: true, name: true, color: true } },
        custodian: { select: { id: true, name: true, email: true, isActive: true } },
        assignments: {
          where: { isActive: true },
          include: {
            client: { select: { id: true, name: true, email: true, isActive: true } },
            deliveryAct: { select: { status: true } },
          },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
    })

    return contracts
      .map(c => {
        const risks: string[] = []
        if (!c.custodianUserId || !c.custodian?.isActive) {
          risks.push('Sin custodio activo')
        }
        const billingIssues = getBillingCompletenessIssues({
          paymentMethodType: c.paymentMethodType,
          paymentCardLast4: c.paymentCardLast4,
          paymentCardBank: c.paymentCardBank,
          paymentAccountRef: c.paymentAccountRef,
          billingAccountEmail: c.billingAccountEmail,
          vendorAccountId: c.vendorAccountId,
          billingPortalUrl: c.billingPortalUrl,
        })
        if (billingIssues.length > 0) {
          risks.push(billingIssues[0])
        }
        if (
          !c.billingPortalUrl &&
          !c.billingAccountEmail &&
          methodNeedsPortal(c.paymentMethodType)
        ) {
          risks.push('Sin acceso al portal de facturación')
        }
        if (!c.assignments.length) {
          risks.push('Sin cliente asignado')
        } else if (c.assignments[0].deliveryAct?.status !== 'ACCEPTED') {
          risks.push('Acta de entrega pendiente')
        }
        if (c.subscriptionUsageStatus === 'PENDING_CANCEL' && !c.lastTransactionRef) {
          risks.push('Cancelación sin referencia de transacción')
        }
        return {
          ...c,
          risks,
          riskLevel: risks.length >= 3 ? 'high' : risks.length >= 1 ? 'medium' : 'low',
        }
      })
      .filter(c => c.risks.length > 0)
  }
}
