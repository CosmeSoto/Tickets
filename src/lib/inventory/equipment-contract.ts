/**
 * Vinculación de equipos con contratos del módulo `contracts`.
 *
 * Nota: equipment.contract_id apunta a software_licenses (legado).
 * Los contratos de arrendamiento del ContractPicker usan la tabla `contracts`
 * y se vinculan mediante contract_lines + campos rental_* en equipment.
 */
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function getLinkedBusinessContractId(equipmentId: string): Promise<string | null> {
  const line = await prisma.contract_lines.findFirst({
    where: { equipmentId },
    orderBy: { createdAt: 'desc' },
    select: { contractId: true },
  })
  return line?.contractId ?? null
}

/**
 * Vincula un equipo a un contrato de negocio (tabla contracts) o legado (software_licenses).
 *
 * `additionalCost` — solo cuando se vincula a un contrato YA EXISTENTE (no uno creado
 * junto con este equipo): el costo de renta de ESTE equipo, que se suma al monthlyCost/
 * totalValue del contrato para que quede reflejado en las cuotas futuras. Sin esto, el
 * equipo quedaba vinculado "de adorno" — visible en el contrato, pero sin afectar en
 * nada lo que Generar pagos factura (el cálculo usa el costo del encabezado del
 * contrato, no líneas individuales, salvo que se les ponga precio propio — que acá
 * deliberadamente no se hace, para no dejar algunas líneas con precio y otras sin él,
 * lo que dejaría de sumar las que no lo tienen).
 */
export async function linkEquipmentToContract(
  equipmentId: string,
  contractId: string,
  equipmentLabel: string,
  additionalCost?: number | null
): Promise<{ contractId: string; source: 'business' | 'legacy' }> {
  let businessContract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      contractNumber: true,
      startDate: true,
      endDate: true,
      monthlyCost: true,
      totalValue: true,
      billingCycle: true,
      status: true,
    },
  })

  if (businessContract) {
    // Solo suma el costo si este es un vínculo NUEVO a este contrato — si el equipo ya
    // tenía una línea acá (p. ej. se está regrabando el mismo formulario sin cambiar el
    // contrato), es un resave, no una nueva incorporación: sumarlo de nuevo duplicaría
    // el costo cada vez que se guarda el equipo. Esto hace la operación idempotente sin
    // depender de que el frontend solo mande additionalCost una vez.
    const alreadyLinkedHere = additionalCost
      ? await prisma.contract_lines.findFirst({
          where: { equipmentId, contractId: businessContract.id },
          select: { id: true },
        })
      : null

    if (additionalCost && !alreadyLinkedHere) {
      businessContract = await prisma.contracts.update({
        where: { id: businessContract.id },
        data:
          businessContract.billingCycle === 'ONE_TIME'
            ? { totalValue: (businessContract.totalValue ?? 0) + additionalCost }
            : { monthlyCost: (businessContract.monthlyCost ?? 0) + additionalCost },
        select: {
          id: true,
          contractNumber: true,
          startDate: true,
          endDate: true,
          monthlyCost: true,
          totalValue: true,
          billingCycle: true,
          status: true,
        },
      })
    }

    await prisma.contract_lines.deleteMany({ where: { equipmentId } })

    const lineCount = await prisma.contract_lines.count({
      where: { contractId: businessContract.id },
    })
    await prisma.contract_lines.create({
      data: {
        id: randomUUID(),
        contractId: businessContract.id,
        type: 'EQUIPMENT',
        description: equipmentLabel,
        quantity: 1,
        equipmentId,
        order: lineCount,
      },
    })

    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        contractId: null,
        rentalContractNumber: businessContract.contractNumber,
        rentalStartDate: businessContract.startDate,
        rentalEndDate: businessContract.endDate,
        rentalMonthlyCost: businessContract.monthlyCost,
        contractStartDate: businessContract.startDate,
        contractEndDate: businessContract.endDate,
        contractRenewalCost: businessContract.monthlyCost,
      },
    })

    if (businessContract.status === 'DRAFT') {
      await prisma.contracts.update({
        where: { id: businessContract.id },
        data: { status: 'ACTIVE' },
      })
    }

    return { contractId: businessContract.id, source: 'business' }
  }

  const legacyContract = await prisma.software_licenses.findUnique({
    where: { id: contractId },
    select: { id: true },
  })
  if (!legacyContract) {
    throw new Error('El contrato seleccionado no existe')
  }

  await prisma.contract_lines.deleteMany({ where: { equipmentId } })
  await prisma.equipment.update({
    where: { id: equipmentId },
    data: { contractId },
  })

  return { contractId, source: 'legacy' }
}

/** Actualiza o elimina el vínculo contrato ↔ equipo. */
export async function syncEquipmentContractLink(
  equipmentId: string,
  contractId: string | null | undefined,
  equipmentLabel: string,
  additionalCost?: number | null
): Promise<void> {
  if (!contractId) {
    await prisma.contract_lines.deleteMany({ where: { equipmentId } })
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        contractId: null,
        rentalContractNumber: null,
        rentalStartDate: null,
        rentalEndDate: null,
        rentalMonthlyCost: null,
        contractStartDate: null,
        contractEndDate: null,
        contractRenewalCost: null,
      },
    })
    return
  }

  await linkEquipmentToContract(equipmentId, contractId, equipmentLabel, additionalCost)
}

export interface DecommissionContractImpact {
  contractId: string
  contractNumber: string
  contractSource: 'business' | 'legacy'
  remainingActiveAssets: number
}

/** Evalúa el impacto en contratos al dar de baja un equipo (antes de liberar vínculos). */
export async function getDecommissionContractImpact(
  equipmentId: string
): Promise<DecommissionContractImpact | null> {
  const businessContractId = await getLinkedBusinessContractId(equipmentId)

  if (businessContractId) {
    const contract = await prisma.contracts.findUnique({
      where: { id: businessContractId },
      select: { id: true, name: true, contractNumber: true },
    })
    if (!contract) return null

    const remainingActiveAssets = await prisma.contract_lines.count({
      where: {
        contractId: businessContractId,
        equipmentId: { not: equipmentId },
        equipment: { status: { not: 'RETIRED' } },
      },
    })

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber || contract.name,
      contractSource: 'business',
      remainingActiveAssets,
    }
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { contractId: true },
  })
  if (!equipment?.contractId) return null

  const [remainingActiveAssets, legacyContract] = await Promise.all([
    prisma.equipment.count({
      where: {
        contractId: equipment.contractId,
        id: { not: equipmentId },
        status: { not: 'RETIRED' },
      },
    }),
    prisma.software_licenses.findUnique({
      where: { id: equipment.contractId },
      select: { name: true },
    }),
  ])

  return {
    contractId: equipment.contractId,
    contractNumber: legacyContract?.name ?? equipment.contractId,
    contractSource: 'legacy',
    remainingActiveAssets,
  }
}

/** Libera vínculos contrato ↔ equipo tras una baja. */
export async function releaseEquipmentFromContracts(equipmentId: string): Promise<void> {
  await prisma.contract_lines.deleteMany({ where: { equipmentId } })
  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      contractId: null,
      rentalContractNumber: null,
      rentalStartDate: null,
      rentalEndDate: null,
      rentalMonthlyCost: null,
      contractStartDate: null,
      contractEndDate: null,
      contractRenewalCost: null,
    },
  })
}
