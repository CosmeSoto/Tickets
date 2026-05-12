import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSetting, invalidateSettings } from '@/lib/api-cache'
import { updateFamilyConfigSchema } from '@/lib/validations/inventory/asset-request'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { ZodError } from 'zod'

/**
 * GET /api/inventory/asset-requests/family-config/[familyId]
 * Obtiene la configuraci?n del m?dulo para una familia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Leer configuraci?n desde system_settings
    const enabled = await getSetting(
      `asset_requests_enabled_${familyId}`,
      600, // TTL 10 min
      'false'
    )

    return NextResponse.json({
      familyId,
      assetRequestsEnabled: enabled === 'true',
    })
  } catch (error) {
    console.error('[API] Error getting family config:', error)
    return NextResponse.json({ error: 'Error al obtener la configuraci?n' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/asset-requests/family-config/[familyId]
 * Actualiza la configuraci?n del m?dulo para una familia
 * Solo Super Admin puede modificar esta configuraci?n
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

    // Solo Super Admin puede modificar la configuraci?n
    if (session.user.role !== 'ADMIN' || !session.user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Admin puede modificar esta configuraci?n' },
        { status: 403 }
      )
    }

    // Parsear y validar body
    const body = await request.json()
    const validatedData = updateFamilyConfigSchema.parse(body)

    // Obtener nombre de la familia para el log
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { name: true },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    // Escribir en system_settings
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

    // Invalidar cach? de configuraci?n
    await invalidateSettings(`asset_requests_enabled_${familyId}`)

    // Registrar en audit_logs
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    await AuditServiceComplete.log({
      action: 'asset_request_config_updated',
      entityType: 'inventory',
      entityId: familyId,
      userId: session.user.id,
      ipAddress,
      details: {
        familyId,
        familyName: family.name,
        assetRequestsEnabled: validatedData.assetRequestsEnabled,
      },
    })

    return NextResponse.json({
      familyId,
      assetRequestsEnabled: validatedData.assetRequestsEnabled,
    })
  } catch (error) {
    console.error('[API] Error updating family config:', error)

    // Errores de validaci?n Zod
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Error al actualizar la configuraci?n' }, { status: 500 })
  }
}
