/**
 * EquipmentInvoiceService — Pagos / facturas de adquisición de equipos.
 *
 * Cada registro representa una factura o pago asociado a la compra
 * de un activo individual. Complementa los campos planos `purchasePrice`
 * e `invoiceNumber` del modelo `equipment` cuando se necesita trazabilidad
 * completa (financiamiento por cuotas, múltiples facturas, etc.).
 *
 * Pago por abonos: el status de una factura SIEMPRE se deriva de
 * sum(installments.amount) vs amount vs dueDate (ver computeAcquisitionStatus)
 * — nunca es un hecho independiente. `markAsPaid` es un envoltorio de
 * `registerPayment` sin monto (paga el saldo restante completo, igual que
 * siempre); `registerPayment` con un monto menor registra un abono parcial.
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AcquisitionPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'PARTIALLY_PAID'
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

/**
 * Plan de cuotas: cada cuota se crea como una fila normal de
 * equipment_invoices, "hermana" de las demás vía scheduleGroupId — no una
 * jerarquía nueva. Cada cuota tiene su propia fecha de vencimiento y, a
 * partir de ahí, se edita/abona/elimina exactamente igual que cualquier
 * factura de pago único (ver create/registerPayment/delete).
 */
export interface CreateEquipmentInvoiceScheduleInput {
  equipmentId: string
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  currency?: string
  supplierId?: string | null
  supplierName?: string | null
  notes?: string | null
  installments: { amount: number; dueDate: Date }[]
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

// ── Helper: estado automático ─────────────────────────────────────────────────

const EPS = 0.01

export function computeAcquisitionStatus(
  dueDate: Date | null | undefined,
  amount: number,
  paidAmount: number
): AcquisitionPaymentStatus {
  if (amount - paidAmount <= EPS) return 'PAID'
  if (dueDate) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    if (due < today) return 'OVERDUE'
  }
  if (paidAmount > EPS) return 'PARTIALLY_PAID'
  return 'PENDING'
}

// ── Sincronizar campos planos del equipo desde el libro de facturas ───────────
//
// `equipment.purchasePrice/purchaseDate/invoiceNumber/purchaseOrderNumber/
// supplierId` se leen directamente (depreciación, reportes, dashboard, ventas)
// en muchos lugares que no pueden pasar a consultar `equipment_invoices` en
// vivo sin un cambio mucho más grande. En vez de eso, esos campos planos pasan
// a ser un espejo automático del libro de facturas: se recalculan cada vez que
// una factura se crea/edita/paga/cancela/elimina, para que el usuario solo
// tenga que escribir el precio/fecha/N° de factura UNA vez (ya sea al crear el
// equipo o después vía "Registrar factura"), nunca por separado en los dos
// lugares.
//
// purchasePrice = suma de montos de facturas no canceladas (el monto total
//                 adeudado, no lo ya pagado — eso no cambia con los abonos).
// purchaseDate  = la fecha más antigua entre esas facturas (paidDate si ya se
//                 pagó, si no dueDate, si no la fecha de creación del registro).
// invoiceNumber/purchaseOrderNumber/supplierId = los de la factura más antigua
//                 (con una sola factura activa coincide 1:1 con hoy).
//
// Si no queda ninguna factura activa (se cancelaron/borraron todas), NO se
// tocan los campos planos — se conserva el último valor conocido en vez de
// forzarlo a $0, que rompería la depreciación ya calculada.
export async function syncEquipmentPurchaseFields(equipmentId: string): Promise<void> {
  const invoices = await prisma.equipment_invoices.findMany({
    where: { equipmentId, status: { not: 'CANCELLED' } },
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

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      purchasePrice: totalAmount,
      purchaseDate: earliestDate,
      invoiceNumber: primary.invoiceNumber,
      purchaseOrderNumber: primary.purchaseOrderNumber,
      ...(primary.supplierId ? { supplierId: primary.supplierId } : {}),
    },
  })
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class EquipmentInvoiceService {
  // ── Listar facturas de un equipo ──────────────────────────────────────────

  static async listByEquipment(equipmentId: string) {
    const invoices = await prisma.equipment_invoices.findMany({
      where: { equipmentId },
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

  // ── Recalcular vencidas ────────────────────────────────────────────────────
  // No hay ningún job/cron que revise el paso del tiempo para esta tabla (a
  // diferencia de contract_payments, que tiene checkPaymentAlerts): status es
  // una columna que solo se recalcula al crear/editar/abonar una factura. Para
  // que "Vencido" sea confiable sin depender de que corra un cron, se
  // recalcula aquí mismo, en cada listado — barato (un updateMany condicional)
  // y garantiza que la pestaña Activos siempre refleje la fecha real. Incluye
  // PARTIALLY_PAID: un abono parcial no rescata la urgencia de estar vencido.
  static async recomputeOverdue(): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.equipment_invoices.updateMany({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
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
    await this.recomputeOverdue()

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

    const [invoicesRaw, total] = await Promise.all([
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
          installments: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment_invoices.count({ where }),
    ])

    const invoices = invoicesRaw.map(inv => ({
      ...inv,
      paidAmount: inv.installments.reduce((s, i) => s + i.amount, 0),
    }))

    return { invoices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  // ── Obtener una factura ───────────────────────────────────────────────────

  static async getById(id: string) {
    const invoice = await prisma.equipment_invoices.findUnique({
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

  static async create(input: CreateEquipmentInvoiceInput) {
    // Atajo existente: si se crea la factura con paidDate, se registra de
    // inmediato como pagada por completo — igual que siempre, pero ahora esto
    // se traduce en un abono por el monto total, para que sum(installments)
    // siga siendo la única fuente de verdad de cuánto se ha pagado.
    const hasInitialPayment = !!input.paidDate
    const status: AcquisitionPaymentStatus = hasInitialPayment
      ? 'PAID'
      : computeAcquisitionStatus(input.dueDate, input.amount, 0)

    const invoice = await prisma.$transaction(async tx => {
      const created = await tx.equipment_invoices.create({
        data: {
          id: randomUUID(),
          equipmentId: input.equipmentId,
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
        await tx.equipment_invoice_installments.create({
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

      return tx.equipment_invoices.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          supplier: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true } },
          installments: true,
        },
      })
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

    await syncEquipmentPurchaseFields(input.equipmentId)

    return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
  }

  // ── Crear plan de cuotas ──────────────────────────────────────────────────
  // N facturas "hermanas" (mismo proveedor/N° factura/N° OC/moneda/notas,
  // monto y vencimiento propios por cuota), agrupadas por scheduleGroupId.
  // Cubre el caso "primera cuota distinta + resto igual" sin tocar nada del
  // modelo de abonos ya construido — cada cuota se abona/edita/elimina
  // exactamente igual que una factura de pago único.

  static async createSchedule(input: CreateEquipmentInvoiceScheduleInput) {
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
        const row = await tx.equipment_invoices.create({
          data: {
            id: randomUUID(),
            equipmentId: input.equipmentId,
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
          entityType: 'equipment_invoice',
          entityId: row.id,
          action: 'EQUIPMENT_INVOICE_CREATED',
          userId: input.createdBy,
          changes: {
            equipmentId: input.equipmentId,
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

    await syncEquipmentPurchaseFields(input.equipmentId)

    const invoices = await prisma.equipment_invoices.findMany({
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

  static async update(id: string, input: UpdateEquipmentInvoiceInput, updatedBy: string) {
    const before = await prisma.equipment_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, paidDate: true, dueDate: true, equipmentId: true },
    })
    if (!before) throw new Error('Factura no encontrada')

    const paidAmount = await this.sumInstallments(id)
    const targetAmount = input.amount !== undefined ? input.amount : before.amount

    // Guard: no se puede bajar el monto por debajo de lo ya abonado.
    if (input.amount !== undefined && input.amount < paidAmount - EPS) {
      throw new Error(
        `El monto no puede ser menor a lo ya abonado ($${paidAmount.toLocaleString()}).`
      )
    }
    // Guard: no se puede limpiar la fecha de pago si ya hay abonos registrados.
    if (input.paidDate === null && paidAmount > EPS) {
      throw new Error(
        'Esta factura tiene abonos registrados; edita o elimina los abonos en vez de la fecha de pago.'
      )
    }
    // Guard: no se puede marcar "Pagado" a mano si los abonos no cubren el monto.
    if (input.status === 'PAID' && paidAmount < targetAmount - EPS) {
      throw new Error(
        "No se puede marcar como pagado manualmente: usa 'Registrar pago' o completa el abono."
      )
    }

    return prisma.$transaction(async tx => {
      // Sugar: setear paidDate directo con cero abonos existentes → crea un
      // abono por el monto completo, igual que el atajo de create().
      let effectivePaidAmount = paidAmount
      if (input.paidDate !== undefined && input.paidDate !== null && paidAmount <= EPS) {
        await tx.equipment_invoice_installments.create({
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

      const invoice = await tx.equipment_invoices.update({
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
        entityType: 'equipment_invoice',
        entityId: id,
        action: 'EQUIPMENT_INVOICE_UPDATED',
        userId: updatedBy,
        changes: {
          before: { amount: before.amount, status: before.status },
          after: { amount: invoice.amount, status: invoice.status },
        },
      })

      await syncEquipmentPurchaseFields(before.equipmentId)

      return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
    })
  }

  // ── Abonos (pagos parciales) ──────────────────────────────────────────────

  /** Suma de abonos registrados contra una factura. */
  static async sumInstallments(invoiceId: string): Promise<number> {
    const result = await prisma.equipment_invoice_installments.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  static async listInstallments(invoiceId: string) {
    return prisma.equipment_invoice_installments.findMany({
      where: { invoiceId },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getInstallmentById(installmentId: string) {
    return prisma.equipment_invoice_installments.findUnique({ where: { id: installmentId } })
  }

  /**
   * Registra un pago — completo o parcial — contra una factura. `amount`
   * omitido paga el saldo restante completo (comportamiento de "Pagar" de
   * siempre — ver markAsPaid). El status se deriva siempre de la suma de
   * abonos, nunca se marca "pagada" de forma directa.
   */
  static async registerPayment(id: string, data: RegisterPaymentInput, createdBy: string) {
    return prisma.$transaction(async tx => {
      const parent = await tx.equipment_invoices.findUnique({
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

      await tx.equipment_invoice_installments.create({
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

      const invoice = await tx.equipment_invoices.update({
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
        entityType: 'equipment_invoice',
        entityId: id,
        action: 'EQUIPMENT_INVOICE_PAYMENT_REGISTERED',
        userId: createdBy,
        changes: {
          amount,
          paidDate: data.paidDate.toISOString(),
          newStatus,
          remaining: remaining - amount,
        },
      })

      await syncEquipmentPurchaseFields(parent.equipmentId)

      return { ...invoice, paidAmount: invoice.installments.reduce((s, i) => s + i.amount, 0) }
    })
  }

  /** Deshacer un abono: lo elimina y re-deriva el status de la factura. */
  static async deleteInstallment(installmentId: string, deletedBy: string) {
    return prisma.$transaction(async tx => {
      const installment = await tx.equipment_invoice_installments.findUnique({
        where: { id: installmentId },
      })
      if (!installment) throw new Error('Abono no encontrado')

      await tx.equipment_invoice_installments.delete({ where: { id: installmentId } })

      const remainingAgg = await tx.equipment_invoice_installments.aggregate({
        where: { invoiceId: installment.invoiceId },
        _sum: { amount: true },
      })
      const paidAmount = remainingAgg._sum.amount ?? 0

      const parent = await tx.equipment_invoices.findUniqueOrThrow({
        where: { id: installment.invoiceId },
      })
      const newStatus = computeAcquisitionStatus(parent.dueDate, parent.amount, paidAmount)

      await tx.equipment_invoices.update({
        where: { id: installment.invoiceId },
        data: {
          status: newStatus,
          ...(newStatus !== 'PAID' && { paidDate: null }),
        },
      })

      await createAuditLog({
        entityType: 'equipment_invoice',
        entityId: installment.invoiceId,
        action: 'EQUIPMENT_INVOICE_PAYMENT_DELETED',
        userId: deletedBy,
        changes: { amount: installment.amount, newStatus },
      })

      await syncEquipmentPurchaseFields(parent.equipmentId)

      return { invoiceId: installment.invoiceId }
    })
  }

  // ── Marcar como pagado ────────────────────────────────────────────────────
  // Envoltorio de registerPayment sin monto — paga el saldo restante
  // completo, exactamente el comportamiento de siempre para todo llamador
  // existente (AcquisitionInvoicesCard, la ruta PATCH action:'markAsPaid').

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
    const invoice = await prisma.equipment_invoices.findUnique({
      where: { id },
      select: { amount: true, status: true, equipmentId: true },
    })
    if (!invoice) throw new Error('Factura no encontrada')

    const paidAmount = await this.sumInstallments(id)
    if (paidAmount > EPS) {
      throw new Error(
        'No se puede eliminar: esta factura ya tiene abonos registrados. Elimina los abonos primero si necesitas corregirla.'
      )
    }

    await prisma.equipment_invoices.delete({ where: { id } })

    await createAuditLog({
      entityType: 'equipment_invoice',
      entityId: id,
      action: 'EQUIPMENT_INVOICE_DELETED',
      userId: deletedBy,
      changes: { amount: invoice.amount, status: invoice.status },
    })

    await syncEquipmentPurchaseFields(invoice.equipmentId)
  }

  // ── Estadísticas por equipo ───────────────────────────────────────────────

  static async getStatsByEquipment(equipmentId: string) {
    const invoices = await prisma.equipment_invoices.findMany({
      where: { equipmentId },
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
