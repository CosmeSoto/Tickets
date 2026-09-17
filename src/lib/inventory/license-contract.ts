/**
 * Vinculación de licencias con contratos del módulo `contracts`.
 * Las licencias con contrato recurrente se vinculan vía contract_lines.licenseId.
 */
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { CONTRACT_CATEGORY_TO_ACQUISITION_TYPE } from '@/lib/inventory/license-labels'

/**
 * Efectos que debe tener SIEMPRE vincular una licencia a un contrato, sin
 * importar por qué camino se hizo (formulario de licencia, alta masiva, o
 * edición de líneas desde el módulo de Contratos): el BillingCycle del
 * contrato pasa a mandar sobre la renovación (se limpia renewalFrequency
 * propio de la licencia), las alertas standalone dejan de tener sentido, y la
 * categoría del contrato sincroniza la "Modalidad de adquisición" — sin esto,
 * quedaban datos huérfanos/contradictorios cada vez que el vínculo se hacía
 * desde un lugar que no fuera el PUT de licencia.
 */
export async function applyContractLinkSideEffects(
  licenseId: string,
  contractCategory: string | null | undefined,
  _changedById: string
): Promise<void> {
  // EQUIPMENT_RENTAL/OTHER no tienen un LicenseAcquisitionType razonable — se
  // limpia a "Sin especificar" en vez de dejar lo que hubiera antes, para no
  // mostrar una modalidad que ya no corresponde al contrato vinculado.
  const acquisitionType = contractCategory
    ? (CONTRACT_CATEGORY_TO_ACQUISITION_TYPE[contractCategory] ?? null)
    : null

  await prisma.software_licenses.update({
    where: { id: licenseId },
    data: {
      renewalFrequency: null,
      customFrequencyMonths: null,
      paymentAlertFirstSentAt: null,
      paymentAlertSecondSentAt: null,
      acquisitionType: acquisitionType as never,
    },
  })
}

export async function getLinkedBusinessContractIdForLicense(
  licenseId: string
): Promise<string | null> {
  const line = await prisma.contract_lines.findFirst({
    where: { licenseId },
    orderBy: { createdAt: 'desc' },
    select: { contractId: true },
  })
  return line?.contractId ?? null
}

/**
 * Vincula una licencia a un contrato de negocio (tabla contracts).
 *
 * `additionalCost` — ver el comentario gemelo en linkEquipmentToContract(): solo se
 * suma cuando es un vínculo nuevo a este contrato (no un resave), y solo tiene sentido
 * al vincular a un contrato YA EXISTENTE, no uno creado junto con esta licencia.
 */
export async function linkLicenseToBusinessContract(
  licenseId: string,
  contractId: string,
  licenseLabel: string,
  additionalCost?: number | null,
  changedById?: string
): Promise<{ contractId: string }> {
  let businessContract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      status: true,
      monthlyCost: true,
      totalValue: true,
      billingCycle: true,
      category: true,
    },
  })

  if (!businessContract) {
    throw new Error('El contrato seleccionado no existe')
  }

  const alreadyLinkedHere = additionalCost
    ? await prisma.contract_lines.findFirst({
        where: { licenseId, contractId: businessContract.id },
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
        status: true,
        monthlyCost: true,
        totalValue: true,
        billingCycle: true,
        category: true,
      },
    })
  }

  await prisma.contract_lines.deleteMany({ where: { licenseId } })

  const lineCount = await prisma.contract_lines.count({
    where: { contractId: businessContract.id },
  })
  await prisma.contract_lines.create({
    data: {
      id: randomUUID(),
      contractId: businessContract.id,
      type: 'SOFTWARE',
      description: licenseLabel,
      quantity: 1,
      licenseId,
      order: lineCount,
    },
  })

  if (businessContract.status === 'DRAFT') {
    await prisma.contracts.update({
      where: { id: businessContract.id },
      data: { status: 'ACTIVE' },
    })
  }

  if (changedById) {
    await applyContractLinkSideEffects(licenseId, businessContract.category, changedById)
  }

  return { contractId: businessContract.id }
}

/** Actualiza o elimina el vínculo contrato ↔ licencia. */
export async function syncLicenseContractLink(
  licenseId: string,
  contractId: string | null | undefined,
  licenseLabel: string,
  additionalCost?: number | null,
  changedById?: string
): Promise<void> {
  if (!contractId) {
    await prisma.contract_lines.deleteMany({ where: { licenseId } })
    return
  }

  await linkLicenseToBusinessContract(
    licenseId,
    contractId,
    licenseLabel,
    additionalCost,
    changedById
  )
}

/** Mapea el alcance del formulario al enum Prisma. */
export function mapLicenseScope(
  scope?: string
): 'INDIVIDUAL' | 'DEPARTMENT' | 'COMPANY' | undefined {
  if (!scope) return undefined
  const map: Record<string, 'INDIVIDUAL' | 'DEPARTMENT' | 'COMPANY'> = {
    Individual: 'INDIVIDUAL',
    Departamento: 'DEPARTMENT',
    Empresa: 'COMPANY',
    INDIVIDUAL: 'INDIVIDUAL',
    DEPARTMENT: 'DEPARTMENT',
    COMPANY: 'COMPANY',
  }
  return map[scope]
}

export interface DecommissionContractImpact {
  contractId: string
  contractNumber: string
  contractSource: 'business'
  remainingActiveAssets: number
}

/** Evalúa impacto en contratos al dar de baja una licencia. */
export async function getDecommissionContractImpactForLicense(
  licenseId: string
): Promise<DecommissionContractImpact | null> {
  const businessContractId = await getLinkedBusinessContractIdForLicense(licenseId)
  if (!businessContractId) return null

  const contract = await prisma.contracts.findUnique({
    where: { id: businessContractId },
    select: { id: true, name: true, contractNumber: true },
  })
  if (!contract) return null

  const remainingActiveAssets = await prisma.contract_lines.count({
    where: {
      contractId: businessContractId,
      NOT: { licenseId },
      OR: [
        { equipmentId: { not: null }, equipment: { status: { not: 'RETIRED' } } },
        {
          licenseId: { not: null },
          license: { expirationDate: { gt: new Date('2000-01-02') } },
        },
      ],
    },
  })

  return {
    contractId: contract.id,
    contractNumber: contract.contractNumber || contract.name,
    contractSource: 'business',
    remainingActiveAssets,
  }
}

/** Libera vínculos contrato ↔ licencia tras una baja. */
export async function releaseLicenseFromContracts(licenseId: string): Promise<void> {
  await prisma.contract_lines.deleteMany({ where: { licenseId } })
}
