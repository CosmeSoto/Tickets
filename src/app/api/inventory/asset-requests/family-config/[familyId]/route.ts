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
 * Obtiene la configuración del módulo para una familia
 */
export async function GET(request: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const familyId = params.familyId

    // Leer configuración desde system_settings
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
    return NextResponse.json({ error: 'Error al obtener la configuración' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/asset-requests/family-config/[familyId]
 * Actualiza la configuración del módulo para una familia
 * Solo Super Admin puede modificar esta configuración
 */
export async function PUT(request: NextRequest, { params }: { params: { familyId: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo Super Admin puede modificar la configuración
    if (session.user.role !== 'ADMIN' || !session.user.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Admin puede modificar esta configuración' },
        { status: 403 }
      )
    }

    const familyId = params.familyId

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
        key: `asset_requests_enabled_${familyId}`,
        value: validatedData.assetRequestsEnabled ? 'true' : 'false',
      },
    })

    // Invalidar caché de configuración
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

    // Errores de validación Zod
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Error al actualizar la configuración' }, { status: 500 })
  }
}
