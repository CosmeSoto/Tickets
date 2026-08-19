import { prisma } from '@/lib/prisma'

/**
 * Sincroniza fechas y costos de equipos vinculados en líneas del contrato.
 */
export async function syncContractEquipmentLines(contractId: string): Promise<number> {
  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: {
      contractNumber: true,
      startDate: true,
      endDate: true,
      monthlyCost: true,
      lines: {
        where: { equipmentId: { not: null } },
        select: {
          equipmentId: true,
          unitPrice: true,
          totalPrice: true,
          serviceStartDate: true,
          serviceEndDate: true,
        },
      },
    },
  })

  if (!contract?.lines.length) return 0

  let synced = 0
  for (const line of contract.lines) {
    if (!line.equipmentId) continue
    const monthlyCost = line.unitPrice ?? line.totalPrice ?? contract.monthlyCost ?? undefined
    const start = line.serviceStartDate ?? contract.startDate
    const end = line.serviceEndDate ?? contract.endDate
    await prisma.equipment.update({
      where: { id: line.equipmentId },
      data: {
        ...(monthlyCost != null && {
          rentalMonthlyCost: monthlyCost,
          contractRenewalCost: monthlyCost,
        }),
        ...(start && {
          rentalStartDate: start,
          contractStartDate: start,
        }),
        ...(end && {
          rentalEndDate: end,
          contractEndDate: end,
        }),
        ...(contract.contractNumber && { rentalContractNumber: contract.contractNumber }),
      },
    })
    synced++
  }
  return synced
}
