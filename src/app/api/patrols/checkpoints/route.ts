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

// Campos seguros para devolver en respuestas (excluye qrSecret y qrStaticToken)
const SAFE_CHECKPOINT_SELECT = {
  id: true,
  familyId: true,
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

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where = {
      ...(familyId ? { familyId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [checkpoints, total] = await Promise.all([
      prisma.patrol_checkpoints.findMany({
        where,
        select: SAFE_CHECKPOINT_SELECT,
        orderBy: { name: 'asc' },
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

    // Solo ADMIN y TECHNICIAN con patrolsEnabled
    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { patrolsEnabled: true },
    })
    if (!user?.patrolsEnabled) {
      return NextResponse.json(
        { error: 'Módulo de patrullas no habilitado para este usuario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const data = createCheckpointSchema.parse(body)

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
