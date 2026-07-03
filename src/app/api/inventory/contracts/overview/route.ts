import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const EXPIRING_DAYS = 30

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

/**
 * GET /api/inventory/contracts/overview
 * Vista agregada de arrendamientos de equipos y licencias con vencimiento.
 * (Antes vivía en GET /api/inventory/contracts — movido para liberar CRUD canónico.)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const familyId = searchParams.get('familyId') || undefined

  let scopeFamilyIds: string[] | undefined = undefined
  if (!familyId && session.user.role === 'ADMIN' && !(session.user as any).isSuperAdmin) {
    const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
    scopeFamilyIds = (await getInventorySessionContext(session.user)).scope.familyIds
  }

  const equipFamilyFilter = familyId
    ? { type: { familyId } }
    : scopeFamilyIds
      ? { type: { familyId: { in: scopeFamilyIds } } }
      : {}

  const licenseFamilyFilter = familyId
    ? { licenseType: { familyId } }
    : scopeFamilyIds
      ? { licenseType: { familyId: { in: scopeFamilyIds } } }
      : {}

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
        type: { select: { family: { select: { name: true } } } },
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
        licenseType: { select: { family: { select: { name: true } } } },
      },
      orderBy: { expirationDate: 'asc' },
      take: 500,
    }),
  ])

  const equipmentItems = equipmentContracts.map(eq => {
    const endDate = eq.rentalEndDate ?? eq.contractEndDate
    const { status, daysUntilExpiry } = contractStatus(endDate)
    return {
      id: eq.id,
      name: `${eq.brand} ${eq.model}`,
      type: 'EQUIPMENT' as const,
      contractNumber: eq.rentalContractNumber ?? undefined,
      supplier: eq.supplier?.name ?? undefined,
      endDate: endDate?.toISOString(),
      monthlyCost: eq.rentalMonthlyCost ?? eq.contractRenewalCost ?? undefined,
      status,
      daysUntilExpiry,
      familyName: eq.type?.family?.name,
    }
  })

  const licenseItems = licenseContracts.map(lic => {
    const { status, daysUntilExpiry } = contractStatus(lic.expirationDate)
    return {
      id: lic.id,
      name: lic.name,
      type: 'LICENSE' as const,
      supplier: lic.supplier?.name ?? lic.vendor ?? undefined,
      endDate: lic.expirationDate?.toISOString(),
      monthlyCost: lic.renewalCost ?? undefined,
      status,
      daysUntilExpiry,
      familyName: lic.licenseType?.family?.name,
    }
  })

  const ORDER = { EXPIRED: 0, EXPIRING: 1, ACTIVE: 2 }
  const items = [...equipmentItems, ...licenseItems].sort((a, b) => {
    const diff = ORDER[a.status] - ORDER[b.status]
    if (diff !== 0) return diff
    if (a.endDate && b.endDate) return new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    return 0
  })

  return NextResponse.json({ items, total: items.length })
}
