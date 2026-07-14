import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import { buildActReceiverInfo } from '@/lib/inventory/general-delivery-act'
import { buildContractSnapshot } from '@/lib/contract-snapshot'
import {
  addActExpirationDays,
  getInventoryActExpirationDays,
} from '@/lib/settings/runtime-settings'

export class ContractDeliveryActService {
  static async generateDeliveryAct(contractAssignmentId: string) {
    const assignment = await prisma.contract_assignments.findUnique({
      where: { id: contractAssignmentId },
      include: {
        contract: true,
        client: { include: { departments: { select: { name: true } } } },
        deliverer: { include: { departments: { select: { name: true } } } },
      },
    })

    if (!assignment) throw new Error('Asignación de contrato no encontrada')
    if (!assignment.isActive) throw new Error('La asignación no está activa')

    const existing = await prisma.delivery_acts.findUnique({
      where: { contractAssignmentId },
    })
    if (existing) throw new Error('Esta asignación ya tiene un acta de entrega')

    const folio = await FolioService.generateSubscriptionDeliveryFolio()
    const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()
    const actExpirationDays = await getInventoryActExpirationDays()
    const expirationDate = addActExpirationDays(new Date(), actExpirationDays)

    const receiverInfo = await buildActReceiverInfo(assignment.clientId)
    const delivererInfo = {
      id: assignment.deliverer.id,
      name: assignment.deliverer.name,
      email: assignment.deliverer.email,
      role: assignment.deliverer.role,
      department: assignment.deliverer.departments?.name,
    }

    const equipmentSnapshot = await buildContractSnapshot(assignment.contractId, {
      assignmentId: assignment.id,
      assignmentStartDate: assignment.startDate,
      changeReason: assignment.changeReason,
      actPurpose: 'SUBSCRIPTION_DELIVERY',
    })

    const act = await prisma.delivery_acts.create({
      data: {
        id: randomUUID(),
        folio,
        contractAssignmentId,
        equipmentSnapshot: equipmentSnapshot as unknown as Prisma.InputJsonValue,
        delivererInfo: delivererInfo as unknown as Prisma.InputJsonValue,
        receiverInfo: receiverInfo as unknown as Prisma.InputJsonValue,
        accessories: [],
        observations: assignment.notes,
        actType: 'SUBSCRIPTION_ASSIGNMENT',
        referenceId: assignment.contractId,
        referenceType: 'contract',
        status: 'PENDING',
        acceptanceToken,
        expirationDate,
      },
    })

    return act
  }
}
