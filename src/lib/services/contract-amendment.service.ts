import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { FolioService } from './folio.service'
import { createAuditLog } from '@/lib/audit'
import { syncContractLicenseLines } from '@/lib/contracts/license-sync'
import { syncContractEquipmentLines } from '@/lib/contracts/equipment-sync'
import type { CreateContractAmendmentInput } from '@/lib/validations/contract-amendment'
import { NotificationService } from './notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'

export class ContractAmendmentService {
  static async listByContract(contractId: string) {
    return prisma.contract_amendments.findMany({
      where: { contractId },
      orderBy: [{ effectiveDate: 'desc' }, { amendmentNumber: 'desc' }],
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    })
  }

  static async create(
    contractId: string,
    input: CreateContractAmendmentInput,
    userId: string
  ) {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        monthlyCost: true,
        totalValue: true,
        endDate: true,
        billingCycle: true,
        status: true,
      },
    })

    if (!contract) throw new Error('Contrato no encontrado')

    const lastNumber = await prisma.contract_amendments.aggregate({
      where: { contractId },
      _max: { amendmentNumber: true },
    })
    const amendmentNumber = (lastNumber._max.amendmentNumber ?? 0) + 1
    const folio = await FolioService.generateAmendmentFolio()

    const hasMonthlyChange =
      input.newMonthlyCost != null && input.newMonthlyCost !== contract.monthlyCost
    const hasTotalChange =
      input.newTotalValue != null && input.newTotalValue !== contract.totalValue
    const hasEndChange =
      input.newEndDate != null &&
      contract.endDate?.toISOString().slice(0, 10) !==
        input.newEndDate.toISOString().slice(0, 10)
    const hasBillingChange =
      input.newBillingCycle != null && input.newBillingCycle !== contract.billingCycle

    const amendment = await prisma.$transaction(async tx => {
      const row = await tx.contract_amendments.create({
        data: {
          id: randomUUID(),
          contractId,
          folio,
          amendmentNumber,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          effectiveDate: input.effectiveDate,
          applyToContract: input.applyToContract,
          previousMonthlyCost: hasMonthlyChange ? contract.monthlyCost : null,
          newMonthlyCost: hasMonthlyChange ? input.newMonthlyCost : null,
          previousTotalValue: hasTotalChange ? contract.totalValue : null,
          newTotalValue: hasTotalChange ? input.newTotalValue : null,
          previousEndDate: hasEndChange ? contract.endDate : null,
          newEndDate: hasEndChange ? input.newEndDate : null,
          previousBillingCycle: hasBillingChange ? contract.billingCycle : null,
          newBillingCycle: hasBillingChange ? input.newBillingCycle : null,
          createdBy: userId,
        },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      })

      if (input.applyToContract) {
        const updateData: Record<string, unknown> = {}
        if (hasMonthlyChange) updateData.monthlyCost = input.newMonthlyCost
        if (hasTotalChange) updateData.totalValue = input.newTotalValue
        if (hasEndChange) updateData.endDate = input.newEndDate
        if (hasBillingChange) updateData.billingCycle = input.newBillingCycle
        if (input.type === 'CANCELLATION') updateData.status = 'TERMINATED'

        if (Object.keys(updateData).length > 0) {
          await tx.contracts.update({
            where: { id: contractId },
            data: updateData,
          })
        }
      }

      return row
    })

    if (input.applyToContract) {
      await syncContractLicenseLines(contractId).catch(err =>
        console.error('[amendment] sync licenses:', err)
      )
      await syncContractEquipmentLines(contractId).catch(err =>
        console.error('[amendment] sync equipment:', err)
      )
    }

    await createAuditLog({
      entityType: 'contract',
      entityId: contractId,
      action: 'contract_amendment_created',
      userId,
      changes: {
        folio: amendment.folio,
        amendmentNumber,
        type: input.type,
        applyToContract: input.applyToContract,
      },
    })

    const contractMeta = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { name: true, familyId: true },
    })
    if (contractMeta) {
      const changeParts: string[] = []
      if (hasMonthlyChange) changeParts.push(`costo mensual → ${input.newMonthlyCost}`)
      if (hasTotalChange) changeParts.push(`valor total → ${input.newTotalValue}`)
      if (hasEndChange) changeParts.push(`vencimiento actualizado`)
      if (hasBillingChange) changeParts.push(`ciclo de facturación actualizado`)
      const summary =
        changeParts.length > 0 ? changeParts.join('; ') : input.description ?? 'Ver detalle'

      const admins = await getFamilyScopedAdmins(contractMeta.familyId, { id: true })
      await Promise.all(
        admins
          .filter(a => a.id !== userId)
          .map(admin =>
            NotificationService.push({
              userId: admin.id,
              type: 'INFO',
              title: `Adendum ${amendment.folio} — ${contractMeta.name}`,
              message: `${input.title}. ${summary}`,
              metadata: {
                type: 'contract_amendment_created',
                contractId,
                amendmentId: amendment.id,
                folio: amendment.folio,
                link: `/inventory/contracts`,
              },
            })
          )
      )
    }

    return amendment
  }
}
