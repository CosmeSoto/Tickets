/**
 * Snapshot inmutable de una licencia para actas de asignación — mismo patrón que
 * buildContractSnapshot (contract-snapshot.ts), adaptado a los campos de software_licenses.
 */
import { prisma } from '@/lib/prisma'
import { withAttributeLabels } from '@/lib/inventory/attribute-labels'

export async function buildLicenseSnapshot(
  licenseId: string,
  extra?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const license = await prisma.software_licenses.findUnique({
    where: { id: licenseId },
    include: {
      licenseType: { include: { attributes: true } },
      supplier: { select: { id: true, name: true, email: true, phone: true, taxId: true } },
    },
  })

  if (!license) {
    throw new Error('Licencia no encontrada')
  }

  return {
    licenseId: license.id,
    name: license.name,
    typeName: license.licenseType?.name ?? null,
    vendor: license.vendor,
    supplier: license.supplier,
    contractType: license.contractType,
    licenseScope: license.licenseScope,
    cost: license.cost,
    renewalCost: license.renewalCost,
    renewalDate: license.renewalDate,
    purchaseDate: license.purchaseDate,
    expirationDate: license.expirationDate,
    invoiceNumber: license.invoiceNumber,
    purchaseOrderNumber: license.purchaseOrderNumber,
    customValues: withAttributeLabels(
      (license.customValues as Array<{ fieldName: string; fieldValue: string }>) ?? [],
      license.licenseType?.attributes
    ),
    snapshotAt: new Date().toISOString(),
    ...extra,
  }
}
