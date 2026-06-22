/**
 * Vinculación de licencias con contratos del módulo `contracts`.
 * Las licencias con contrato recurrente se vinculan vía contract_lines.licenseId.
 */
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

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

/** Vincula una licencia a un contrato de negocio (tabla contracts). */
export async function linkLicenseToBusinessContract(
  licenseId: string,
  contractId: string,
  licenseLabel: string
): Promise<{ contractId: string }> {
  const businessContract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: { id: true, status: true },
  })

  if (!businessContract) {
    throw new Error('El contrato seleccionado no existe')
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

  return { contractId: businessContract.id }
}

/** Actualiza o elimina el vínculo contrato ↔ licencia. */
export async function syncLicenseContractLink(
  licenseId: string,
  contractId: string | null | undefined,
  licenseLabel: string
): Promise<void> {
  if (!contractId) {
    await prisma.contract_lines.deleteMany({ where: { licenseId } })
    return
  }

  await linkLicenseToBusinessContract(licenseId, contractId, licenseLabel)
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
