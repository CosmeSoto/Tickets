import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

// GET /api/families/[id]/inventory-config
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const config = await prisma.inventory_family_config.findUnique({
      where: { familyId: id },
    })

    if (!config) {
      return NextResponse.json(
        { success: false, message: 'Configuración de inventario no encontrada para esta familia' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('[GET /api/families/[id]/inventory-config]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener configuración de inventario' },
      { status: 500 }
    )
  }
}

// PUT /api/families/[id]/inventory-config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.inventory_family_config.findUnique({
      where: { familyId: id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Configuración de inventario no encontrada para esta familia' },
        { status: 404 }
      )
    }

    const body = await request.json()

    // Preservar todos los campos existentes; solo actualizar los que vienen en el body
    const {
      allowedSubtypes,
      visibleSections,
      requiredSections,
      requireFinancialForNew,
      sectionsByMode,
      defaultDepreciationMethod,
      defaultUsefulLifeYears,
      defaultResidualValuePct,
      codePrefix,
      autoApproveDecommission,
      requireDeliveryAct,
    } = body

    const updated = await prisma.inventory_family_config.update({
      where: { familyId: id },
      data: {
        ...(allowedSubtypes !== undefined && { allowedSubtypes }),
        ...(visibleSections !== undefined && { visibleSections }),
        ...(requiredSections !== undefined && { requiredSections }),
        ...(requireFinancialForNew !== undefined && { requireFinancialForNew }),
        ...(sectionsByMode !== undefined && { sectionsByMode }),
        ...(defaultDepreciationMethod !== undefined && { defaultDepreciationMethod }),
        ...(defaultUsefulLifeYears !== undefined && { defaultUsefulLifeYears }),
        ...(defaultResidualValuePct !== undefined && { defaultResidualValuePct }),
        ...(codePrefix !== undefined && { codePrefix }),
        ...(autoApproveDecommission !== undefined && { autoApproveDecommission }),
        ...(requireDeliveryAct !== undefined && { requireDeliveryAct }),
      },
    })

    await AuditServiceComplete.log({
      action: 'INVENTORY_FAMILY_CONFIG_UPDATED',
      entityType: 'settings',
      entityId: updated.id,
      userId: session.user.id,
      details: { familyId: id },
      oldValues: existing as unknown as Record<string, unknown>,
      newValues: updated as unknown as Record<string, unknown>,
      request,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Configuración de inventario actualizada exitosamente',
    })
  } catch (error) {
    console.error('[PUT /api/families/[id]/inventory-config]', error)
    return NextResponse.json(
      { success: false, message: 'Error al actualizar configuración de inventario' },
      { status: 500 }
    )
  }
}
