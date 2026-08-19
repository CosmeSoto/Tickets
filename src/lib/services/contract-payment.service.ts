/**
 * ContractPaymentService — Lógica de negocio para pagos de contratos.
 *
 * Responsabilidades:
 *  - CRUD de pagos programados
 *  - Cálculo automático de próximos pagos
 *  - Alertas de pagos próximos y vencidos
 *  - Registro de auditoría en cada operación
 */

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'
import { notifyContractOps } from '@/lib/contracts/notify-contract-ops'
import { amountDueOnDate, lineIsBillableOn } from '@/lib/contracts/line-billing'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PaymentStatus = 'SCHEDULED' | 'DUE' | 'OVERDUE' | 'PAID' | 'CANCELLED'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function computePaymentStatus(dueDate: Date, paidDate: Date | null): PaymentStatus {
  if (paidDate) return 'PAID'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())

  if (due < today) return 'OVERDUE'
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

    const [payments, total] = await Promise.all([
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
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contract_payments.count({ where }),
    ])

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
    return await prisma.contract_payments.findUnique({
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
      },
    })
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
    const status = computePaymentStatus(data.dueDate, null)

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

    // Recalcular status si cambia la fecha de vencimiento o pago
    let newStatus = data.status
    if (data.dueDate !== undefined || data.paidDate !== undefined) {
      const dueDate = data.dueDate || before.dueDate
      const paidDate = data.paidDate !== undefined ? data.paidDate : before.paidDate
      newStatus = computePaymentStatus(dueDate, paidDate)
    }

    const payment = await prisma.contract_payments.update({
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

    return payment
  }

  // ── Marcar como pagado ──────────────────────────────────────────────────────

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
    const payment = await this.update(
      id,
      {
        paidDate: data.paidDate,
        status: 'PAID',
        paymentMethod: data.paymentMethod,
        referenceNumber: data.referenceNumber,
        notes: data.notes,
        cardLast4: data.cardLast4,
        cardBrand: data.cardBrand,
        bankEntity: data.bankEntity,
        statementPeriod: data.statementPeriod,
        transactionId: data.transactionId,
        chargeSource: data.chargeSource,
      },
      updatedBy
    )

    // Sincronizar último cargo en el contrato para kit de cancelación
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
        lastChargeAmount: payment.amount,
        lastTransactionRef: data.transactionId || data.referenceNumber || null,
        ...(data.cardLast4 && { paymentCardLast4: data.cardLast4 }),
        ...(data.cardBrand && { paymentCardBrand: data.cardBrand }),
        ...(data.bankEntity && { paymentCardBank: data.bankEntity }),
        ...(chargeAsMethod && {
          paymentMethodType: chargeAsMethod as (typeof paymentMethodTypes)[number],
        }),
      },
    })

    return payment
  }

  // ── Eliminar pago ───────────────────────────────────────────────────────────

  static async delete(id: string, deletedBy: string) {
    const payment = await prisma.contract_payments.findUnique({
      where: { id },
      select: { amount: true, dueDate: true, status: true },
    })
    if (!payment) throw new Error('Pago no encontrado')

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
   * No toca pagos ya cobrados.
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
        status: { in: ['SCHEDULED', 'DUE', 'OVERDUE'] },
      },
    })

    let updated = 0
    let cancelled = 0
    for (const payment of pending) {
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
      changes: { updated, cancelled, pending: pending.length },
    })

    return { updated, cancelled, pending: pending.length }
  }

  // ── Job: alertas de pagos próximos ─────────────────────────────────────────

  /**
   * Verifica pagos próximos y vencidos, envía alertas
   */
  static async checkPaymentAlerts() {
    const now = new Date()
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const alerts = {
      sent7Days: 0,
      sentDue: 0,
      sentOverdue: 0,
      paymentsChecked: 0,
    }

    // Obtener pagos pendientes
    const payments = await prisma.contract_payments.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DUE', 'OVERDUE'] },
      },
      include: {
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
      const newStatus = computePaymentStatus(payment.dueDate, payment.paidDate)
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

    const [total, scheduled, due, overdue, paid, totalAmount, paidAmount] = await Promise.all([
      prisma.contract_payments.count({ where }),
      prisma.contract_payments.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'DUE' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'OVERDUE' } }),
      prisma.contract_payments.count({ where: { ...where, status: 'PAID' } }),
      prisma.contract_payments.aggregate({
        where,
        _sum: { amount: true },
      }),
      prisma.contract_payments.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { amount: true },
      }),
    ])

    return {
      total,
      scheduled,
      due,
      overdue,
      paid,
      cancelled: total - scheduled - due - overdue - paid,
      totalAmount: totalAmount._sum.amount || 0,
      paidAmount: paidAmount._sum.amount || 0,
      pendingAmount: (totalAmount._sum.amount || 0) - (paidAmount._sum.amount || 0),
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
