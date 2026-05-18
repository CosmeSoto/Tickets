import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EXPIRING_DAYS = 30 // alerta si vence en menos de 30 días

function contractStatus(endDate?: Date | null): {
  status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED'
  daysUntilExpiry?: number
} {
  if (!endDate) return { status: 'ACTIVE' }
  const now = new Date()
  const diff = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { status: 'EXPIRED', daysUntilExpiry: 0 }
  if (diff <= EXPIRING_DAYS) return { status: 'EXPIRING', daysUntilExpiry: diff }
  return { status: 'ACTIVE', daysUntilExpiry: diff }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const familyId = searchParams.get('familyId') || undefined

  // Admin Normal: resolver scope de inventario si no se pasa familyId explícito
  let scopeFamilyIds: string[] | undefined = undefined
  if (!familyId && session.user.role === 'ADMIN' && !(session.user as any).isSuperAdmin) {
    const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
    scopeFamilyIds = (await getInventorySessionContext(session.user)).scope.familyIds
  }

  // Construir filtro de familia para equipment (a través de type)
  const equipFamilyFilter = familyId
    ? { type: { familyId } }
    : scopeFamilyIds
      ? { type: { familyId: { in: scopeFamilyIds } } }
      : {}

  // Construir filtro de familia para licenses (a través de licenseType)
  const licenseFamilyFilter = familyId
    ? { licenseType: { familyId } }
    : scopeFamilyIds
      ? { licenseType: { familyId: { in: scopeFamilyIds } } }
      : {}

  // Equipos en arrendamiento o activo de tercero (tienen contrato)
  const [equipmentContracts, licenseContracts] = await Promise.all([
    prisma.equipment.findMany({
      where: {
        ownershipType: { in: ['RENTAL', 'LOAN'] },
        status: { not: 'RETIRED' },
        ...equipFamilyFilter,
      },
      select: {
        id: true,
        brand: true,
        model: true,
        rentalContractNumber: true,
        rentalEndDate: true,
        rentalMonthlyCost: true,
        contractEndDate: true,
        contractRenewalCost: true,
        contractId: true,
        ownershipType: true,
        supplier: { select: { name: true } },
        type: {
          select: {
            family: { select: { name: true } },
          },
        },
      },
      orderBy: { rentalEndDate: 'asc' },
      take: 500,
    }),

    prisma.software_licenses.findMany({
      where: {
        OR: [{ expirationDate: { not: null } }, { renewalCost: { not: null } }],
        ...licenseFamilyFilter,
      },
      select: {
        id: true,
        name: true,
        expirationDate: true,
        renewalCost: true,
        vendor: true,
        supplier: { select: { name: true } },
        licenseType: {
          select: {
            family: { select: { name: true } },
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
      take: 500,
    }),
  ])

  // Mapear equipos
  const equipmentItems = equipmentContracts.map(eq => {
    const endDate = eq.rentalEndDate ?? eq.contractEndDate
    const { status, daysUntilExpiry } = contractStatus(endDate)
    const supplierName = eq.supplier?.name ?? undefined
    return {
      id: eq.id,
      name: `${eq.brand} ${eq.model}`,
      type: 'EQUIPMENT' as const,
      contractNumber: eq.rentalContractNumber ?? undefined,
      supplier: supplierName,
      endDate: endDate?.toISOString(),
      monthlyCost: eq.rentalMonthlyCost ?? eq.contractRenewalCost ?? undefined,
      status,
      daysUntilExpiry,
      familyName: eq.type?.family?.name,
    }
  })

  // Mapear licencias
  const licenseItems = licenseContracts.map(lic => {
    const { status, daysUntilExpiry } = contractStatus(lic.expirationDate)
    const supplierName = lic.supplier?.name ?? lic.vendor ?? undefined
    return {
      id: lic.id,
      name: lic.name,
      type: 'LICENSE' as const,
      supplier: supplierName,
      endDate: lic.expirationDate?.toISOString(),
      monthlyCost: lic.renewalCost ?? undefined,
      status,
      daysUntilExpiry,
      familyName: lic.licenseType?.family?.name,
    }
  })

  // Ordenar: vencidos primero, luego por vencer, luego vigentes
  const ORDER = { EXPIRED: 0, EXPIRING: 1, ACTIVE: 2 }
  const items = [...equipmentItems, ...licenseItems].sort((a, b) => {
    const diff = ORDER[a.status] - ORDER[b.status]
    if (diff !== 0) return diff
    // Dentro del mismo estado, ordenar por fecha de vencimiento más próxima
    if (a.endDate && b.endDate) return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    return 0
  })

  return NextResponse.json({ items, total: items.length })
}
