/**
 * LicenseInvoiceService — Pagos / facturas de adquisición de licencias.
 *
 * Mismo propósito y forma que EquipmentInvoiceService, para licencias.
 * Cada registro representa una factura o pago asociado a la compra de una
 * licencia individual. Complementa los campos planos `cost`/`purchaseDate`/
 * `invoiceNumber`/`purchaseOrderNumber` de `software_licenses`, que se
 * sincronizan automáticamente desde aquí (ver syncLicensePurchaseFields).
 *
 * `renewalCost`/`renewalDate` quedan fuera de este libro a propósito — esos
 * siguen ligados al contrato vinculado (resolveLicenseFinancialFromContract),
 * sin cambios.
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'
import {
  computeAcquisitionStatus,
  type AcquisitionPaymentStatus,
  type PaymentMethodType,
} from '@/lib/services/equipment-invoice.service'

export type { AcquisitionPaymentStatus, PaymentMethodType }

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CreateLicenseInvoiceInput {
  licenseId: string
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

export interface UpdateLicenseInvoiceInput {
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

// ── Sincronizar campos planos de la licencia desde el libro de facturas ───────
// Mismo criterio que syncEquipmentPurchaseFields: cost = suma de facturas
// activas, purchaseDate = la más antigua, invoiceNumber/purchaseOrderNumber/
// supplierId = los de la factura más antigua. Si no queda ninguna factura
// activa no se tocan los campos (se conserva el último valor conocido).
export async function syncLicensePurchaseFields(licenseId: string): Promise<void> {
  const invoices = await prisma.license_invoices.findMany({
    where: { licenseId, status: { not: 'CANCELLED' } },
    select: {
      amount: true,
      invoiceNumber: true,
      purchaseOrderNumber: true,
      supplierId: true,
      paidDate: true,
      dueDate: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (invoices.length === 0) return

  const totalAmount = invoices.reduce((sum, i) => sum + i.amount, 0)
  const earliestDate = invoices.reduce<Date | null>((min, i) => {
    const d = i.paidDate ?? i.dueDate ?? i.createdAt
    return !min || d < min ? d : min
  }, null)
  const primary = invoices[0]

  await prisma.software_licenses.update({
    where: { id: licenseId },
    data: {
      cost: totalAmount,
      purchaseDate: earliestDate,
      invoiceNumber: primary.invoiceNumber,
      purchaseOrderNumber: primary.purchaseOrderNumber,
      ...(primary.supplierId ? { supplierId: primary.supplierId } : {}),
    },
  })
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class LicenseInvoiceService {
  // ── Listar facturas de una licencia ───────────────────────────────────────

  static async listByLicense(licenseId: string) {
    return prisma.license_invoices.findMany({
      where: { licenseId },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  // ── Obtener una factura ───────────────────────────────────────────────────

  static async getById(id: string) {
    return prisma.license_invoices.findUnique({
      where: { id },
      include: {
        license: {
          select: {
            id: true,
            name: true,
            typeId: true,
            licenseType: { select: { name: true, familyId: true } },
          },
        },
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
      },
    })
  }

  // ── Crear factura ─────────────────────────────────────────────────────────

  static async create(input: CreateLicenseInvoiceInput) {
    const status = computeAcquisitionStatus(input.dueDate, input.paidDate)

    const invoice = await prisma.license_invoices.create({
      data: {
        id: randomUUID(),
        licenseId: input.licenseId,
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
      entityType: 'license_invoice',
      entityId: invoice.id,
      action: 'LICENSE_INVOICE_CREATED',
      userId: input.createdBy,
      changes: {
        licenseId: input.licenseId,
        amount: input.amount,
        currency: invoice.currency,
        invoiceNumber: input.invoiceNumber,
        status,
      },
    })

    await syncLicensePurchaseFields(input.licenseId)

    return invoice
  }

  // ── Actualizar factura ────────────────────────────────────────────────────

  static async update(id: string, input: UpdateLicenseInvoiceInput, updatedBy: string) {
    const before = await prisma.license_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, paidDate: true, dueDate: true, licenseId: true },
    })
    if (!before) throw new Error('Factura no encontrada')

    let newStatus = input.status
    if (input.dueDate !== undefined || input.paidDate !== undefined) {
      const due = input.dueDate !== undefined ? input.dueDate : before.dueDate
      const paid = input.paidDate !== undefined ? input.paidDate : before.paidDate
      newStatus = computeAcquisitionStatus(due, paid)
    }

    const invoice = await prisma.license_invoices.update({
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
      entityType: 'license_invoice',
      entityId: id,
      action: 'LICENSE_INVOICE_UPDATED',
      userId: updatedBy,
      changes: {
        before: { amount: before.amount, status: before.status },
        after: { amount: invoice.amount, status: invoice.status },
      },
    })

    await syncLicensePurchaseFields(before.licenseId)

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
    const invoice = await prisma.license_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, licenseId: true },
    })
    if (!invoice) throw new Error('Factura no encontrada')

    await prisma.license_invoices.delete({ where: { id } })

    await createAuditLog({
      entityType: 'license_invoice',
      entityId: id,
      action: 'LICENSE_INVOICE_DELETED',
      userId: deletedBy,
      changes: { amount: invoice.amount, status: invoice.status },
    })

    await syncLicensePurchaseFields(invoice.licenseId)
  }

  // ── Listar global (para /inventory/payments pestaña Activos) ──────────────
  // Mismo criterio que EquipmentInvoiceService.listGlobal — el llamador
  // (equipment-payments/route.ts) hace la mezcla con las facturas de equipo.

  static async listGlobal(params: {
    status?: AcquisitionPaymentStatus
    familyId?: string
    allowedFamilyIds?: string[]
    search?: string
    fromDate?: Date
    toDate?: Date
    take?: number
  }) {
    const { status, familyId, allowedFamilyIds, search, fromDate, toDate, take = 500 } = params

    const where: any = {}
    if (status) where.status = status
    if (fromDate || toDate) {
      where.dueDate = {}
      if (fromDate) where.dueDate.gte = fromDate
      if (toDate) where.dueDate.lte = toDate
    }

    // Filtro por familia a través de la licencia → tipo → familia
    const licenseFilter: any = {}
    if (familyId) {
      licenseFilter.licenseType = { familyId }
    } else if (allowedFamilyIds && allowedFamilyIds.length > 0) {
      licenseFilter.licenseType = { familyId: { in: allowedFamilyIds } }
    }
    if (search?.trim()) {
      licenseFilter.name = { contains: search.trim(), mode: 'insensitive' as const }
    }
    if (Object.keys(licenseFilter).length > 0) {
      where.license = licenseFilter
    }

    const [invoices, total] = await Promise.all([
      prisma.license_invoices.findMany({
        where,
        include: {
          license: {
            select: {
              id: true,
              name: true,
              licenseType: {
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
        take,
      }),
      prisma.license_invoices.count({ where }),
    ])

    return { invoices, total }
  }

  // ── Estadísticas por licencia ─────────────────────────────────────────────

  static async getStatsByLicense(licenseId: string) {
    const invoices = await prisma.license_invoices.findMany({
      where: { licenseId },
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
