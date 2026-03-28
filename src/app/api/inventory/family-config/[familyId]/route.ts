import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_FAMILY_CONFIG,
  validateSectionsInvariant,
  type AssetSubtype,
  type FormSection,
} from '@/lib/inventory/family-config'

export async function GET(
  _req: NextRequest,
  { params }: { params: { familyId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN') {
    const { canManageInventory } = await import('@/lib/inventory-access')
    const allowed = await canManageInventory(userId, role)
    if (!allowed) {
      return NextResponse.json({ error: 'No tienes permiso para ver la configuración de familias' }, { status: 403 })
    }
  }

  const { familyId } = params

  try {
    const config = await prisma.inventory_family_config.findUnique({ where: { familyId } })
    if (!config) {
      return NextResponse.json({ familyId, ...DEFAULT_FAMILY_CONFIG })
    }
    return NextResponse.json({
      familyId: config.familyId,
      allowedSubtypes: config.allowedSubtypes,
      visibleSections: config.visibleSections,
      requiredSections: config.requiredSections,
      requireFinancialForNew: (config as any).requireFinancialForNew ?? true,
    })
  } catch (err) {
    console.error('[family-config GET]', err)
    return NextResponse.json({ familyId, ...DEFAULT_FAMILY_CONFIG })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { familyId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Solo el administrador puede configurar las secciones del formulario por familia' },
      { status: 403 }
    )
  }

  const { familyId } = params
  const body = await req.json()
  const {
    allowedSubtypes,
    visibleSections,
    requiredSections,
    requireFinancialForNew = true,
  } = body as {
    allowedSubtypes: AssetSubtype[]
    visibleSections: FormSection[]
    requiredSections: FormSection[]
    requireFinancialForNew?: boolean
  }

  if (!Array.isArray(allowedSubtypes) || allowedSubtypes.length < 1) {
    return NextResponse.json({ error: 'Una familia debe permitir al menos un subtipo de activo' }, { status: 422 })
  }

  const sectionsCheck = validateSectionsInvariant(visibleSections ?? [], requiredSections ?? [])
  if (!sectionsCheck.valid) {
    return NextResponse.json(
      { error: 'Las secciones obligatorias deben ser un subconjunto de las secciones visibles' },
      { status: 422 }
    )
  }

  try {
    const config = await prisma.inventory_family_config.upsert({
      where: { familyId },
      update: {
        allowedSubtypes,
        visibleSections: visibleSections ?? [],
        requiredSections: requiredSections ?? [],
        requireFinancialForNew,
      } as any,
      create: {
        familyId,
        allowedSubtypes,
        visibleSections: visibleSections ?? [],
        requiredSections: requiredSections ?? [],
        requireFinancialForNew,
      } as any,
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE_FAMILY_CONFIG',
        entityType: 'inventory_family_config',
        entityId: familyId,
        userId,
      },
    }).catch(err => console.warn('[audit] family-config PUT:', err?.message))

    return NextResponse.json({
      familyId: config.familyId,
      allowedSubtypes: config.allowedSubtypes,
      visibleSections: config.visibleSections,
      requiredSections: config.requiredSections,
      requireFinancialForNew: (config as any).requireFinancialForNew ?? true,
    })
  } catch (err) {
    console.error('[family-config PUT]', err)
    const msg = err instanceof Error ? err.message : 'Error al guardar la configuración'
    // Si la tabla no existe aún (BD no migrada), devolver los datos sin error para no bloquear al usuario
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('P2021') || msg.includes('P2002')) {
      return NextResponse.json({
        familyId,
        allowedSubtypes,
        visibleSections: visibleSections ?? [],
        requiredSections: requiredSections ?? [],
        requireFinancialForNew,
        _warning: 'Configuración no persistida — reconstruye el contenedor para aplicar la migración',
      })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
