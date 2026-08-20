/**
 * EquipmentInvoiceService — Pagos / facturas de adquisición de equipos.
 *
 * Cada registro representa una factura o pago asociado a la compra
 * de un activo individual. Complementa los campos planos `purchasePrice`
 * e `invoiceNumber` del modelo `equipment` cuando se necesita trazabilidad
 * completa (financiamiento por cuotas, múltiples facturas, etc.).
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AcquisitionPaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type PaymentMethodType =
  | 'CORPORATE_CARD'
  | 'PAYPAL'
  | 'CRYPTO'
  | 'BANK_TRANSFER'
  | 'CHECK'
  | 'PROVIDER_INVOICE'
  | 'OTHER'

export interface CreateEquipmentInvoiceInput {
  equipmentId: string
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  amount: number
  currency?: string
  dueDate?: Date | null
  paidDate?: Date | null
  paymentMethod?: PaymentMethodType | null
  supplierId?: string | null
  supplierName?: string | null
  referenceNumber?: string | null
  bankEntity?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  transactionId?: string | null
  notes?: string | null
  createdBy: string
}

export interface UpdateEquipmentInvoiceInput {
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  amount?: number
  currency?: string
  dueDate?: Date | null
  paidDate?: Date | null
  status?: AcquisitionPaymentStatus
  paymentMethod?: PaymentMethodType | null
  supplierId?: string | null
  supplierName?: string | null
  referenceNumber?: string | null
  bankEntity?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  transactionId?: string | null
  notes?: string | null
}

// ── Helper: estado automático ─────────────────────────────────────────────────

export function computeAcquisitionStatus(
  dueDate: Date | null | undefined,
  paidDate: Date | null | undefined
): AcquisitionPaymentStatus {
  if (paidDate) return 'PAID'
  if (!dueDate) return 'PENDING'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  if (due < today) return 'OVERDUE'
  return 'PENDING'
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class EquipmentInvoiceService {
  // ── Listar facturas de un equipo ──────────────────────────────────────────

  static async listByEquipment(equipmentId: string) {
    return prisma.equipment_invoices.findMany({
      where: { equipmentId },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── Listar global (para /inventory/payments pestaña Activos) ──────────────

  static async listGlobal(params: {
    status?: AcquisitionPaymentStatus
    familyId?: string
    allowedFamilyIds?: string[]
    search?: string
    page?: number
    pageSize?: number
    fromDate?: Date
    toDate?: Date
  }) {
    const {
      status,
      familyId,
      allowedFamilyIds,
      search,
      page = 1,
      pageSize = 100,
      fromDate,
      toDate,
    } = params

    const where: any = {}
    if (status) where.status = status
    if (fromDate || toDate) {
      where.dueDate = {}
      if (fromDate) where.dueDate.gte = fromDate
      if (toDate) where.dueDate.lte = toDate
    }

    // Filtro por familia a través del equipo → tipo → familia
    const equipmentFilter: any = {}
    if (familyId) {
      equipmentFilter.type = { familyId }
    } else if (allowedFamilyIds && allowedFamilyIds.length > 0) {
      equipmentFilter.type = { familyId: { in: allowedFamilyIds } }
    }
    if (search?.trim()) {
      equipmentFilter.OR = [
        { code: { contains: search.trim(), mode: 'insensitive' as const } },
        { brand: { contains: search.trim(), mode: 'insensitive' as const } },
      ]
    }
    if (Object.keys(equipmentFilter).length > 0) {
      where.equipment = equipmentFilter
    }

    const [invoices, total] = await Promise.all([
      prisma.equipment_invoices.findMany({
        where,
        include: {
          equipment: {
            select: {
              id: true,
              code: true,
              brand: true,
              modelDeprecated: true,
              model: { select: { model: true } },
              type: {
                select: {
                  name: true,
                  family: { select: { id: true, name: true, color: true } },
                },
              },
            },
          },
          supplier: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment_invoices.count({ where }),
    ])

    return { invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  // ── Obtener una factura ───────────────────────────────────────────────────

  static async getById(id: string) {
    return prisma.equipment_invoices.findUnique({
      where: { id },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            brand: true,
            modelDeprecated: true,
            model: { select: { model: true } },
            type: { select: { name: true, familyId: true } },
          },
        },
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    })
  }

  // ── Crear factura ─────────────────────────────────────────────────────────

  static async create(input: CreateEquipmentInvoiceInput) {
    const status = computeAcquisitionStatus(input.dueDate, input.paidDate)

    const invoice = await prisma.equipment_invoices.create({
      data: {
        id: randomUUID(),
        equipmentId: input.equipmentId,
        invoiceNumber: input.invoiceNumber ?? null,
        purchaseOrderNumber: input.purchaseOrderNumber ?? null,
        amount: input.amount,
        currency: input.currency ?? 'USD',
        dueDate: input.dueDate ?? null,
        paidDate: input.paidDate ?? null,
        status,
        paymentMethod: (input.paymentMethod as any) ?? null,
        supplierId: input.supplierId ?? null,
        supplierName: input.supplierName ?? null,
        referenceNumber: input.referenceNumber ?? null,
        bankEntity: input.bankEntity ?? null,
        cardLast4: input.cardLast4 ?? null,
        cardBrand: input.cardBrand ?? null,
        transactionId: input.transactionId ?? null,
        notes: input.notes ?? null,
        createdBy: input.createdBy,
      },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      entityType: 'equipment_invoice',
      entityId: invoice.id,
      action: 'EQUIPMENT_INVOICE_CREATED',
      userId: input.createdBy,
      changes: {
        equipmentId: input.equipmentId,
        amount: input.amount,
        currency: invoice.currency,
        invoiceNumber: input.invoiceNumber,
        status,
      },
    })

    return invoice
  }

  // ── Actualizar factura ────────────────────────────────────────────────────

  static async update(id: string, input: UpdateEquipmentInvoiceInput, updatedBy: string) {
    const before = await prisma.equipment_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, paidDate: true, dueDate: true, equipmentId: true },
    })
    if (!before) throw new Error('Factura no encontrada')

    // Recalcular status si cambian fechas
    let newStatus = input.status
    if (input.dueDate !== undefined || input.paidDate !== undefined) {
      const due = input.dueDate !== undefined ? input.dueDate : before.dueDate
      const paid = input.paidDate !== undefined ? input.paidDate : before.paidDate
      newStatus = computeAcquisitionStatus(due, paid)
    }

    const invoice = await prisma.equipment_invoices.update({
      where: { id },
      data: {
        ...(input.invoiceNumber !== undefined && { invoiceNumber: input.invoiceNumber }),
        ...(input.purchaseOrderNumber !== undefined && {
          purchaseOrderNumber: input.purchaseOrderNumber,
        }),
        ...(input.amount !== undefined && { amount: input.amount }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
        ...(input.paidDate !== undefined && { paidDate: input.paidDate }),
        ...(newStatus !== undefined && { status: newStatus as any }),
        ...(input.paymentMethod !== undefined && { paymentMethod: input.paymentMethod as any }),
        ...(input.supplierId !== undefined && { supplierId: input.supplierId }),
        ...(input.supplierName !== undefined && { supplierName: input.supplierName }),
        ...(input.referenceNumber !== undefined && { referenceNumber: input.referenceNumber }),
        ...(input.bankEntity !== undefined && { bankEntity: input.bankEntity }),
        ...(input.cardLast4 !== undefined && { cardLast4: input.cardLast4 }),
        ...(input.cardBrand !== undefined && { cardBrand: input.cardBrand }),
        ...(input.transactionId !== undefined && { transactionId: input.transactionId }),
        ...(input.notes !== undefined && { notes: input.notes }),
      },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    })

    await createAuditLog({
      entityType: 'equipment_invoice',
      entityId: id,
      action: 'EQUIPMENT_INVOICE_UPDATED',
      userId: updatedBy,
      changes: {
        before: { amount: before.amount, status: before.status },
        after: { amount: invoice.amount, status: invoice.status },
      },
    })

    return invoice
  }

  // ── Marcar como pagado ────────────────────────────────────────────────────

  static async markAsPaid(
    id: string,
    data: {
      paidDate: Date
      paymentMethod?: PaymentMethodType | null
      referenceNumber?: string | null
      bankEntity?: string | null
      cardLast4?: string | null
      cardBrand?: string | null
      transactionId?: string | null
      notes?: string | null
    },
    updatedBy: string
  ) {
    return this.update(
      id,
      {
        paidDate: data.paidDate,
        status: 'PAID',
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        bankEntity: data.bankEntity,
        cardLast4: data.cardLast4,
        cardBrand: data.cardBrand,
        transactionId: data.transactionId,
        notes: data.notes,
      },
      updatedBy
    )
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  static async cancel(id: string, cancelledBy: string) {
    return this.update(id, { status: 'CANCELLED' }, cancelledBy)
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  static async delete(id: string, deletedBy: string) {
    const invoice = await prisma.equipment_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, equipmentId: true },
    })
    if (!invoice) throw new Error('Factura no encontrada')

    await prisma.equipment_invoices.delete({ where: { id } })

    await createAuditLog({
      entityType: 'equipment_invoice',
      entityId: id,
      action: 'EQUIPMENT_INVOICE_DELETED',
      userId: deletedBy,
      changes: { amount: invoice.amount, status: invoice.status },
    })
  }

  // ── Estadísticas por equipo ───────────────────────────────────────────────

  static async getStatsByEquipment(equipmentId: string) {
    const invoices = await prisma.equipment_invoices.findMany({
      where: { equipmentId },
      select: { amount: true, currency: true, status: true },
    })

    const total = invoices.reduce((s, i) => s + i.amount, 0)
    const paid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0)
    const pending = invoices
      .filter(i => i.status === 'PENDING' || i.status === 'OVERDUE')
      .reduce((s, i) => s + i.amount, 0)

    return {
      count: invoices.length,
      totalAmount: total,
      paidAmount: paid,
      pendingAmount: pending,
      currency: invoices[0]?.currency ?? 'USD',
    }
  }
}
