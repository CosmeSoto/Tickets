import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSetting, invalidateSettings } from '@/lib/api-cache'
import { updateFamilyConfigSchema } from '@/lib/validations/inventory/asset-request'
import { prisma } from '@/lib/prisma'
import { logConfigAudit } from '@/lib/services/config-audit'
import { ZodError } from 'zod'

/**
 * GET /api/inventory/asset-requests/family-config/[familyId]
 * Obtiene la configuración del módulo para una familia
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const enabled = await getSetting(`asset_requests_enabled_${familyId}`, 600, '')
    let assetRequestsEnabled: boolean
    if (enabled === 'true') assetRequestsEnabled = true
    else if (enabled === 'false') assetRequestsEnabled = false
    else {
      // Misma regla que AssetRequestService.isAssetRequestsEnabledForFamily
      const cfg = await prisma.inventory_family_config.findUnique({
        where: { familyId },
        select: { inventoryEnabled: true },
      })
      assetRequestsEnabled = cfg?.inventoryEnabled !== false
    }

    return NextResponse.json({
      familyId,
      assetRequestsEnabled,
    })
  } catch (error) {
    console.error('[API] Error getting family config:', error)
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/asset-requests/family-config/[familyId]
 * Actualiza la configuración del módulo para una familia
 * Solo Super Admin puede modificar esta configuración
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' || !session.user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Admin puede modificar esta configuración' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateFamilyConfigSchema.parse(body)

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { name: true },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const previousRow = await prisma.system_settings.findUnique({
      where: { key: `asset_requests_enabled_${familyId}` },
      select: { value: true },
    })
    const previousEnabled = previousRow?.value === 'true'

    await prisma.system_settings.upsert({
      where: { key: `asset_requests_enabled_${familyId}` },
      update: {
        value: validatedData.assetRequestsEnabled ? 'true' : 'false',
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        key: `asset_requests_enabled_${familyId}`,
        value: validatedData.assetRequestsEnabled ? 'true' : 'false',
        updatedAt: new Date(),
      },
    })

    await invalidateSettings(`asset_requests_enabled_${familyId}`)

    await logConfigAudit({
      action: 'asset_request_config_updated',
      entityType: 'inventory',
      entityId: familyId,
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      oldValues: {
        familyName: family.name,
        assetRequestsEnabled: previousEnabled,
      },
      newValues: {
        familyName: family.name,
        assetRequestsEnabled: validatedData.assetRequestsEnabled,
      },
    })

    return NextResponse.json({
      familyId,
      assetRequestsEnabled: validatedData.assetRequestsEnabled,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[API] Error updating family config:', error)
    return NextResponse.json({ error: 'Error al actualizar la configuración' }, { status: 500 })
  }
}
