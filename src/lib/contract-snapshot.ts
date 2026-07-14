/**
 * Snapshot inmutable de datos contractuales y financieros para actas de suscripción.
 */
import { prisma } from '@/lib/prisma'

export async function buildContractSnapshot(
  contractId: string,
  extra?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    include: {
      supplier: { select: { id: true, name: true, email: true, phone: true, taxId: true } },
      family: { select: { id: true, name: true, code: true } },
      custodian: { select: { id: true, name: true, email: true, role: true } },
      backupCustodian: { select: { id: true, name: true, email: true, role: true } },
      lines: { orderBy: { order: 'asc' } },
    },
  })

  if (!contract) {
    throw new Error('Contrato no encontrado')
  }

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    name: contract.name,
    description: contract.description,
    category: contract.category,
    status: contract.status,
    supplier: contract.supplier,
    family: contract.family,
    startDate: contract.startDate,
    endDate: contract.endDate,
    autoRenew: contract.autoRenew,
    renewalNoticeDays: contract.renewalNoticeDays,
    billingCycle: contract.billingCycle,
    totalValue: contract.totalValue,
    monthlyCost: contract.monthlyCost,
    currency: contract.currency,
    contactName: contract.contactName,
    contactEmail: contract.contactEmail,
    contactPhone: contract.contactPhone,
    termsUrl: contract.termsUrl,
    custodian: contract.custodian,
    backupCustodian: contract.backupCustodian,
    billingAccountEmail: contract.billingAccountEmail,
    billingPortalUrl: contract.billingPortalUrl,
    vendorAccountId: contract.vendorAccountId,
    paymentAccountRef: contract.paymentAccountRef,
    paymentMethodType: contract.paymentMethodType,
    serviceSubtype: contract.serviceSubtype,
    paymentCardBrand: contract.paymentCardBrand,
    paymentCardLast4: contract.paymentCardLast4,
    paymentCardBank: contract.paymentCardBank,
    paymentCardExpiry: contract.paymentCardExpiry,
    corporateCardLabel: contract.corporateCardLabel,
    lastChargeDate: contract.lastChargeDate,
    lastChargeAmount: contract.lastChargeAmount,
    lastTransactionRef: contract.lastTransactionRef,
    subscriptionUsageStatus: contract.subscriptionUsageStatus,
    cancellationNoticeDays: contract.cancellationNoticeDays,
    lines: contract.lines.map(l => ({
      type: l.type,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      totalPrice: l.totalPrice,
      notes: l.notes,
    })),
    snapshotAt: new Date().toISOString(),
    ...extra,
  }
}
