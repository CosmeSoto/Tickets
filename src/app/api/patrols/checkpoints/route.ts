/**
 * GET  /api/patrols/checkpoints?familyId=  — Lista checkpoints de una familia
 * POST /api/patrols/checkpoints             — Crea un checkpoint
 *
 * qrSecret y qrStaticToken NUNCA se incluyen en las respuestas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { PatrolQRService } from '@/lib/services/patrol-qr.service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { randomUUID } from 'crypto'
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import { checkPatrolFamilyOperate, resolvePatrolVisibilityFilter } from '@/lib/patrol/patrol-access'

// Campos seguros para devolver en respuestas (excluye qrSecret y qrStaticToken)
const SAFE_CHECKPOINT_SELECT = {
  id: true,
  familyId: true,
  family: { select: { id: true, name: true } },
  name: true,
  description: true,
  location: true,
  latitude: true,
  longitude: true,
  geofenceRadiusMeters: true,
  hasConnectivity: true,
  isSensitive: true,
  isActive: true,
  qrType: true,
  createdAt: true,
  updatedAt: true,
} as const

const createCheckpointSchema = z.object({
  familyId: z.string().uuid('familyId debe ser un UUID válido'),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  location: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  geofenceRadiusMeters: z.number().min(1).max(10000).optional(),
  hasConnectivity: z.boolean().default(true),
  isSensitive: z.boolean().default(false),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const sortParam = searchParams.get('sort') // e.g. "name:asc", "createdAt:desc"

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const scope = await resolvePatrolVisibilityFilter(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId
    )
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const where = {
      ...scope.familyWhere,
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    // Determine sort order: use explicit sort param if provided, otherwise default to createdAt desc
    const ALLOWED_SORT_FIELDS = ['name', 'createdAt', 'updatedAt', 'location'] as const
    type SortField = (typeof ALLOWED_SORT_FIELDS)[number]
    let orderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }

    if (sortParam) {
      const [field, direction] = sortParam.split(':')
      if (ALLOWED_SORT_FIELDS.includes(field as SortField) && ['asc', 'desc'].includes(direction)) {
        orderBy = { [field]: direction as 'asc' | 'desc' }
      }
    }

    const [checkpoints, total] = await Promise.all([
      prisma.patrol_checkpoints.findMany({
        where,
        select: SAFE_CHECKPOINT_SELECT,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patrol_checkpoints.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: checkpoints,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[patrol/checkpoints] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // ADMIN siempre puede gestionar el módulo. TECHNICIAN necesita patrolsEnabled.
    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const body = await request.json()
    const data = createCheckpointSchema.parse(body)

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const canOperate = await checkPatrolFamilyOperate(
      session.user.id,
      data.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!canOperate) {
      return NextResponse.json(
        { error: 'No tienes acceso para crear checkpoints en esta área' },
        { status: 403 }
      )
    }

    // qrType se determina automáticamente por hasConnectivity
    const qrType = data.hasConnectivity ? 'DYNAMIC' : 'STATIC'
    const qrSecret = PatrolQRService.generateSecret()
    const qrStaticToken = qrType === 'STATIC' ? PatrolQRService.generateStaticToken() : null

    const checkpoint = await prisma.patrol_checkpoints.create({
      data: {
        id: randomUUID(),
        familyId: data.familyId,
        name: data.name,
        description: data.description,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        geofenceRadiusMeters: data.geofenceRadiusMeters,
        hasConnectivity: data.hasConnectivity,
        isSensitive: data.isSensitive,
        qrType,
        qrSecret,
        qrStaticToken,
      },
      select: SAFE_CHECKPOINT_SELECT,
    })

    await AuditServiceComplete.log({
      action: 'PATROL_CHECKPOINT_CREATED',
      entityType: 'patrol',
      entityId: checkpoint.id,
      userId: session.user.id,
      newValues: { name: checkpoint.name, familyId: checkpoint.familyId, qrType },
      request,
    })

    return NextResponse.json({ success: true, data: checkpoint }, { status: 201 })
  } catch (error) {
    console.error('[patrol/checkpoints] POST:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
