/**
 * GET  /api/patrols/family-config/[familyId]  — Obtiene config de patrullas de una familia
 * PUT  /api/patrols/family-config/[familyId]  — Actualiza config (solo ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getOrCreatePatrolFamilyConfig,
  PATROL_FAMILY_DEFAULTS,
} from '@/lib/patrol/patrol-family-config'
import { validatePatrolFamilyConfig } from '@/lib/patrol/patrol-config-validator'
import {
  sanitizePatrolConfigBody,
  canReadModuleFamilyConfig,
} from '@/lib/auth/module-config-access'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { familyId } = await params
    const { role, id: userId } = session.user as { role: string; id: string }
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    const canRead = await canReadModuleFamilyConfig(userId, role, isSuperAdmin, familyId, 'patrols')
    if (!canRead) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver la configuración de esta familia' },
        { status: 403 }
      )
    }

    const config = await getOrCreatePatrolFamilyConfig(familyId)

    // Nunca exponer patrolIncidentCategoryId como dato sensible — es solo un FK
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('[patrol/family-config] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden modificar esta configuración' },
        { status: 403 }
      )
    }

    const { familyId } = await params
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const rawBody = await request.json()
    const body = sanitizePatrolConfigBody(rawBody as Record<string, unknown>, isSuperAdmin)

    // Admin Normal: verificar que tiene acceso operativo en la familia nativa
    if (!isSuperAdmin) {
      const { checkPatrolFamilyOperate } = await import('@/lib/patrol/patrol-access')
      const hasAccess = await checkPatrolFamilyOperate(
        session.user.id,
        familyId,
        session.user.role,
        false
      )
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'No tienes permiso para modificar la configuración de esta familia' },
          { status: 403 }
        )
      }
    }

    // Validar rangos con el validador puro
    const validation = validatePatrolFamilyConfig(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Configuración inválida', details: validation.errors },
        { status: 422 }
      )
    }

    // Asegurar que el registro existe antes de actualizar
    await getOrCreatePatrolFamilyConfig(familyId)

    const oldConfig = await prisma.patrol_family_config.findUnique({ where: { familyId } })
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { name: true },
    })

    // Campos permitidos para actualización
    const allowedFields = [
      'patrolsEnabled',
      'qrWindowMinutes',
      'geofenceRadiusMeters',
      'photoRetentionDays',
      'photoCompressionQuality',
      'photoMaxWidthPx',
      'requirePhotoOnStart',
      'requirePhotoOnEnd',
      'offlineSyncToleranceMinutes',
      'alertCompletionThreshold',
      'gracePeriodMinutes',
      'strictTimeValidation',
      'reminderMinutesBefore',
      'patrolIncidentCategoryId',
    ] as const

    const updateData: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const updated = await prisma.patrol_family_config.update({
      where: { familyId },
      data: updateData,
    })

    await AuditServiceComplete.log({
      action: 'PATROL_FAMILY_CONFIG_UPDATED',
      entityType: 'patrol',
      entityId: familyId,
      userId: session.user.id,
      oldValues: oldConfig ?? undefined,
      newValues: updated,
      details: { familyId, familyName: family?.name },
      request,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[patrol/family-config] PUT:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
