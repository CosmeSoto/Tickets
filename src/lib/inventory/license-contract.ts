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
