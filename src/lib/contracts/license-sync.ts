import { prisma } from '@/lib/prisma'
import { applyLicenseRenewalUpdate } from '@/lib/inventory/license-renewal'

/**
 * Sincroniza fechas y costos de licencias vinculadas en líneas del contrato.
 * Pasa por applyLicenseRenewalUpdate (en vez de un update crudo) para que,
 * igual que cualquier otro cambio de renovación, se resetee la bandera de
 * "ya avisé" y quede un rastro en license_renewal_history — antes este
 * camino los pisaba en silencio.
 */
export async function syncContractLicenseLines(
  contractId: string,
  changedById: string
): Promise<number> {
  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: {
      endDate: true,
      monthlyCost: true,
      lines: {
        where: { licenseId: { not: null } },
        select: {
          licenseId: true,
          unitPrice: true,
          totalPrice: true,
          serviceEndDate: true,
        },
      },
    },
  })

  if (!contract?.lines.length) return 0

  let synced = 0
  for (const line of contract.lines) {
    if (!line.licenseId) continue
    const renewalCost = line.unitPrice ?? line.totalPrice ?? contract.monthlyCost ?? undefined
    const end = line.serviceEndDate ?? contract.endDate
    await applyLicenseRenewalUpdate(
      line.licenseId,
      {
        ...(renewalCost != null ? { renewalCost } : {}),
        ...(end ? { renewalDate: end, expirationDate: end } : {}),
      },
      changedById,
      'contract-sync'
    )
    synced++
  }
  return synced
}
