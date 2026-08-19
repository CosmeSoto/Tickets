import { prisma } from '@/lib/prisma'

/**
 * Sincroniza fechas y costos de licencias vinculadas en líneas del contrato.
 */
export async function syncContractLicenseLines(contractId: string): Promise<number> {
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
    await prisma.software_licenses.update({
      where: { id: line.licenseId },
      data: {
        ...(renewalCost != null && { renewalCost }),
        ...(end && {
          renewalDate: end,
          expirationDate: end,
        }),
      },
    })
    synced++
  }
  return synced
}
