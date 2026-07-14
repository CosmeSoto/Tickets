import type { CreateContractInput, UpdateContractInput } from '@/lib/validations/contracts'

export function extractBillingPayload(
  p: Partial<CreateContractInput | UpdateContractInput>
) {
  return {
    custodianUserId: p.custodianUserId ?? undefined,
    backupCustodianUserId: p.backupCustodianUserId ?? undefined,
    billingAccountEmail: p.billingAccountEmail || undefined,
    billingPortalUrl: p.billingPortalUrl || undefined,
    vendorAccountId: p.vendorAccountId ?? undefined,
    paymentMethodType: p.paymentMethodType ?? undefined,
    paymentAccountRef: p.paymentAccountRef ?? undefined,
    serviceSubtype: p.serviceSubtype ?? undefined,
    paymentCardBrand: p.paymentCardBrand ?? undefined,
    paymentCardLast4: p.paymentCardLast4 || undefined,
    paymentCardBank: p.paymentCardBank ?? undefined,
    paymentCardExpiry: p.paymentCardExpiry || undefined,
    corporateCardLabel: p.corporateCardLabel ?? undefined,
    lastChargeDate: p.lastChargeDate ?? undefined,
    lastChargeAmount: p.lastChargeAmount ?? undefined,
    lastTransactionRef: p.lastTransactionRef ?? undefined,
    subscriptionUsageStatus: p.subscriptionUsageStatus ?? undefined,
    cancellationNoticeDays: p.cancellationNoticeDays ?? undefined,
  }
}
