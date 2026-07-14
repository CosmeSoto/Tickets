import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FolioService } from './folio.service'
import { DigitalSignatureService } from './digital-signature.service'
import { buildContractSnapshot } from '@/lib/contract-snapshot'
import type { ReturnContractAssignmentInput } from '@/lib/validations/contract-assignment'
import {
  addActExpirationDays,
  getInventoryActExpirationDays,
} from '@/lib/settings/runtime-settings'

export class ContractReturnActService {
  static async generateReturnAct(
    assignmentId: string,
    data: ReturnContractAssignmentInput = {}
  ) {
    const assignment = await prisma.contract_assignments.findUnique({
      where: { id: assignmentId },
      include: {
        client: { include: { departments: { select: { name: true } } } },
        deliverer: { include: { departments: { select: { name: true } } } },
        deliveryAct: true,
        returnAct: true,
      },
    })

    if (!assignment) throw new Error('Asignación no encontrada')
    if (assignment.returnAct) throw new Error('Esta asignación ya tiene un acta de retiro')
    if (!assignment.deliveryAct || assignment.deliveryAct.status !== 'ACCEPTED') {
      throw new Error('Se requiere un acta de entrega aceptada antes del retiro')
    }

    const folio = await FolioService.generateSubscriptionReturnFolio()
    const acceptanceToken = DigitalSignatureService.generateAcceptanceToken()
    const actExpirationDays = await getInventoryActExpirationDays()
    const expirationDate = addActExpirationDays(new Date(), actExpirationDays)
    const returnDate = data.returnDate ? new Date(data.returnDate) : new Date()

    const contractSnapshot = await buildContractSnapshot(assignment.contractId, {
      assignmentId: assignment.id,
      withdrawalReason: data.withdrawalReason,
      actPurpose: 'SUBSCRIPTION_RETURN',
    })

    const receiverInfo = {
      id: assignment.client.id,
      name: assignment.client.name,
      email: assignment.client.email,
      role: assignment.client.role,
      department: assignment.client.departments?.name,
    }

    const delivererInfo = {
      id: assignment.deliverer.id,
      name: assignment.deliverer.name,
      email: assignment.deliverer.email,
      role: assignment.deliverer.role,
      department: assignment.deliverer.departments?.name,
    }

    const act = await prisma.contract_return_acts.create({
      data: {
        id: randomUUID(),
        folio,
        contractAssignmentId: assignmentId,
        deliveryActId: assignment.deliveryAct.id,
        contractSnapshot: contractSnapshot as unknown as Prisma.InputJsonValue,
        withdrawalReason: data.withdrawalReason || null,
        handoverNotes: data.handoverNotes || null,
        returnDate,
        receiverInfo: receiverInfo as unknown as Prisma.InputJsonValue,
        delivererInfo: delivererInfo as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
        acceptanceToken,
        expirationDate,
      },
    })

    return act
  }

  static async acceptAct(
    actId: string,
    token: string,
    signatureMeta?: { ip?: string; userAgent?: string }
  ) {
    const act = await prisma.contract_return_acts.findUnique({
      where: { id: actId },
      include: { contractAssignment: true },
    })
    if (!act) throw new Error('Acta no encontrada')
    if (act.acceptanceToken !== token) throw new Error('Token inválido')
    if (act.status !== 'PENDING') throw new Error('El acta ya fue procesada')
    if (act.expirationDate < new Date()) throw new Error('El acta ha expirado')

    const now = new Date()

    await prisma.$transaction(async tx => {
      await tx.contract_return_acts.update({
        where: { id: actId },
        data: {
          status: 'ACCEPTED',
          acceptedAt: now,
          signatureTimestamp: now,
          signatureIp: signatureMeta?.ip ?? null,
          signatureUserAgent: signatureMeta?.userAgent ?? null,
        },
      })

      if (act.contractAssignment.isActive) {
        await tx.contract_assignments.update({
          where: { id: act.contractAssignmentId },
          data: { isActive: false, actualEndDate: act.returnDate },
        })
      }
    })

    return act
  }
}
