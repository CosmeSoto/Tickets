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
  type SectionsByMode,
} from '@/lib/inventory/family-config'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
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

  const { familyId } = await params

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
      requireFinancialForNew: config.requireFinancialForNew,
      sectionsByMode: config.sectionsByMode ?? undefined,
    })
  } catch (err) {
    console.error('[family-config GET]', err)
    return NextResponse.json({ familyId, ...DEFAULT_FAMILY_CONFIG })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
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

  const { familyId } = await params
  const body = await req.json()
  const {
    allowedSubtypes,
    visibleSections,
    requiredSections,
    requireFinancialForNew = true,
    sectionsByMode,
  } = body as {
    allowedSubtypes: AssetSubtype[]
    visibleSections: FormSection[]
    requiredSections: FormSection[]
    requireFinancialForNew?: boolean
    sectionsByMode?: SectionsByMode
  }

  if (!Array.isArray(allowedSubtypes) || allowedSubtypes.length < 1) {
    return NextResponse.json({ error: 'Una familia debe permitir al menos un subtipo de activo' }, { status: 422 })
  }

  // Validar invariante global
  const sectionsCheck = validateSectionsInvariant(visibleSections ?? [], requiredSections ?? [])
  if (!sectionsCheck.valid) {
    return NextResponse.json({ error: sectionsCheck.error }, { status: 422 })
  }

  // Validar invariante por modalidad
  if (sectionsByMode) {
    for (const [mode, cfg] of Object.entries(sectionsByMode)) {
      if (!cfg) continue
      const check = validateSectionsInvariant(cfg.visible ?? [], cfg.required ?? [])
      if (!check.valid) {
        return NextResponse.json(
          { error: `Modalidad ${mode}: ${check.error}` },
          { status: 422 }
        )
      }
    }
  }

  try {
    const config = await prisma.inventory_family_config.upsert({
      where: { familyId },
      update: {
        allowedSubtypes,
        visibleSections: visibleSections ?? [],
        requiredSections: requiredSections ?? [],
        requireFinancialForNew,
        sectionsByMode: sectionsByMode ?? null,
      },
      create: {
        id: randomUUID(),
        familyId,
        allowedSubtypes,
        visibleSections: visibleSections ?? [],
        requiredSections: requiredSections ?? [],
        requireFinancialForNew,
        sectionsByMode: sectionsByMode ?? null,
      },
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
      requireFinancialForNew: config.requireFinancialForNew,
      sectionsByMode: config.sectionsByMode ?? undefined,
    })
  } catch (err) {
    console.error('[family-config PUT]', err)
    const msg = err instanceof Error ? err.message : 'Error al guardar la configuración'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
