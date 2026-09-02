/**
 * ContractPaymentService — Lógica de negocio para pagos de contratos.
 *
 * Responsabilidades:
 *  - CRUD de pagos programados
 *  - Cálculo automático de próximos pagos
 *  - Alertas de pagos próximos y vencidos
 *  - Registro de auditoría en cada operación
 *
 * Pago por abonos: el status de una cuota SIEMPRE se deriva de
 * sum(installments.amount) vs amount vs dueDate (ver computePaymentStatus)
 * — nunca es un hecho independiente. `markAsPaid` es un envoltorio de
 * `registerPayment` sin monto (paga el saldo restante completo, igual que
 * siempre); `registerPayment` con un monto menor registra un abono parcial.
 * Mismo criterio exacto que EquipmentInvoiceService/LicenseInvoiceService.
 */

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'
import { notifyContractOps } from '@/lib/contracts/notify-contract-ops'
import { amountDueOnDate, lineIsBillableOn } from '@/lib/contracts/line-billing'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PaymentStatus = 'SCHEDULED' | 'DUE' | 'OVERDUE' | 'PAID' | 'CANCELLED' | 'PARTIALLY_PAID'

const EPS = 0.01

// ── Helpers ───────────────────────────────────────────────────────────────────

export function computePaymentStatus(
  dueDate: Date,
  amount: number,
  paidAmount: number
): PaymentStatus {
  if (amount - paidAmount <= EPS) return 'PAID'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())

  if (due < today) return 'OVERDUE'
  if (paidAmount > EPS) return 'PARTIALLY_PAID'
  if (due.getTime() === today.getTime()) return 'DUE'
  return 'SCHEDULED'
}

export class PaymentsAlreadyExistError extends Error {
  constructor() {
    super('Este contrato ya tiene pagos programados. Elimínalos o cancélalos antes de regenerar.')
    this.name = 'PaymentsAlreadyExistError'
  }
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class ContractPaymentService {
  // ── Recalcular estados vencidos ────────────────────────────────────────────
  // checkPaymentAlerts() (job) también recalcula status, pero solo corre si
  // el cron está configurado y la alerta de licencias/contratos está
  // habilitada (ver /api/cron/inventory-alerts) — un admin que apaga esa
  // alerta, sin saberlo, congela también el status de las cuotas. Se
  // recalcula además aquí, en cada listado, para que SCHEDULED/DUE/OVERDUE
  // sean siempre correctos sin depender de esa configuración. Incluye
  // PARTIALLY_PAID en la transición a OVERDUE: un abono parcial no rescata
  // la urgencia de estar vencido.
  static async recomputeStatuses(): Promise<void> {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    await prisma.contract_payments.updateMany({
      where: { status: 'SCHEDULED', dueDate: { gte: today, lt: tomorrow } },
      data: { status: 'DUE' },
    })
    await prisma.contract_payments.updateMany({
      where: { status: { in: ['SCHEDULED', 'DUE', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    })
  }

  // ── Listar pagos ────────────────────────────────────────────────────────────

  static async list(params: {
    contractId?: string
    status?: PaymentStatus
    fromDate?: Date
    toDate?: Date
    page?: number
    pageSize?: number
    familyId?: string
    allowedFamilyIds?: string[]
    search?: string
  }) {
    await this.recomputeStatuses()

    const {
      contractId,
      status,
      fromDate,
      toDate,
      page = 1,
      pageSize = 50,
      familyId,
      allowedFamilyIds,
      search,
    } = params

    const where: any = {}

    if (contractId) where.contractId = contractId
    if (status) where.status = status
    if (fromDate || toDate) {
      where.dueDate = {}
      if (fromDate) where.dueDate.gte = fromDate
      if (toDate) where.dueDate.lte = toDate
    }

    const contractFilter: Record<string, unknown> = {}
    if (familyId) contractFilter.familyId = familyId
    else if (allowedFamilyIds && allowedFamilyIds.length > 0) {
      contractFilter.familyId = { in: allowedFamilyIds }
    }
    if (search?.trim()) {
      contractFilter.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { contractNumber: { contains: search.trim(), mode: 'insensitive' } },
        { supplier: { name: { contains: search.trim(), mode: 'insensitive' } } },
      ]
    }
    if (Object.keys(contractFilter).length > 0) {
      where.contract = contractFilter
    }

    const [paymentsRaw, total] = await Promise.all([
      prisma.contract_payments.findMany({
        where,
        include: {
          contract: {
            select: {
              id: true,
              name: true,
              contractNumber: true,
              supplier: { select: { name: true } },
              family: { select: { id: true, name: true, color: true } },
              billingCycle: true,
            },
          },
          creator: {
            select: { id: true, name: true, email: true },
          },
          installments: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contract_payments.count({ where }),
    ])

    const payments = paymentsRaw.map(p => ({
      ...p,
      paidAmount: p.installments.reduce((s, i) => s + i.amount, 0),
    }))

    return {
      payments,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  // ── Obtener un pago ─────────────────────────────────────────────────────────

  static async getById(id: string) {
    const payment = await prisma.contract_payments.findUnique({
      where: { id },
      include: {
        contract: {
          select: {
            id: true,
            name: true,
            contractNumber: true,
            supplier: { select: { name: true } },
            family: { select: { name: true, color: true } },
          },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
        installments: {
          orderBy: { createdAt: 'desc' },
          include: { creator: { select: { id: true, name: true } } },
        },
      },
    })
    if (!payment) return null
    return { ...payment, paidAmount: payment.installments.reduce((s, i) => s + i.amount, 0) }
  }

  // ── Crear pago ──────────────────────────────────────────────────────────────

  static async create(data: {
    contractId: string
    amount: number
    currency?: string
    dueDate: Date
    paymentMethod?: string
    referenceNumber?: string
    notes?: string
    createdBy: string
  }) {
    const status = computePaymentStatus(data.dueDate, data.amount, 0)

    const payment = await prisma.contract_payments.create({
      data: {
        id: randomUUID(),
        contractId: data.contractId,
        amount: data.amount,
        currency: data.currency || 'USD',
        dueDate: data.dueDate,
        status,
        paymentMethod: data.paymentMethod || null,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
        createdBy: data.createdBy,
      },
      include: {
        contract: {
          select: { name: true, supplier: { select: { name: true } } },
        },
      },
    })

    await createAuditLog({
      entityType: 'contract_payment',
      entityId: payment.id,
      action: 'payment_created',
      userId: data.createdBy,
      changes: {
        contractId: data.contractId,
        amount: data.amount,
        dueDate: data.dueDate.toISOString(),
        status,
      },
    })

    return payment
  }

  // ── Actualizar pago ─────────────────────────────────────────────────────────

  static async update(
    id: string,
    data: Partial<{
      amount: number
      currency: string
      dueDate: Date
      paidDate: Date | null
      status: PaymentStatus
      paymentMethod: string
      referenceNumber: string
      notes: string
      cardLast4: string
      cardBrand: string
      bankEntity: string
      statementPeriod: Date
      transactionId: string
      chargeSource: string
    }>,
    updatedBy: string
  ) {
    const before = await prisma.contract_payments.findUnique({
      where: { id },
      select: { amount: true, dueDate: true, status: true, paidDate: true },
    })
    if (!before) throw new Error('Pago no encontrado')

    const paidAmount = await this.sumInstallments(id)
    const targetAmount = data.amount !== undefined ? data.amount : before.amount

    // Guard: no se puede bajar el monto por debajo de lo ya abonado.
    if (data.amount !== undefined && data.amount < paidAmount - EPS) {
      throw new Error(
        `El monto no puede ser menor a lo ya abonado ($${paidAmount.toLocaleString()}).`
      )
    }
    // Guard: no se puede limpiar la fecha de pago si ya hay abonos registrados.
    if (data.paidDate === null && paidAmount > EPS) {
      throw new Error(
        'Esta cuota tiene abonos registrados; edita o elimina los abonos en vez de la fecha de pago.'
      )
    }
    // Guard: no se puede marcar "Pagado" a mano si los abonos no cubren el monto.
    if (data.status === 'PAID' && paidAmount < targetAmount - EPS) {
      throw new Error(
        "No se puede marcar como pagado manualmente: usa 'Registrar pago' o completa el abono."
      )
    }
    // Guard: no se puede cancelar una cuota que ya tiene abonos registrados.
    if (data.status === 'CANCELLED' && paidAmount > EPS) {
      throw new Error('No se puede cancelar: esta cuota ya tiene abonos registrados.')
    }

    return prisma.$transaction(async tx => {
      // Sugar: setear paidDate directo con cero abonos existentes → crea un
      // abono por el monto completo, igual que la ruta normal de pago.
      let effectivePaidAmount = paidAmount
      if (data.paidDate !== undefined && data.paidDate !== null && paidAmount <= EPS) {
        await tx.contract_payment_installments.create({
          data: {
            id: randomUUID(),
            paymentId: id,
            amount: targetAmount,
            paidDate: data.paidDate,
            paymentMethod: data.paymentMethod || null,
            referenceNumber: data.referenceNumber || null,
            notes: 'Pago registrado al editar la cuota',
            createdBy: updatedBy,
          },
        })
        effectivePaidAmount = targetAmount
      }

      // Recalcular status si cambia la fecha de vencimiento, pago o monto
      let newStatus = data.status
      if (data.dueDate !== undefined || data.paidDate !== undefined || data.amount !== undefined) {
        const dueDate = data.dueDate || before.dueDate
        newStatus = computePaymentStatus(dueDate, targetAmount, effectivePaidAmount)
      }

      const payment = await tx.contract_payments.update({
        where: { id },
        data: {
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
          ...(data.paidDate !== undefined && { paidDate: data.paidDate }),
          ...(newStatus !== undefined && { status: newStatus }),
          ...(data.paymentMethod !== undefined && { paymentMethod: data.paymentMethod || null }),
          ...(data.referenceNumber !== undefined && {
            referenceNumber: data.referenceNumber || null,
          }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.cardLast4 !== undefined && { cardLast4: data.cardLast4 || null }),
          ...(data.cardBrand !== undefined && { cardBrand: data.cardBrand || null }),
          ...(data.bankEntity !== undefined && { bankEntity: data.bankEntity || null }),
          ...(data.statementPeriod !== undefined && {
            statementPeriod: data.statementPeriod || null,
          }),
          ...(data.transactionId !== undefined && { transactionId: data.transactionId || null }),
          ...(data.chargeSource !== undefined && { chargeSource: data.chargeSource || null }),
        },
        include: {
          contract: {
            select: { name: true },
          },
          installments: { orderBy: { createdAt: 'desc' } },
        },
      })

      await createAuditLog({
        entityType: 'contract_payment',
        entityId: id,
        action: 'payment_updated',
        userId: updatedBy,
        changes: {
          before: { amount: before.amount, status: before.status },
          after: { amount: payment.amount, status: payment.status },
        },
      })

      return { ...payment, paidAmount: payment.installments.reduce((s, i) => s + i.amount, 0) }
    })
  }

  // ── Abonos (pagos parciales) ──────────────────────────────────────────────

  static async sumInstallments(paymentId: string): Promise<number> {
    const result = await prisma.contract_payment_installments.aggregate({
      where: { paymentId },
      _sum: { amount: true },
    })
    return result._sum.amount ?? 0
  }

  static async listInstallments(paymentId: string) {
    return prisma.contract_payment_installments.findMany({
      where: { paymentId },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async getInstallmentById(installmentId: string) {
    return prisma.contract_payment_installments.findUnique({ where: { id: installmentId } })
  }

  /**
   * Registra un pago — completo o parcial — contra una cuota. `amount`
   * omitido paga el saldo restante completo (comportamiento de "Pagar" de
   * siempre — ver markAsPaid). Sincroniza el "último cargo" del contrato
   * (kit de cancelación) con cada abono, no solo cuando queda saldada.
   */
  static async registerPayment(
    id: string,
    data: {
      amount?: number
      paidDate: Date
      paymentMethod?: string
      referenceNumber?: string
      notes?: string
      cardLast4?: string
      cardBrand?: string
      bankEntity?: string
      statementPeriod?: Date
      transactionId?: string
      chargeSource?: string
    },
    createdBy: string
  ) {
    const { payment, amountPaid } = await prisma.$transaction(async tx => {
      const parent = await tx.contract_payments.findUnique({
        where: { id },
        include: { installments: { select: { amount: true } } },
      })
      if (!parent) throw new Error('Pago no encontrado')
      if (parent.status === 'PAID' || parent.status === 'CANCELLED') {
        throw new Error(
          parent.status === 'PAID'
            ? 'Esta cuota ya está marcada como pagada.'
            : 'Esta cuota está cancelada, no se puede marcar como pagada.'
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

      await tx.contract_payment_installments.create({
        data: {
          id: randomUUID(),
          paymentId: id,
          amount,
          paidDate: data.paidDate,
          paymentMethod: data.paymentMethod || null,
          referenceNumber: data.referenceNumber || null,
          notes: data.notes || null,
          createdBy,
        },
      })

      const newPaidAmount = alreadyPaid + amount
      const newStatus = computePaymentStatus(parent.dueDate, parent.amount, newPaidAmount)

      const updated = await tx.contract_payments.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === 'PAID' && { paidDate: data.paidDate }),
          ...(data.paymentMethod !== undefined && { paymentMethod: data.paymentMethod || null }),
          ...(data.referenceNumber !== undefined && {
            referenceNumber: data.referenceNumber || null,
          }),
          ...(data.notes !== undefined && { notes: data.notes || null }),
          ...(data.cardLast4 !== undefined && { cardLast4: data.cardLast4 || null }),
          ...(data.cardBrand !== undefined && { cardBrand: data.cardBrand || null }),
          ...(data.bankEntity !== undefined && { bankEntity: data.bankEntity || null }),
          ...(data.statementPeriod !== undefined && {
            statementPeriod: data.statementPeriod || null,
          }),
          ...(data.transactionId !== undefined && { transactionId: data.transactionId || null }),
          ...(data.chargeSource !== undefined && { chargeSource: data.chargeSource || null }),
        },
        include: {
          contract: { select: { name: true } },
          installments: { orderBy: { createdAt: 'desc' } },
        },
      })

      await createAuditLog({
        entityType: 'contract_payment',
        entityId: id,
        action: 'payment_registered',
        userId: createdBy,
        changes: { amount, newStatus, remaining: remaining - amount },
      })

      return { payment: updated, amountPaid: amount }
    })

    // Sincronizar último cargo en el contrato para kit de cancelación — cada
    // abono (parcial o completo) es, por definición, el cargo más reciente.
    const paymentMethodTypes = [
      'CORPORATE_CARD',
      'PAYPAL',
      'CRYPTO',
      'BANK_TRANSFER',
      'CHECK',
      'PROVIDER_INVOICE',
      'OTHER',
    ] as const
    const chargeAsMethod =
      data.chargeSource && (paymentMethodTypes as readonly string[]).includes(data.chargeSource)
        ? data.chargeSource
        : undefined

    await prisma.contracts.update({
      where: { id: payment.contractId },
      data: {
        lastChargeDate: data.paidDate,
        lastChargeAmount: amountPaid,
        lastTransactionRef: data.transactionId || data.referenceNumber || null,
        ...(data.cardLast4 && { paymentCardLast4: data.cardLast4 }),
        ...(data.cardBrand && { paymentCardBrand: data.cardBrand }),
        ...(data.bankEntity && { paymentCardBank: data.bankEntity }),
        ...(chargeAsMethod && {
          paymentMethodType: chargeAsMethod as (typeof paymentMethodTypes)[number],
        }),
      },
    })

    return { ...payment, paidAmount: payment.installments.reduce((s, i) => s + i.amount, 0) }
  }

  /** Deshacer un abono: lo elimina y re-deriva el status de la cuota. */
  static async deleteInstallment(installmentId: string, deletedBy: string) {
    return prisma.$transaction(async tx => {
      const installment = await tx.contract_payment_installments.findUnique({
        where: { id: installmentId },
      })
      if (!installment) throw new Error('Abono no encontrado')

      await tx.contract_payment_installments.delete({ where: { id: installmentId } })

      const remainingAgg = await tx.contract_payment_installments.aggregate({
        where: { paymentId: installment.paymentId },
        _sum: { amount: true },
      })
      const paidAmount = remainingAgg._sum.amount ?? 0

      const parent = await tx.contract_payments.findUniqueOrThrow({
        where: { id: installment.paymentId },
      })
      const newStatus = computePaymentStatus(parent.dueDate, parent.amount, paidAmount)

      await tx.contract_payments.update({
        where: { id: installment.paymentId },
        data: {
          status: newStatus,
          ...(newStatus !== 'PAID' && { paidDate: null }),
        },
      })

      await createAuditLog({
        entityType: 'contract_payment',
        entityId: installment.paymentId,
        action: 'payment_installment_deleted',
        userId: deletedBy,
        changes: { amount: installment.amount, newStatus },
      })

      return { paymentId: installment.paymentId }
    })
  }

  // ── Marcar como pagado ──────────────────────────────────────────────────────
  // Envoltorio de registerPayment sin monto — paga el saldo restante
  // completo, exactamente el comportamiento de siempre para todo llamador
  // existente (la ruta POST .../mark-paid).

  static async markAsPaid(
    id: string,
    data: {
      paidDate: Date
      paymentMethod?: string
      referenceNumber?: string
      notes?: string
      cardLast4?: string
      cardBrand?: string
      bankEntity?: string
      statementPeriod?: Date
      transactionId?: string
      chargeSource?: string
    },
    updatedBy: string
  ) {
    return this.registerPayment(id, { ...data, amount: undefined }, updatedBy)
  }

  // ── Eliminar pago ───────────────────────────────────────────────────────────

  static async delete(id: string, deletedBy: string) {
    const payment = await prisma.contract_payments.findUnique({
      where: { id },
      select: { amount: true, dueDate: true, status: true },
    })
    if (!payment) throw new Error('Pago no encontrado')

    const paidAmount = await this.sumInstallments(id)
    if (paidAmount > EPS) {
      throw new Error(
        'No se puede eliminar: esta cuota ya tiene abonos registrados. Elimina los abonos primero si necesitas corregirla.'
      )
    }

    await prisma.contract_payments.delete({ where: { id } })

    await createAuditLog({
      entityType: 'contract_payment',
      entityId: id,
      action: 'payment_deleted',
      userId: deletedBy,
      changes: { amount: payment.amount, status: payment.status },
    })
  }

  // ── Generar pagos automáticos ───────────────────────────────────────────────

  /**
   * Genera pagos programados para un contrato según su ciclo de facturación
   */
  static async generateScheduledPayments(params: {
    contractId: string
    startDate: Date
    endDate: Date
    billingCycle: string
    amount: number
    currency?: string
    createdBy: string
    /** Si se indica, el monto de cada cuota depende de la fecha (líneas vigentes). */
    amountForDueDate?: (dueDate: Date) => number
  }) {
    const {
      contractId,
      startDate,
      endDate,
      billingCycle,
      amount,
      currency,
      createdBy,
      amountForDueDate,
    } = params

    const existingPayments = await prisma.contract_payments.count({
      where: {
        contractId,
        status: { notIn: ['CANCELLED'] },
      },
    })
    if (existingPayments > 0) {
      throw new PaymentsAlreadyExistError()
    }

    const payments: Date[] = []
    const currentDate = new Date(startDate)

    // Calcular fechas de pago según el ciclo
    while (currentDate <= endDate) {
      payments.push(new Date(currentDate))

      switch (billingCycle) {
        case 'MONTHLY':
          currentDate.setMonth(currentDate.getMonth() + 1)
          break
        case 'QUARTERLY':
          currentDate.setMonth(currentDate.getMonth() + 3)
          break
        case 'SEMIANNUAL':
        case 'BIANNUAL':
          currentDate.setMonth(currentDate.getMonth() + 6)
          break
        case 'ANNUAL':
          currentDate.setFullYear(currentDate.getFullYear() + 1)
          break
        case 'ONE_TIME':
          // Solo un pago
          break
        default:
          throw new Error(`Ciclo de facturación no soportado: ${billingCycle}`)
      }

      if (billingCycle === 'ONE_TIME') break
    }

    const createdPayments = []
    for (const dueDate of payments) {
      const periodAmount = amountForDueDate ? amountForDueDate(dueDate) : amount
      if (periodAmount <= 0) continue
      const payment = await this.create({
        contractId,
        amount: periodAmount,
        currency,
        dueDate,
        createdBy,
      })
      createdPayments.push(payment)
    }

    if (createdPayments.length === 0) {
      throw new Error(
        'No hay cuotas con monto positivo. Revisa vigencia de líneas y costos unitarios.'
      )
    }

    await createAuditLog({
      entityType: 'contract',
      entityId: contractId,
      action: 'payments_generated',
      userId: createdBy,
      changes: {
        paymentsCount: createdPayments.length,
        billingCycle,
        amount,
      },
    })

    return createdPayments
  }

  /**
   * Ajusta cuotas pendientes al monto de equipos/líneas aún en renta en cada fecha.
   * No toca pagos ya cobrados NI cuotas que ya tienen abonos registrados —
   * ese saldo ya comprometido no se debe pisar.
   */
  static async recalculatePendingAmounts(contractId: string, updatedBy: string) {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        billingCycle: true,
        monthlyCost: true,
        totalValue: true,
        lines: {
          select: {
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            serviceStartDate: true,
            serviceEndDate: true,
            description: true,
          },
        },
      },
    })
    if (!contract) throw new Error('Contrato no encontrado')

    const pending = await prisma.contract_payments.findMany({
      where: {
        contractId,
        paidDate: null,
        status: { in: ['SCHEDULED', 'DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
    })

    let updated = 0
    let cancelled = 0
    let skipped = 0
    for (const payment of pending) {
      const paidAmount = await this.sumInstallments(payment.id)
      if (paidAmount > EPS) {
        skipped++
        continue
      }
      const nextAmount = amountDueOnDate(contract.lines, contract, payment.dueDate)
      if (nextAmount <= 0) {
        await prisma.contract_payments.update({
          where: { id: payment.id },
          data: {
            status: 'CANCELLED',
            notes: [payment.notes, 'Cancelado: no hay activos en renta en esta fecha.']
              .filter(Boolean)
              .join(' '),
          },
        })
        cancelled++
        continue
      }
      if (Number(payment.amount) !== nextAmount) {
        await prisma.contract_payments.update({
          where: { id: payment.id },
          data: { amount: nextAmount },
        })
        updated++
      }
    }

    await createAuditLog({
      entityType: 'contract',
      entityId: contractId,
      action: 'payments_recalculated',
      userId: updatedBy,
      changes: { updated, cancelled, skipped, pending: pending.length },
    })

    return { updated, cancelled, skipped, pending: pending.length }
  }

  // ── Job: alertas de pagos próximos ─────────────────────────────────────────

  /**
   * Verifica pagos próximos y vencidos, envía alertas
   */
  static async checkPaymentAlerts() {
    const now = new Date()
    const alerts = {
      sent7Days: 0,
      sentDue: 0,
      sentOverdue: 0,
      paymentsChecked: 0,
    }

    // Obtener pagos pendientes
    const payments = await prisma.contract_payments.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DUE', 'OVERDUE', 'PARTIALLY_PAID'] },
      },
      include: {
        installments: { select: { amount: true } },
        contract: {
          include: {
            supplier: { select: { name: true } },
            family: { select: { id: true, name: true } },
            creator: { select: { id: true, name: true } },
            lines: {
              select: {
                description: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
                serviceStartDate: true,
                serviceEndDate: true,
              },
            },
          },
        },
      },
    })

    alerts.paymentsChecked = payments.length

    for (const payment of payments) {
      const daysUntilDue = Math.ceil(
        (payment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Actualizar status
      const paidAmount = payment.installments.reduce((s, i) => s + i.amount, 0)
      const newStatus = computePaymentStatus(payment.dueDate, payment.amount, paidAmount)
      if (newStatus !== payment.status) {
        await prisma.contract_payments.update({
          where: { id: payment.id },
          data: { status: newStatus },
        })
      }

      // Alerta 7 días antes
      if (daysUntilDue <= 7 && daysUntilDue > 0 && !payment.alert7DaysSent) {
        await this.sendPaymentAlert(payment, 'upcoming', daysUntilDue)
        await prisma.contract_payments.update({
          where: { id: payment.id },
          data: { alert7DaysSent: true, lastAlertSentAt: now },
        })
        alerts.sent7Days++
      }

      // Alerta día de vencimiento
      if (daysUntilDue === 0 && !payment.alertDueSent) {
        await this.sendPaymentAlert(payment, 'due', 0)
        await prisma.contract_payments.update({
          where: { id: payment.id },
          data: { alertDueSent: true, lastAlertSentAt: now },
        })
        alerts.sentDue++
      }

      // Alerta vencido
      if (daysUntilDue < 0 && !payment.alertOverdueSent) {
        await this.sendPaymentAlert(payment, 'overdue', Math.abs(daysUntilDue))
        await prisma.contract_payments.update({
          where: { id: payment.id },
          data: { alertOverdueSent: true, lastAlertSentAt: now },
        })
        alerts.sentOverdue++
      }
    }

    // Auditoría
    await createAuditLog({
      entityType: 'contract_payment',
      entityId: 'system',
      action: 'payment_alerts_checked',
      userId: 'system',
      changes: alerts,
    })

    return alerts
  }

  // ── Enviar alerta de pago ───────────────────────────────────────────────────

  private static async sendPaymentAlert(
    payment: any,
    type: 'upcoming' | 'due' | 'overdue',
    days: number
  ) {
    const contract = payment.contract
    const supplierName = contract.supplier?.name ?? 'Sin proveedor'

    let title = ''
    let message = ''
    let priority: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'

    switch (type) {
      case 'upcoming':
        title = `Pago próximo: ${contract.name}`
        message = `El pago de $${payment.amount.toLocaleString()} ${payment.currency} vence en ${days} día(s).`
        priority = 'MEDIUM'
        break
      case 'due':
        title = `Pago vence hoy: ${contract.name}`
        message = `El pago de $${payment.amount.toLocaleString()} ${payment.currency} vence hoy.`
        priority = 'HIGH'
        break
      case 'overdue':
        title = `Pago vencido: ${contract.name}`
        message = `El pago de $${payment.amount.toLocaleString()} ${payment.currency} está vencido desde hace ${days} día(s).`
        priority = 'HIGH'
        break
    }

    message += `\n\n**Detalles del pago:**\n`
    message += `- Contrato: ${contract.name}\n`
    message += `- Proveedor: ${supplierName}\n`
    message += `- Monto: $${payment.amount.toLocaleString()} ${payment.currency}\n`
    message += `- Fecha de vencimiento: ${payment.dueDate.toLocaleDateString('es-MX')}\n`
    const activeLines = (contract.lines ?? []).filter((line: any) =>
      lineIsBillableOn(line, contract, payment.dueDate)
    )
    const lineNames = activeLines
      .map((l: any) => l.description)
      .filter(Boolean)
      .slice(0, 8)
    if (lineNames.length) {
      message += `\nActivos en renta en esta cuota:\n`
      for (const name of lineNames) message += `- ${name}\n`
      if (activeLines.length > 8) message += `- … y ${activeLines.length - 8} más\n`
    } else {
      message += `\nMonto según el contrato (sin líneas con precio en esta fecha).\n`
    }

    await notifyContractOps({
      familyId: contract.familyId,
      extraUserIds: [contract.custodianUserId, contract.backupCustodianUserId, contract.createdBy],
      title,
      message,
      link: '/inventory/payments',
      metadata: {
        kind: type === 'overdue' ? 'CONTRACT_PAYMENT_OVERDUE' : 'CONTRACT_PAYMENT_DUE',
        paymentId: payment.id,
        contractId: contract.id,
        contractName: contract.name,
        amount: payment.amount,
        currency: payment.currency,
        dueDate: payment.dueDate.toISOString(),
        daysUntilDue: type === 'overdue' ? -days : days,
        priority,
      },
    })
  }

  // ── Estadísticas de pagos ───────────────────────────────────────────────────

  static async getStats(contractId?: string) {
    const where: any = {}
    if (contractId) where.contractId = contractId

    const [total, scheduled, due, overdue, paid, partiallyPaid, allPayments] = await Promise.all([
      prisma.contract_payments.count({ where }),
      prisma.contract_payments.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'DUE' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'OVERDUE' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'PAID' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'PARTIALLY_PAID' } }),
      prisma.contract_payments.findMany({
        where,
        select: { amount: true, status: true, installments: { select: { amount: true } } },
      }),
    ])

    const totalAmount = allPayments.reduce((s, p) => s + p.amount, 0)
    // paidAmount real = suma de abonos (no solo de cuotas 100% PAID — una
    // PARTIALLY_PAID ya tiene plata pagada real que antes no se contaba acá).
    const paidAmount = allPayments
      .filter(p => p.status !== 'CANCELLED')
      .reduce((s, p) => s + p.installments.reduce((si, i) => si + i.amount, 0), 0)

    return {
      total,
      scheduled,
      due,
      overdue,
      paid,
      partiallyPaid,
      cancelled: total - scheduled - due - overdue - paid - partiallyPaid,
      totalAmount,
      paidAmount,
      pendingAmount: totalAmount - paidAmount,
    }
  }

  // ── Próximos pagos ──────────────────────────────────────────────────────────

  static async getUpcomingPayments(days: number = 30, familyId?: string) {
    const now = new Date()
    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const where: any = {
      status: { in: ['SCHEDULED', 'DUE'] },
      dueDate: {
        gte: now,
        lte: targetDate,
      },
    }

    if (familyId) {
      where.contract = { familyId }
    }

    const payments = await prisma.contract_payments.findMany({
      where,
      include: {
        contract: {
          select: {
            id: true,
            name: true,
            contractNumber: true,
            supplier: { select: { name: true } },
            family: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    })

    return payments.map(payment => ({
      ...payment,
      daysUntilDue: Math.ceil((payment.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }))
  }
}
