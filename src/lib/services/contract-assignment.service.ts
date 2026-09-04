import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { AssignContractInput } from '@/lib/validations/contract-assignment'

const ASSIGNMENT_INCLUDE = {
  contract: {
    select: {
      id: true,
      name: true,
      contractNumber: true,
      category: true,
      familyId: true,
      status: true,
    },
  },
  client: { select: { id: true, name: true, email: true, role: true } },
  deliverer: { select: { id: true, name: true, email: true, role: true } },
  family: { select: { id: true, name: true, color: true, code: true } },
  deliveryAct: { select: { id: true, folio: true, status: true, acceptanceToken: true } },
  returnAct: { select: { id: true, folio: true, status: true, acceptanceToken: true } },
} as const

export class ContractAssignmentService {
  static async listByContract(contractId: string) {
    return prisma.contract_assignments.findMany({
      where: { contractId },
      orderBy: { startDate: 'desc' },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  static async getActive(contractId: string) {
    return prisma.contract_assignments.findFirst({
      where: { contractId, isActive: true },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  static async getById(id: string) {
    return prisma.contract_assignments.findUnique({
      where: { id },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  /**
   * Revierte asignación recién creada si falla el acta de entrega.
   */
  static async rollbackAssignment(assignmentId: string): Promise<void> {
    await prisma.$transaction(async tx => {
      await tx.delivery_acts.deleteMany({ where: { contractAssignmentId: assignmentId } })
      await tx.contract_assignments.delete({ where: { id: assignmentId } })
    })
  }

  /**
   * Revierte un cambio de cliente si falla la generación de actas posteriores.
   */
  static async rollbackFailedAssign(params: {
    newAssignmentId: string
    previousAssignmentId?: string | null
    returnActId?: string | null
  }): Promise<void> {
    const { newAssignmentId, previousAssignmentId, returnActId } = params
    await prisma.$transaction(async tx => {
      if (returnActId) {
        await tx.contract_return_acts.deleteMany({ where: { id: returnActId } })
      }
      await tx.delivery_acts.deleteMany({ where: { contractAssignmentId: newAssignmentId } })
      await tx.contract_assignments.delete({ where: { id: newAssignmentId } })
      if (previousAssignmentId) {
        await tx.contract_assignments.update({
          where: { id: previousAssignmentId },
          data: { isActive: true, actualEndDate: null },
        })
      }
    })
  }

  static async createAssignment(
    contractId: string,
    data: AssignContractInput,
    delivererId: string
  ) {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { id: true, familyId: true, name: true, status: true },
    })
    if (!contract) throw new Error('Contrato no encontrado')
    if (!contract.familyId) {
      throw new Error('El contrato debe tener un área asignada antes de vincular un cliente')
    }

    const client = await prisma.users.findUnique({
      where: { id: data.clientId },
      select: { id: true, name: true, role: true, isActive: true },
    })
    if (!client || !client.isActive) throw new Error('Usuario no encontrado o inactivo')

    // Clientes externos (portal) requieren acceso explícito otorgado al área, igual que
    // para consumir tickets de esa familia. El personal interno (Admin/Técnico) ya está
    // habilitado por pertenecer al área — mismo criterio que la asignación de activos
    // (AssignableUserSelect / /api/inventory/assignable-users), sin gate adicional aquí.
    if (client.role === 'CLIENT') {
      const { userHasFamilyInModule } = await import('@/lib/auth/user-family-access')
      const hasAccess = await userHasFamilyInModule(
        data.clientId,
        'tickets',
        contract.familyId,
        'canConsume'
      )
      if (!hasAccess) {
        throw new Error('El cliente no tiene acceso al área de este contrato')
      }
    }

    const active = await prisma.contract_assignments.findFirst({
      where: { contractId, isActive: true },
      include: { deliveryAct: true, client: { select: { id: true, name: true } } },
    })

    if (active?.clientId === data.clientId) {
      throw new Error('Este usuario ya tiene la asignación activa del contrato')
    }

    // Si el área no exige acta de entrega (inventory_family_config.requireDeliveryAct),
    // la asignación vigente nunca tuvo — ni va a tener — un acta que aceptar. Exigirla
    // igual dejaría "Cambiar responsable" bloqueado para siempre en esas áreas.
    const familyConfig = await prisma.inventory_family_config.findUnique({
      where: { familyId: contract.familyId },
      select: { requireDeliveryAct: true },
    })
    const actsRequired = familyConfig?.requireDeliveryAct !== false

    const startDate = data.startDate ? new Date(data.startDate) : new Date()
    const plannedEndDate = data.plannedEndDate ? new Date(data.plannedEndDate) : null

    return prisma.$transaction(async tx => {
      let previousAssignmentId: string | null = null

      if (active) {
        if (actsRequired && (!active.deliveryAct || active.deliveryAct.status !== 'ACCEPTED')) {
          throw new Error(
            'No se puede cambiar de cliente hasta que el acta de entrega vigente esté aceptada'
          )
        }
        previousAssignmentId = active.id
        await tx.contract_assignments.update({
          where: { id: active.id },
          data: {
            isActive: false,
            actualEndDate: startDate,
            changeReason: data.changeReason || 'Cambio de cliente',
          },
        })
      }

      const assignment = await tx.contract_assignments.create({
        data: {
          id: randomUUID(),
          contractId,
          clientId: data.clientId,
          delivererId,
          familyId: contract.familyId!,
          startDate,
          plannedEndDate,
          isActive: true,
          changeReason: data.changeReason || null,
          notes: data.notes || null,
        },
        include: ASSIGNMENT_INCLUDE,
      })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'CONTRACT_ASSIGNMENT_CREATED',
          entityType: 'contract',
          entityId: contractId,
          userId: delivererId,
          details: {
            assignmentId: assignment.id,
            clientId: data.clientId,
            clientName: client.name,
            previousAssignmentId,
            changeReason: data.changeReason ?? null,
          },
        },
      })

      return { assignment, previousAssignmentId, actsRequired }
    })
  }

  static async closeAssignment(assignmentId: string, actualEndDate?: Date) {
    return prisma.contract_assignments.update({
      where: { id: assignmentId },
      data: {
        isActive: false,
        actualEndDate: actualEndDate ?? new Date(),
      },
      include: ASSIGNMENT_INCLUDE,
    })
  }

  /**
   * Deshace una asignación creada por error, mientras su acta de entrega
   * siga PENDING (sin firmar). A diferencia de rollbackAssignment/
   * rollbackFailedAssign (que solo corren automáticamente si falla la
   * generación de actas justo después de crear la asignación), este método
   * es la vía manual: un admin nota el error más tarde — ya se guardó todo
   * y quizás se envió la notificación — y quiere deshacerlo sin esperar a
   * que el responsable firme ni pasar por "Retiro" (que exige un acta
   * ACEPTADA, imposible aquí).
   *
   * Si esta asignación reemplazó a otra, la restaura como activa — y si esa
   * anterior tenía un acta de retiro generada como parte del mismo cambio y
   * todavía no fue aceptada, también la elimina (ese retiro nunca debió
   * pasar si el cambio que lo originó era un error). Si el retiro anterior
   * ya fue aceptado, no se toca nada: ya es un hecho consumado.
   */
  static async undoAssignment(assignmentId: string, userId: string) {
    return prisma.$transaction(async tx => {
      const assignment = await tx.contract_assignments.findUnique({
        where: { id: assignmentId },
        include: { deliveryAct: true, client: { select: { name: true } } },
      })
      if (!assignment) throw new Error('Asignación no encontrada')
      if (!assignment.isActive) throw new Error('Esta asignación ya no está activa')
      if (!assignment.deliveryAct) throw new Error('Esta asignación no tiene acta de entrega')
      if (assignment.deliveryAct.status !== 'PENDING') {
        throw new Error(
          'Solo se puede deshacer mientras el acta de entrega esté pendiente de firma — usa "Retiro" para una asignación ya aceptada'
        )
      }

      // Asignación previa que este cambio reemplazó: createAssignment usa el
      // mismo `startDate` para cerrar la anterior (actualEndDate) y abrir
      // esta (startDate) — ver createAssignment más arriba.
      const previous = await tx.contract_assignments.findFirst({
        where: {
          contractId: assignment.contractId,
          isActive: false,
          actualEndDate: assignment.startDate,
        },
        include: { returnAct: true },
      })

      if (previous?.returnAct && previous.returnAct.status === 'ACCEPTED') {
        throw new Error(
          'El responsable anterior ya firmó su acta de retiro de esta suscripción — no se puede deshacer automáticamente'
        )
      }

      const deletedActFolio = assignment.deliveryAct.folio

      await tx.delivery_acts.delete({ where: { id: assignment.deliveryAct.id } })

      if (previous) {
        if (previous.returnAct) {
          await tx.contract_return_acts.delete({ where: { id: previous.returnAct.id } })
        }
        await tx.contract_assignments.update({
          where: { id: previous.id },
          data: { isActive: true, actualEndDate: null },
        })
      }

      await tx.contract_assignments.delete({ where: { id: assignmentId } })

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'CONTRACT_ASSIGNMENT_UNDONE',
          entityType: 'contract',
          entityId: assignment.contractId,
          userId,
          details: {
            assignmentId,
            clientName: assignment.client.name,
            deletedActFolio,
            restoredPreviousAssignmentId: previous?.id ?? null,
            reason: 'Asignación deshecha antes de la firma del acta — creada por error',
          },
        },
      })

      return { restoredPreviousAssignmentId: previous?.id ?? null }
    })
  }
}
