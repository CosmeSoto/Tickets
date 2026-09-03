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
 *
 * Pago por abonos: mismo criterio exacto que EquipmentInvoiceService — ver
 * ahí el detalle. `computeAcquisitionStatus` es compartida (importada).
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

const EPS = 0.01

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

/** Ver el comentario gemelo en equipment-invoice.service.ts — mismo criterio
 * de plan de cuotas por filas "hermanas" (scheduleGroupId). */
export interface CreateLicenseInvoiceScheduleInput {
  licenseId: string
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  currency?: string
  supplierId?: string | null
  supplierName?: string | null
  notes?: string | null
  installments: { amount: number; dueDate: Date }[]
  createdBy: string
}

/**
 * Convertir una factura de pago único (sin abonos) en un plan de cuotas —
 * reemplaza la factura original por N cuotas "hermanas" que heredan su
 * proveedor/moneda/N° de factura/OC/notas, en vez de dejar ambas y duplicar
 * el total adeudado de la licencia (ver `convertToSchedule`).
 */
export interface ConvertLicenseInvoiceToScheduleInput {
  installments: { amount: number; dueDate: Date }[]
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

export interface RegisterPaymentInput {
  /** Omitido = paga el saldo restante completo (comportamiento de "Pagar" de siempre). */
  amount?: number
  paidDate: Date
  paymentMethod?: PaymentMethodType | null
  referenceNumber?: string | null
  bankEntity?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  transactionId?: string | null
  notes?: string | null
}

// ── Sincronizar campos planos de la licencia desde el libro de facturas ───────
// Mismo criterio que syncEquipmentPurchaseFields: cost = suma de facturas
// activas (el monto total adeudado, no lo ya pagado — eso no cambia con los
// abonos), purchaseDate = la más antigua, invoiceNumber/purchaseOrderNumber/
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
    const invoices = await prisma.license_invoices.findMany({
      where: { licenseId },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        installments: {
          orderBy: { createdAt: 'desc' },
          include: { creator: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return invoices.map(inv => ({
      ...inv,
      paidAmount: inv.installments.reduce((s, i) => s + i.amount, 0),
    }))
  }

  // ── Obtener una factura ───────────────────────────────────────────────────

  static async getById(id: string) {
    const invoice = await prisma.license_invoices.findUnique({
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
        installments: {
          orderBy: { createdAt: 'desc' },
          include: { creator: { select: { id: true, name: true } } },
        },
      },
    })
    if (!invoice) return null
    return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
  }

  // ── Crear factura ─────────────────────────────────────────────────────────

  static async create(input: CreateLicenseInvoiceInput) {
    const hasInitialPayment = !!input.paidDate
    const status: AcquisitionPaymentStatus = hasInitialPayment
      ? 'PAID'
      : computeAcquisitionStatus(input.dueDate, input.amount, 0)

    const invoice = await prisma.$transaction(async tx => {
      const created = await tx.license_invoices.create({
        data: {
          id: randomUUID(),
          licenseId: input.licenseId,
          invoiceNumber: input.invoiceNumber ?? null,
          purchaseOrderNumber: input.purchaseOrderNumber ?? null,
          amount: input.amount,
          currency: input.currency ?? 'USD',
          dueDate: input.dueDate ?? null,
          paidDate: hasInitialPayment ? input.paidDate : null,
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
      })

      if (hasInitialPayment) {
        await tx.license_invoice_installments.create({
          data: {
            id: randomUUID(),
            invoiceId: created.id,
            amount: input.amount,
            paidDate: input.paidDate as Date,
            paymentMethod: (input.paymentMethod as any) ?? null,
            referenceNumber: input.referenceNumber ?? null,
            notes: 'Pago registrado al crear la factura',
            createdBy: input.createdBy,
          },
        })
      }

      return tx.license_invoices.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          supplier: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          installments: true,
        },
      })
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

    return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
  }

  // ── Crear plan de cuotas ──────────────────────────────────────────────────
  // Ver el comentario gemelo en EquipmentInvoiceService.createSchedule.

  static async createSchedule(input: CreateLicenseInvoiceScheduleInput) {
    if (!input.installments || input.installments.length < 2) {
      throw new Error(
        'Un plan de cuotas necesita al menos 2 cuotas — con una sola, usa el pago único.'
      )
    }
    for (const cuota of input.installments) {
      if (!cuota.amount || cuota.amount <= 0) {
        throw new Error('Cada cuota debe tener un monto mayor a 0.')
      }
      if (!cuota.dueDate) {
        throw new Error('Cada cuota debe tener una fecha de vencimiento.')
      }
    }

    const scheduleGroupId = randomUUID()
    const count = input.installments.length

    await prisma.$transaction(async tx => {
      for (let i = 0; i < count; i++) {
        const cuota = input.installments[i]
        const status = computeAcquisitionStatus(cuota.dueDate, cuota.amount, 0)
        const row = await tx.license_invoices.create({
          data: {
            id: randomUUID(),
            licenseId: input.licenseId,
            invoiceNumber: input.invoiceNumber ?? null,
            purchaseOrderNumber: input.purchaseOrderNumber ?? null,
            amount: cuota.amount,
            currency: input.currency ?? 'USD',
            dueDate: cuota.dueDate,
            status,
            supplierId: input.supplierId ?? null,
            supplierName: input.supplierName ?? null,
            notes: input.notes ?? null,
            scheduleGroupId,
            installmentNumber: i + 1,
            installmentCount: count,
            createdBy: input.createdBy,
          },
        })

        await createAuditLog({
          entityType: 'license_invoice',
          entityId: row.id,
          action: 'LICENSE_INVOICE_CREATED',
          userId: input.createdBy,
          changes: {
            licenseId: input.licenseId,
            amount: cuota.amount,
            currency: row.currency,
            invoiceNumber: input.invoiceNumber,
            status,
            scheduleGroupId,
            installmentNumber: i + 1,
            installmentCount: count,
          },
        })
      }
    })

    await syncLicensePurchaseFields(input.licenseId)

    const invoices = await prisma.license_invoices.findMany({
      where: { scheduleGroupId },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        installments: true,
      },
      orderBy: { installmentNumber: 'asc' },
    })
    return invoices.map(inv => ({ ...inv, paidAmount: 0 }))
  }

  // ── Convertir pago único → plan de cuotas ─────────────────────────────────
  // Reemplaza (no duplica) la factura: mismo guard que delete() — sin abonos
  // registrados — más heredar proveedor/moneda/N° factura/OC/notas del
  // original, así el usuario no tiene que retipearlos.

  static async convertToSchedule(
    id: string,
    input: ConvertLicenseInvoiceToScheduleInput,
    convertedBy: string
  ) {
    const invoice = await prisma.license_invoices.findUnique({ where: { id } })
    if (!invoice) throw new Error('Factura no encontrada')
    if (invoice.scheduleGroupId) {
      throw new Error('Esta factura ya es parte de un plan de cuotas.')
    }

    const paidAmount = await this.sumInstallments(id)
    if (paidAmount > EPS) {
      throw new Error(
        'No se puede convertir: esta factura ya tiene abonos registrados. Deshazlos primero si necesitas pasarla a cuotas.'
      )
    }

    if (!input.installments || input.installments.length < 2) {
      throw new Error(
        'Un plan de cuotas necesita al menos 2 cuotas — con una sola, usa el pago único.'
      )
    }
    for (const cuota of input.installments) {
      if (!cuota.amount || cuota.amount <= 0) {
        throw new Error('Cada cuota debe tener un monto mayor a 0.')
      }
      if (!cuota.dueDate) {
        throw new Error('Cada cuota debe tener una fecha de vencimiento.')
      }
    }

    const scheduleGroupId = randomUUID()
    const count = input.installments.length

    await prisma.$transaction(async tx => {
      await tx.license_invoices.delete({ where: { id } })

      for (let i = 0; i < count; i++) {
        const cuota = input.installments[i]
        const status = computeAcquisitionStatus(cuota.dueDate, cuota.amount, 0)
        const row = await tx.license_invoices.create({
          data: {
            id: randomUUID(),
            licenseId: invoice.licenseId,
            invoiceNumber: invoice.invoiceNumber,
            purchaseOrderNumber: invoice.purchaseOrderNumber,
            amount: cuota.amount,
            currency: invoice.currency,
            dueDate: cuota.dueDate,
            status,
            supplierId: invoice.supplierId,
            supplierName: invoice.supplierName,
            notes: invoice.notes,
            scheduleGroupId,
            installmentNumber: i + 1,
            installmentCount: count,
            createdBy: convertedBy,
          },
        })

        await createAuditLog({
          entityType: 'license_invoice',
          entityId: row.id,
          action: 'LICENSE_INVOICE_CREATED',
          userId: convertedBy,
          changes: {
            licenseId: invoice.licenseId,
            amount: cuota.amount,
            currency: row.currency,
            invoiceNumber: invoice.invoiceNumber,
            status,
            scheduleGroupId,
            installmentNumber: i + 1,
            installmentCount: count,
            convertedFromInvoiceId: id,
          },
        })
      }
    })

    await createAuditLog({
      entityType: 'license_invoice',
      entityId: id,
      action: 'LICENSE_INVOICE_DELETED',
      userId: convertedBy,
      changes: {
        licenseId: invoice.licenseId,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        convertedToScheduleGroupId: scheduleGroupId,
      },
    })

    await syncLicensePurchaseFields(invoice.licenseId)

    const invoices = await prisma.license_invoices.findMany({
      where: { scheduleGroupId },
      include: {
        supplier: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true } },
        installments: true,
      },
      orderBy: { installmentNumber: 'asc' },
    })
    return invoices.map(inv => ({ ...inv, paidAmount: 0 }))
  }

  // ── Actualizar factura ────────────────────────────────────────────────────

  static async update(id: string, input: UpdateLicenseInvoiceInput, updatedBy: string) {
    const before = await prisma.license_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, paidDate: true, dueDate: true, licenseId: true },
    })
    if (!before) throw new Error('Factura no encontrada')

    const paidAmount = await this.sumInstallments(id)
    const targetAmount = input.amount !== undefined ? input.amount : before.amount

    if (input.amount !== undefined && input.amount < paidAmount - EPS) {
      throw new Error(
        `El monto no puede ser menor a lo ya abonado ($${paidAmount.toLocaleString()}).`
      )
    }
    if (input.paidDate === null && paidAmount > EPS) {
      throw new Error(
        'Esta factura tiene abonos registrados; edita o elimina los abonos en vez de la fecha de pago.'
      )
    }
    if (input.status === 'PAID' && paidAmount < targetAmount - EPS) {
      throw new Error(
        "No se puede marcar como pagado manualmente: usa 'Registrar pago' o completa el abono."
      )
    }

    return prisma.$transaction(async tx => {
      let effectivePaidAmount = paidAmount
      if (input.paidDate !== undefined && input.paidDate !== null && paidAmount <= EPS) {
        await tx.license_invoice_installments.create({
          data: {
            id: randomUUID(),
            invoiceId: id,
            amount: targetAmount,
            paidDate: input.paidDate,
            paymentMethod: (input.paymentMethod as any) ?? null,
            referenceNumber: input.referenceNumber ?? null,
            notes: 'Pago registrado al editar la factura',
            createdBy: updatedBy,
          },
        })
        effectivePaidAmount = targetAmount
      }

      let newStatus = input.status
      if (
        input.dueDate !== undefined ||
        input.paidDate !== undefined ||
        input.amount !== undefined
      ) {
        const due = input.dueDate !== undefined ? input.dueDate : before.dueDate
        newStatus = computeAcquisitionStatus(due, targetAmount, effectivePaidAmount)
      }

      const invoice = await tx.license_invoices.update({
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
          installments: { orderBy: { createdAt: 'desc' } },
        },
      })

      await createAuditLog({
        entityType: 'license_invoice',
        entityId: id,
        action: 'LICENSE_INVOICE_UPDATED',
        userId: updatedBy,
        changes: {
          licenseId: before.licenseId,
          invoiceNumber: invoice.invoiceNumber,
          currency: invoice.currency,
          before: { amount: before.amount, status: before.status },
          after: { amount: invoice.amount, status: invoice.status },
        },
      })

      await syncLicensePurchaseFields(before.licenseId)

      return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
    })
  }

  // ── Abonos (pagos parciales) ──────────────────────────────────────────────

  static async sumInstallments(invoiceId: string): Promise<number> {
    const result = await prisma.license_invoice_installments.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  static async listInstallments(invoiceId: string) {
    return prisma.license_invoice_installments.findMany({
      where: { invoiceId },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getInstallmentById(installmentId: string) {
    return prisma.license_invoice_installments.findUnique({ where: { id: installmentId } })
  }

  static async registerPayment(id: string, data: RegisterPaymentInput, createdBy: string) {
    return prisma.$transaction(async tx => {
      const parent = await tx.license_invoices.findUnique({
        where: { id },
        include: { installments: { select: { amount: true } } },
      })
      if (!parent) throw new Error('Factura no encontrada')
      if (parent.status === 'PAID' || parent.status === 'CANCELLED') {
        throw new Error(
          parent.status === 'PAID'
            ? 'Esta factura ya está marcada como pagada.'
            : 'Esta factura está cancelada, no se puede marcar como pagada.'
        )
      }

      const alreadyPaid = parent.installments.reduce((s, i) => s + i.amount, 0)
      const remaining = parent.amount - alreadyPaid
      const amount = data.amount ?? remaining
      if (amount <= 0) throw new Error('El monto del abono debe ser mayor a 0.')
      if (amount > remaining + EPS) {
        throw new Error(
          `El abono ($${amount.toLocaleString()}) excede el saldo pendiente ($${remaining.toLocaleString()}).`
        )
      }

      await tx.license_invoice_installments.create({
        data: {
          id: randomUUID(),
          invoiceId: id,
          amount,
          paidDate: data.paidDate,
          paymentMethod: (data.paymentMethod as any) ?? null,
          referenceNumber: data.referenceNumber ?? null,
          notes: data.notes ?? null,
          createdBy,
        },
      })

      const newPaidAmount = alreadyPaid + amount
      const newStatus = computeAcquisitionStatus(parent.dueDate, parent.amount, newPaidAmount)

      const invoice = await tx.license_invoices.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === 'PAID' && { paidDate: data.paidDate }),
          ...(data.paymentMethod !== undefined && { paymentMethod: data.paymentMethod as any }),
          ...(data.referenceNumber !== undefined && { referenceNumber: data.referenceNumber }),
          ...(data.bankEntity !== undefined && { bankEntity: data.bankEntity }),
          ...(data.cardLast4 !== undefined && { cardLast4: data.cardLast4 }),
          ...(data.cardBrand !== undefined && { cardBrand: data.cardBrand }),
          ...(data.transactionId !== undefined && { transactionId: data.transactionId }),
        },
        include: {
          supplier: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          installments: { orderBy: { createdAt: 'desc' } },
        },
      })

      await createAuditLog({
        entityType: 'license_invoice',
        entityId: id,
        action: 'LICENSE_INVOICE_PAYMENT_REGISTERED',
        userId: createdBy,
        changes: {
          licenseId: parent.licenseId,
          invoiceNumber: parent.invoiceNumber,
          currency: parent.currency,
          amount,
          paidDate: data.paidDate.toISOString(),
          newStatus,
          remaining: remaining - amount,
        },
      })

      await syncLicensePurchaseFields(parent.licenseId)

      return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
    })
  }

  static async deleteInstallment(installmentId: string, deletedBy: string) {
    return prisma.$transaction(async tx => {
      const installment = await tx.license_invoice_installments.findUnique({
        where: { id: installmentId },
      })
      if (!installment) throw new Error('Abono no encontrado')

      await tx.license_invoice_installments.delete({ where: { id: installmentId } })

      const remainingAgg = await tx.license_invoice_installments.aggregate({
        where: { invoiceId: installment.invoiceId },
        _sum: { amount: true },
      })
      const paidAmount = remainingAgg._sum.amount ?? 0

      const parent = await tx.license_invoices.findUniqueOrThrow({
        where: { id: installment.invoiceId },
      })
      const newStatus = computeAcquisitionStatus(parent.dueDate, parent.amount, paidAmount)

      await tx.license_invoices.update({
        where: { id: installment.invoiceId },
        data: {
          status: newStatus,
          ...(newStatus !== 'PAID' && { paidDate: null }),
        },
      })

      await createAuditLog({
        entityType: 'license_invoice',
        entityId: installment.invoiceId,
        action: 'LICENSE_INVOICE_PAYMENT_DELETED',
        userId: deletedBy,
        changes: {
          licenseId: parent.licenseId,
          invoiceNumber: parent.invoiceNumber,
          currency: parent.currency,
          amount: installment.amount,
          newStatus,
        },
      })

      await syncLicensePurchaseFields(parent.licenseId)

      return { invoiceId: installment.invoiceId }
    })
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
    return this.registerPayment(id, { ...data, amount: undefined }, updatedBy)
  }

  // ── Cancelar ──────────────────────────────────────────────────────────────

  static async cancel(id: string, cancelledBy: string) {
    const paidAmount = await this.sumInstallments(id)
    if (paidAmount > EPS) {
      throw new Error('No se puede cancelar: esta factura ya tiene abonos registrados.')
    }
    return this.update(id, { status: 'CANCELLED' }, cancelledBy)
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  static async delete(id: string, deletedBy: string) {
    const invoice = await prisma.license_invoices.findUnique({
      where: { id },
      select: { amount: true, currency: true, status: true, licenseId: true, invoiceNumber: true },
    })
    if (!invoice) throw new Error('Factura no encontrada')

    const paidAmount = await this.sumInstallments(id)
    if (paidAmount > EPS) {
      throw new Error(
        'No se puede eliminar: esta factura ya tiene abonos registrados. Elimina los abonos primero si necesitas corregirla.'
      )
    }

    await prisma.license_invoices.delete({ where: { id } })

    await createAuditLog({
      entityType: 'license_invoice',
      entityId: id,
      action: 'LICENSE_INVOICE_DELETED',
      userId: deletedBy,
      changes: {
        licenseId: invoice.licenseId,
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        amount: invoice.amount,
        status: invoice.status,
      },
    })

    await syncLicensePurchaseFields(invoice.licenseId)
  }

  // ── Recalcular vencidas ────────────────────────────────────────────────────
  // Mismo criterio que EquipmentInvoiceService.recomputeOverdue — ver ahí el
  // porqué (no hay cron que revise esta tabla, se recalcula en cada listado).
  // Incluye PARTIALLY_PAID: un abono parcial no rescata la urgencia de estar
  // vencido.
  static async recomputeOverdue(): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.license_invoices.updateMany({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    })
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
    await this.recomputeOverdue()

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

    const [invoicesRaw, total] = await Promise.all([
      prisma.license_invoices.findMany({
        where,
        include: {
          license: {
            select: {
              id: true,
              code: true,
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
          installments: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take,
      }),
      prisma.license_invoices.count({ where }),
    ])

    const invoices = invoicesRaw.map(inv => ({
      ...inv,
      paidAmount: inv.installments.reduce((s, i) => s + i.amount, 0),
    }))

    return { invoices, total }
  }

  // ── Estadísticas por licencia ─────────────────────────────────────────────

  static async getStatsByLicense(licenseId: string) {
    const invoices = await prisma.license_invoices.findMany({
      where: { licenseId },
      select: {
        amount: true,
        currency: true,
        status: true,
        installments: { select: { amount: true } },
      },
    })

    const total = invoices.reduce((s, i) => s + i.amount, 0)
    const paid = invoices
      .filter(i => i.status !== 'CANCELLED')
      .reduce((s, i) => s + i.installments.reduce((si, x) => si + x.amount, 0), 0)
    const pending = invoices
      .filter(
        i => i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIALLY_PAID'
      )
      .reduce((s, i) => {
        const invoicePaid = i.installments.reduce((si, x) => si + x.amount, 0)
        return s + (i.amount - invoicePaid)
      }, 0)

    return {
      count: invoices.length,
      totalAmount: total,
      paidAmount: paid,
      pendingAmount: pending,
      currency: invoices[0]?.currency ?? 'USD',
    }
  }
}
