import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_FAMILY_CONFIG } from '@/lib/inventory/family-config'

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN') {
    const { canManageInventory } = await import('@/lib/inventory-access')
    const allowed = await canManageInventory(userId, role)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver la configuración de familias' },
        { status: 403 }
      )
    }
  }

  const families = await prisma.families.findMany({
    where: { isActive: true },
    include: { formConfig: true },
  })

  const configs = families.map((family) => {
    if (!family.formConfig) {
      return {
        familyId: family.id,
        ...DEFAULT_FAMILY_CONFIG,
      }
    }
    return {
      familyId: family.formConfig.familyId,
      allowedSubtypes: family.formConfig.allowedSubtypes,
      visibleSections: family.formConfig.visibleSections,
      requiredSections: family.formConfig.requiredSections,
      requireFinancialForNew: family.formConfig.requireFinancialForNew,
    }
  })

  return NextResponse.json(configs)
}
